import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { formatDate, TASK_STATUS_LABELS, ROADBLOCK_TYPE_LABELS } from "@/lib/utils";
import { computePpcTrend } from "@/lib/analytics";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

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

async function callOpenRouter(context: string, question: string, attempt = 1): Promise<Response> {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENROUTER_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful construction scheduling assistant embedded in a project management tool. " +
            "Answer the user's question ONLY using the project data provided below. Be concise and specific " +
            "(cite task names, dates, and people where relevant). If the data doesn't contain the answer, say so " +
            "plainly rather than guessing.\n\n" +
            context,
        },
        { role: "user", content: question },
      ],
      temperature: 0.2,
    }),
  });

  // Free-tier models on OpenRouter get shared rate limits — a single quick
  // retry smooths over most transient 429s without the user noticing.
  if (res.status === 429 && attempt < 2) {
    await sleep(1500);
    return callOpenRouter(context, question, attempt + 1);
  }

  return res;
}

export async function answerScheduleQuestion(projectId: string, question: string): Promise<string> {
  if (!env.OPENROUTER_API_KEY) {
    throw new AssistantNotConfiguredError(
      "The Schedule Assistant isn't configured yet — an OPENROUTER_API_KEY is needed in the environment."
    );
  }

  const context = await buildProjectContext(projectId);
  const res = await callOpenRouter(context, question);

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
  return answer.trim();
}
