import { generateText } from "ai";
import { prisma } from "@/lib/prisma";
import { formatDate, TASK_STATUS_LABELS, ROADBLOCK_TYPE_LABELS } from "@/lib/utils";
import { computePpcTrend } from "@/lib/analytics";
import { loadProjectSummary } from "@/lib/project-summary";
import { stripAssistantMarkdown } from "@/lib/assistant-plain-text";
import { getOpenRouterModel } from "@/lib/openrouter";

export { AssistantNotConfiguredError } from "@/lib/openrouter";

export type AssistantMessage = { role: "user" | "assistant"; content: string };

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
      (task) =>
        `- "${task.name}" [${TASK_STATUS_LABELS[task.status]}] ${formatDate(task.startDate)}-${formatDate(task.endDate)}, assigned to ${task.assignedTo?.user.name ?? "unassigned"}${task.isRoadblock ? ` - ROADBLOCK: ${task.roadblockNote ?? ""}` : ""}`
    )
    .join("\n");
  const roadblockLines = openRoadblocks
    .map(
      (task) =>
        `- "${task.name}": ${task.roadblockNote ?? "(no note)"} [type: ${task.roadblockType ? ROADBLOCK_TYPE_LABELS[task.roadblockType] : "n/a"}, owner: ${task.roadblockOwner?.user.name ?? "unassigned"}, due: ${task.roadblockDueDate ? formatDate(task.roadblockDueDate) : "n/a"}]`
    )
    .join("\n");
  const submittalLines = openSubmittals
    .map((item) => `- "${item.title}" [${item.status}]${item.dueDate ? `, due ${formatDate(item.dueDate)}` : ""}`)
    .join("\n");
  const rfiLines = openRfis
    .map((item) => `- "${item.question}" [${item.status}]${item.dueDate ? `, due ${formatDate(item.dueDate)}` : ""}`)
    .join("\n");

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

export async function buildAssistantContext(organizationId: string, focusProjectId?: string): Promise<string> {
  const [organization, projects] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
    prisma.project.findMany({
      where: { organizationId, isArchived: false },
      orderBy: { name: "asc" },
    }),
  ]);
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
        `- "${project.name}": ${summary.percentComplete}% complete, PPC ${summary.ppc ?? "n/a"}%, ` +
        `PRR ${summary.prr ?? "n/a"}%, ${summary.openRoadblocks} open roadblocks, ` +
        `health score ${summary.healthScore ?? "n/a"}, ${variance}, ` +
        `${formatDate(project.startDate)}-${formatDate(project.endDate)}`
      );
    })
    .join("\n");
  const totals = summaries.reduce(
    (accumulator, { summary }) => ({
      openRoadblocks: accumulator.openRoadblocks + summary.openRoadblocks,
      healthScores:
        summary.healthScore !== null
          ? [...accumulator.healthScores, summary.healthScore]
          : accumulator.healthScores,
    }),
    { openRoadblocks: 0, healthScores: [] as number[] }
  );
  const averageHealth = totals.healthScores.length
    ? Math.round(totals.healthScores.reduce((total, value) => total + value, 0) / totals.healthScores.length)
    : null;
  const focusBlock =
    focusProjectId && projects.some((project) => project.id === focusProjectId)
      ? `\n\nCURRENT PROJECT (detailed data):\n${await buildProjectContext(focusProjectId)}`
      : "";

  return `ORGANIZATION: ${organization.name}
PORTFOLIO SUMMARY: ${projects.length} active project(s), ${totals.openRoadblocks} total open roadblocks, avg health score ${averageHealth ?? "n/a"}

PROJECTS:
${portfolioLines || "(none)"}${focusBlock}`;
}

export const ASSISTANT_SYSTEM_PROMPT =
  "You are BuilderBridge AI, an in-app construction planning assistant. " +
  "Use the supplied live organization and project data for schedules, roadblocks, commitments, portfolio health, submittals, and RFIs. " +
  "Never invent project facts. Name the project, task, date, or person that supports an answer when available. " +
  "If the data is insufficient, say exactly what is missing. You are read-only and must not claim to have changed project data. " +
  "Use concise, plain conversational text. Avoid markdown symbols and emojis unless the user explicitly requests a formatted response.\n\n";

export async function answerAssistantQuestion(
  organizationId: string,
  question: string,
  options?: { focusProjectId?: string; history?: AssistantMessage[] }
): Promise<string> {
  const context = await buildAssistantContext(organizationId, options?.focusProjectId);
  const { text } = await generateText({
    model: getOpenRouterModel(),
    system: ASSISTANT_SYSTEM_PROMPT + context,
    messages: [
      ...(options?.history ?? []).map((message) => ({ role: message.role, content: message.content })),
      { role: "user", content: question },
    ],
    temperature: 0.3,
    maxOutputTokens: 900,
  });

  if (!text.trim()) throw new Error("The assistant returned an empty response - please try again.");
  return stripAssistantMarkdown(text.trim());
}

/** @deprecated Use answerAssistantQuestion. */
export async function answerScheduleQuestion(projectId: string, question: string): Promise<string> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  return answerAssistantQuestion(project.organizationId, question, { focusProjectId: projectId });
}
