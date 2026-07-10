import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { formatDate, TASK_STATUS_LABELS, ROADBLOCK_TYPE_LABELS } from "@/lib/utils";
import { computePpcTrend } from "@/lib/analytics";
import { loadProjectSummary } from "@/lib/project-summary";
import { stripAssistantMarkdown } from "@/lib/assistant-plain-text";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export type AssistantMessage = { role: "user" | "assistant"; content: string };

export class AssistantNotConfiguredError extends Error {}

/**
 * Assembles a compact snapshot of a project's own data (tasks, roadblocks,
 * PPC, submittals/RFIs) to ground the assistant's answers. Caps list sizes so
 * the prompt stays a reasonable size regardless of project scale.
 */
async function buildProjectContext(projectId: string): Promise<string> {
  const [project, tasks, openRoadblocks, recentCommitments, openSubmittals, openRfis] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: projectId } }),
    prisma.task.findMany({
      where: { projectId },
      include: { assignedTo: { include: { user: { select: { name: true } } } } },
      orderBy: { startDate: "asc" },
      take: 100,
    }),
    prisma.task.findMany({
      where: { projectId, isRoadblock: true, roadblockStatus: "OPEN" },
      include: { roadblockOwner: { include: { user: { select: { name: true } } } } },
      take: 30,
    }),
    prisma.weeklyCommitment.findMany({
      where: { task: { projectId } },
      orderBy: { weekStartDate: "desc" },
      take: 60,
    }),
    prisma.submittal.findMany({ where: { projectId, status: { not: "APPROVED" } }, take: 30 }),
    prisma.rFI.findMany({ where: { projectId, status: { not: "CLOSED" } }, take: 30 }),
  ]);

  const ppcTrend = computePpcTrend(recentCommitments);
  const latestPpc = ppcTrend[ppcTrend.length - 1];

  const taskLines = tasks
    .map(
      (t) =>
        `- "${t.name}" [${TASK_STATUS_LABELS[t.status]}] ${formatDate(t.startDate)}–${formatDate(t.endDate)}, assigned to ${t.assignedTo?.user.name ?? "unassigned"}${t.isRoadblock ? ` — ROADBLOCK: ${t.roadblockNote ?? ""}` : ""}`
    )
    .join("\n");

  const roadblockLines = openRoadblocks
    .map(
      (t) =>
        `- "${t.name}": ${t.roadblockNote ?? "(no note)"} [type: ${t.roadblockType ? ROADBLOCK_TYPE_LABELS[t.roadblockType] : "n/a"}, owner: ${t.roadblockOwner?.user.name ?? "unassigned"}, due: ${t.roadblockDueDate ? formatDate(t.roadblockDueDate) : "n/a"}]`
    )
    .join("\n");

  const submittalLines = openSubmittals.map((s) => `- "${s.title}" [${s.status}]${s.dueDate ? `, due ${formatDate(s.dueDate)}` : ""}`).join("\n");
  const rfiLines = openRfis.map((r) => `- "${r.question}" [${r.status}]${r.dueDate ? `, due ${formatDate(r.dueDate)}` : ""}`).join("\n");

  return `PROJECT: ${project.name} (${formatDate(project.startDate)} to ${formatDate(project.endDate)})

Most recent weekly PPC: ${latestPpc ? `${latestPpc.ppc}% (week of ${formatDate(latestPpc.weekStart)})` : "no commitments recorded yet"}

TASKS (${tasks.length} total):
${taskLines || "(none)"}

OPEN ROADBLOCKS (${openRoadblocks.length}):
${roadblockLines || "(none)"}

OPEN SUBMITTALS (${openSubmittals.length}):
${submittalLines || "(none)"}

OPEN RFIS (${openRfis.length}):
${rfiLines || "(none)"}`;
}

/** Portfolio-wide snapshot for the active organization, with optional deep-dive on one project. */
async function buildOrgContext(organizationId: string, focusProjectId?: string): Promise<string> {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
  const projects = await prisma.project.findMany({
    where: { organizationId, isArchived: false },
    orderBy: { name: "asc" },
  });

  const summaries = await Promise.all(
    projects.map(async (project) => ({ project, summary: await loadProjectSummary(project.id) }))
  );

  const portfolioLines = summaries
    .map(({ project, summary }) => {
      const variance =
        summary.variance === null
          ? "variance n/a"
          : summary.variance <= 0
            ? summary.variance === 0
              ? "on track"
              : `${Math.abs(summary.variance)}d ahead`
            : `${summary.variance}d behind`;
      return (
        `- "${project.name}": ${summary.percentComplete}% complete, PPC ${summary.ppc ?? "n/a"}%, PRR ${summary.prr ?? "n/a"}%, ` +
        `${summary.openRoadblocks} open roadblocks, health score ${summary.healthScore ?? "n/a"}, ${variance}, ` +
        `${formatDate(project.startDate)}–${formatDate(project.endDate)}`
      );
    })
    .join("\n");

  const totals = summaries.reduce(
    (acc, { summary }) => ({
      openRoadblocks: acc.openRoadblocks + summary.openRoadblocks,
      healthScores: summary.healthScore !== null ? [...acc.healthScores, summary.healthScore] : acc.healthScores,
    }),
    { openRoadblocks: 0, healthScores: [] as number[] }
  );
  const avgHealth =
    totals.healthScores.length > 0
      ? Math.round(totals.healthScores.reduce((a, b) => a + b, 0) / totals.healthScores.length)
      : null;

  let focusBlock = "";
  if (focusProjectId && projects.some((p) => p.id === focusProjectId)) {
    focusBlock = `\n\nCURRENT PROJECT (user is viewing this project — detailed data):\n${await buildProjectContext(focusProjectId)}`;
  }

  return `ORGANIZATION: ${org.name}
PORTFOLIO SUMMARY: ${projects.length} active project(s), ${totals.openRoadblocks} total open roadblocks, avg health score ${avgHealth ?? "n/a"}

PROJECTS:
${portfolioLines || "(none)"}${focusBlock}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Pulls a human-readable message out of OpenRouter's (variably-shaped) error body. */
function extractErrorMessage(rawBody: string): string | null {
  try {
    const parsed = JSON.parse(rawBody);
    const raw = parsed?.error?.metadata?.raw;
    if (typeof raw === "string") return raw;
    if (typeof parsed?.error?.message === "string") return parsed.error.message;
  } catch {
    // not JSON — fall through
  }
  return null;
}

const SYSTEM_PROMPT =
  "You are BuilderBridge's in-app assistant for construction teams. " +
  "You have the user's organization portfolio data below; when a current project is highlighted, you also have detailed task, roadblock, submittal, and RFI data for that project. " +
  "Your main job: help with schedules, roadblocks, commitments, portfolio health, and construction planning. " +
  "For project questions, use the provided data and cite specific project names, tasks, dates, or people when relevant. " +
  "For general construction or scheduling questions, answer briefly from your own knowledge. " +
  "For unrelated off-topic questions (politics, celebrities, trivia, etc.), give a one-sentence answer if you know it, then offer to help with their projects — do not write long disclaimers or lecture the user. " +
  "Style: plain conversational text only. Never use markdown symbols: no asterisks, no hash signs, no backticks, no bullet dashes. Write normal sentences and short paragraphs. No emojis. Keep answers short unless the user asks for detail.\n\n";

async function callOpenRouter(
  context: string,
  question: string,
  history: AssistantMessage[] = [],
  attempt = 1
): Promise<Response> {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENROUTER_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT + context },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: question },
      ],
      temperature: 0.3,
    }),
  });

  // Free-tier models on OpenRouter get shared rate limits — a single quick
  // retry smooths over most transient 429s without the user noticing.
  if (res.status === 429 && attempt < 2) {
    await sleep(1500);
    return callOpenRouter(context, question, history, attempt + 1);
  }

  return res;
}

async function parseAssistantResponse(res: Response): Promise<string> {
  if (!res.ok) {
    const rawBody = await res.text().catch(() => "");
    const detail = extractErrorMessage(rawBody);
    if (res.status === 429) {
      const isFreeTier = env.OPENROUTER_MODEL.endsWith(":free") || env.OPENROUTER_MODEL === "openrouter/free";
      throw new Error(
        `The assistant's free model is rate-limited right now (this happens under shared demand on the free tier). ` +
          `Please try again in a moment${isFreeTier ? ", or add credit to your OpenRouter account for dedicated rate limits" : ""}.`
      );
    }
    throw new Error(detail ? `Assistant request failed: ${detail}` : `Assistant request failed (${res.status}).`);
  }

  const data = await res.json();
  const answer = data?.choices?.[0]?.message?.content;
  if (typeof answer !== "string" || !answer.trim()) {
    throw new Error("The assistant returned an empty response — please try again.");
  }
  return stripAssistantMarkdown(answer.trim());
}

export async function answerAssistantQuestion(
  organizationId: string,
  question: string,
  options?: { focusProjectId?: string; history?: AssistantMessage[] }
): Promise<string> {
  if (!env.OPENROUTER_API_KEY) {
    throw new AssistantNotConfiguredError(
      "The AI Assistant isn't configured yet — an OPENROUTER_API_KEY is needed in the environment."
    );
  }

  const context = await buildOrgContext(organizationId, options?.focusProjectId);
  const res = await callOpenRouter(context, question, options?.history ?? []);
  return parseAssistantResponse(res);
}

/** @deprecated Use answerAssistantQuestion — kept for any legacy callers. */
export async function answerScheduleQuestion(projectId: string, question: string): Promise<string> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  return answerAssistantQuestion(project.organizationId, question, { focusProjectId: projectId });
}
