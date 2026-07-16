import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { loadProjectSummary } from "@/lib/project-summary";
import {
  createRoadblockActionProposal,
  createProjectControlActionProposal,
  createScheduleActionProposal,
  createTaskActionProposal,
} from "@/lib/assistant-actions";
import { MS_PER_DAY } from "@/lib/schedule-impact";
import { formatDate, ROADBLOCK_TYPE_LABELS, TASK_STATUS_LABELS } from "@/lib/utils";
import { searchProjectDocuments } from "@/lib/project-document-search";

type AssistantToolContext = {
  organizationId: string;
  userId: string;
  conversationId: string;
  focusProjectId?: string;
};

type NamedTask = { name: string };

function normalizeSearchText(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function taskNameScore(name: string, query: string) {
  const normalizedName = normalizeSearchText(name);
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedName || !normalizedQuery) return 0;
  if (normalizedName === normalizedQuery) return 1;
  if (normalizedName.includes(normalizedQuery) || normalizedQuery.includes(normalizedName)) return 0.9;

  const nameTokens = new Set(normalizedName.split(" "));
  const queryTokens = new Set(normalizedQuery.split(" "));
  const overlap = [...queryTokens].filter((token) => nameTokens.has(token)).length;
  if (overlap === 0) return 0;

  return overlap / queryTokens.size * 0.75 + overlap / nameTokens.size * 0.25;
}

export function rankTaskNameMatches<T extends NamedTask>(tasks: T[], query: string, limit = 5) {
  return tasks
    .map((task) => ({ task, score: taskNameScore(task.name, query) }))
    .filter(({ score }) => score >= 0.3)
    .sort((left, right) => right.score - left.score || left.task.name.localeCompare(right.task.name))
    .slice(0, limit);
}

const projectInput = {
  projectId: z
    .string()
    .optional()
    .describe("The exact BuilderBridge project ID from the portfolio context. Omit inside a project conversation."),
};

async function resolveProject(context: AssistantToolContext, requestedProjectId?: string) {
  const projectId = context.focusProjectId ?? requestedProjectId;
  if (!projectId) throw new Error("Choose a project before using this tool.");

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      organizationId: context.organizationId,
      isArchived: false,
      members: { some: { userId: context.userId } },
    },
  });
  if (!project) throw new Error("Project is unavailable or you no longer have access.");
  return project;
}

export function createAssistantTools(context: AssistantToolContext) {
  return {
    searchProjectDocuments: tool({
      description:
        "Search extracted text from secure project PDF files. Use this before answering what an uploaded file, report, specification, drawing PDF, or project document says. Cite only the returned source files and do not infer text that is absent from the snippets.",
      inputSchema: z.object({
        ...projectInput,
        query: z.string().trim().min(1).max(500).describe("The user's document question or search phrase."),
      }),
      execute: async ({ projectId, query }) => {
        const project = await resolveProject(context, projectId);
        const matches = await searchProjectDocuments(project.id, query);
        const uniqueSources = [
          ...new Map(
            matches.map((match) => [
              `${match.documentId}:${match.pageNumber}`,
              { label: `${match.fileName} - Page ${match.pageNumber}`, href: match.href },
            ])
          ).values(),
        ];
        return {
          kind: "document-search",
          title: `${project.name} document search`,
          query,
          matches: matches.map((match) => ({
            fileName: match.fileName,
            snippet: match.snippet,
            pageCount: match.pageCount,
            pageNumber: match.pageNumber,
          })),
          message:
            matches.length > 0
              ? "Answer only from these extracted snippets and cite the supporting file and page number."
              : "No searchable project document text matched this question.",
          sources: uniqueSources,
        };
      },
    }),

    searchProjectTasks: tool({
      description:
        "Find BuilderBridge tasks by natural-language name and return close suggestions when there is no direct match. Task IDs are internal and must never be mentioned to the user.",
      inputSchema: z.object({
        ...projectInput,
        query: z.string().trim().max(100).optional().describe("A task name or partial task name."),
      }),
      execute: async ({ projectId, query }) => {
        const project = await resolveProject(context, projectId);
        const allTasks = await prisma.task.findMany({
          where: {
            projectId: project.id,
          },
          include: {
            assignedTo: { include: { user: { select: { name: true } } } },
            roadblockOwner: { include: { user: { select: { name: true } } } },
          },
          orderBy: [{ startDate: "asc" }, { sequenceOrder: "asc" }],
          take: 200,
        });
        const rankedTasks = query
          ? rankTaskNameMatches(allTasks, query, 5)
          : allTasks.slice(0, 20).map((task) => ({ task, score: 1 }));
        const normalizedQuery = query ? normalizeSearchText(query) : "";
        const exactMatch = rankedTasks.find(
          ({ task }) => normalizeSearchText(task.name) === normalizedQuery
        );
        return {
          kind: "task-search",
          title: `${project.name} tasks`,
          query: query ?? null,
          match: exactMatch ? "exact" : rankedTasks.length > 0 ? "suggested" : "none",
          tasks: rankedTasks.map(({ task, score }) => ({
            id: task.id,
            name: task.name,
            matchScore: Number(score.toFixed(2)),
            status: TASK_STATUS_LABELS[task.status],
            assignee: task.assignedTo?.user.name ?? null,
            startDate: formatDate(task.startDate),
            endDate: formatDate(task.endDate),
            isRoadblock: task.isRoadblock && task.roadblockStatus === "OPEN",
            roadblockOwner: task.roadblockOwner?.user.name ?? null,
            href: `/projects/${project.id}/tasks/${task.id}`,
          })),
          sources: [{ label: `${project.name} schedule`, href: `/projects/${project.id}/gantt` }],
        };
      },
    }),

    getProjectMembers: tool({
      description:
        "Find a project member by their natural-language name before proposing an owner assignment. Member IDs are internal and must never be mentioned to the user.",
      inputSchema: z.object({
        ...projectInput,
        query: z.string().trim().max(100).optional().describe("The member name supplied by the user."),
      }),
      execute: async ({ projectId, query }) => {
        const project = await resolveProject(context, projectId);
        const members = await prisma.projectMember.findMany({
          where: {
            projectId: project.id,
            ...(query
              ? {
                  OR: [
                    { user: { name: { contains: query, mode: "insensitive" } } },
                    { user: { email: { contains: query, mode: "insensitive" } } },
                  ],
                }
              : {}),
          },
          include: { user: { select: { name: true, email: true } } },
          orderBy: [{ role: "asc" }, { user: { name: "asc" } }],
        });
        return {
          kind: "project-members",
          title: `${project.name} members`,
          query: query ?? null,
          match: members.length === 1 ? "unique" : members.length > 1 ? "ambiguous" : "none",
          members: members.map((member) => ({
            id: member.id,
            name: member.user.name,
            email: member.user.email,
            role: member.role,
          })),
          sources: [{ label: `${project.name} members`, href: `/projects/${project.id}/members` }],
        };
      },
    }),

    proposeRoadblockChange: tool({
      description:
        "Prepare, but do not apply, a user-confirmable roadblock proposal from natural task and member names. This tool resolves names itself. The user must confirm the rendered proposal before project data changes.",
      inputSchema: z.object({
        ...projectInput,
        taskName: z.string().trim().min(1).max(200).describe("The human-readable task name."),
        note: z.string().trim().min(1).max(500).optional(),
        roadblockType: z
          .enum(["CHANGE_ORDER", "INSPECTION", "LABOR", "MATERIAL", "WEATHER", "OTHER"])
          .optional(),
        ownerName: z
          .string()
          .nullable()
          .optional()
          .describe("The human-readable project member name. Null explicitly clears the owner."),
        dueDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable()
          .optional()
          .describe("Need-by date in YYYY-MM-DD. Null explicitly clears it."),
      }),
      execute: async ({ projectId, taskName, ownerName, ...change }) => {
        const project = await resolveProject(context, projectId);
        const tasks = await prisma.task.findMany({
          where: { projectId: project.id },
          select: { id: true, name: true },
          orderBy: [{ startDate: "asc" }, { sequenceOrder: "asc" }],
          take: 200,
        });
        const taskMatches = rankTaskNameMatches(tasks, taskName, 3);
        const [bestTask, secondTask] = taskMatches;
        const taskIsUnambiguous =
          bestTask &&
          (bestTask.score === 1 ||
            (bestTask.score >= 0.85 && (!secondTask || bestTask.score - secondTask.score >= 0.15)));

        if (!taskIsUnambiguous) {
          return {
            kind: "action-clarification",
            subject: "task",
            message:
              taskMatches.length > 0
                ? `I couldn't find an exact task named “${taskName}”. Did you mean ${taskMatches
                    .map(({ task }) => `“${task.name}”`)
                    .join(" or ")}?`
                : `I couldn't find a task matching “${taskName}”.`,
            suggestions: taskMatches.map(({ task }) => task.name),
            sources: [{ label: `${project.name} schedule`, href: `/projects/${project.id}/gantt` }],
          };
        }

        let ownerMemberId: string | null | undefined;
        if (ownerName === null) {
          ownerMemberId = null;
        } else if (ownerName) {
          const normalizedOwnerName = normalizeSearchText(ownerName);
          const members = await prisma.projectMember.findMany({
            where: { projectId: project.id },
            include: { user: { select: { name: true } } },
            orderBy: { user: { name: "asc" } },
          });
          const ownerMatches = members.filter((member) => {
            const memberName = normalizeSearchText(member.user.name);
            return memberName === normalizedOwnerName || memberName.includes(normalizedOwnerName);
          });

          if (ownerMatches.length !== 1) {
            return {
              kind: "action-clarification",
              subject: "owner",
              message:
                ownerMatches.length > 1
                  ? `I found more than one project member matching “${ownerName}”. Which one did you mean?`
                  : `I couldn't find a project member matching “${ownerName}”.`,
              suggestions: ownerMatches.slice(0, 3).map((member) => member.user.name),
              sources: [{ label: `${project.name} members`, href: `/projects/${project.id}/members` }],
            };
          }
          ownerMemberId = ownerMatches[0].id;
        }

        return createRoadblockActionProposal(
          {
            ...change,
            conversationId: context.conversationId,
            taskId: bestTask.task.id,
            ownerMemberId,
          },
          { organizationId: context.organizationId, userId: context.userId }
        );
      },
    }),

    proposeRfiChange: tool({
      description:
        "Prepare, but do not apply, a user-confirmable RFI creation, answer, or close action. Resolve the RFI and optional linked task from human-readable text; never ask for an internal ID.",
      inputSchema: z.object({
        ...projectInput,
        operation: z.enum(["CREATE", "ANSWER", "CLOSE"]),
        question: z.string().trim().min(1).max(1000).describe("The new RFI question or identifying text from an existing RFI."),
        answer: z.string().trim().min(1).max(2000).optional(),
        taskName: z.string().trim().min(1).max(200).optional(),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      }),
      execute: async ({ projectId, operation, question, answer, taskName, dueDate }) => {
        const project = await resolveProject(context, projectId);
        let recordId: string | undefined;
        if (operation !== "CREATE") {
          const records = await prisma.rFI.findMany({
            where: { projectId: project.id },
            select: { id: true, question: true, status: true, source: true },
            orderBy: { createdAt: "desc" },
            take: 200,
          });
          const matches = rankTaskNameMatches(
            records.map((record) => ({ ...record, name: record.question })),
            question,
            3
          );
          const [best, second] = matches;
          const unambiguous = best &&
            (best.score === 1 || (best.score >= 0.85 && (!second || best.score - second.score >= 0.15)));
          if (!unambiguous) {
            return {
              kind: "action-clarification",
              subject: "RFI",
              message: matches.length > 0
                ? `Which RFI did you mean: ${matches.map(({ task }) => `“${task.question}”`).join(" or ")}?`
                : `I couldn't find an RFI matching “${question}”.`,
              suggestions: matches.map(({ task }) => task.question),
              sources: [{ label: `${project.name} RFI log`, href: `/projects/${project.id}/rfis` }],
            };
          }
          if (best.task.source !== "NATIVE") {
            return {
              kind: "action-clarification",
              subject: "RFI",
              message: "That RFI is synced from Procore and must be updated there.",
              suggestions: [],
              sources: [{ label: `${project.name} RFI log`, href: `/projects/${project.id}/rfis` }],
            };
          }
          recordId = best.task.id;
        }

        let taskId: string | null | undefined;
        if (operation === "CREATE" && taskName) {
          const tasks = await prisma.task.findMany({
            where: { projectId: project.id },
            select: { id: true, name: true },
            orderBy: [{ startDate: "asc" }, { sequenceOrder: "asc" }],
          });
          const matches = rankTaskNameMatches(tasks, taskName, 3);
          const [best, second] = matches;
          const unambiguous = best &&
            (best.score === 1 || (best.score >= 0.85 && (!second || best.score - second.score >= 0.15)));
          if (!unambiguous) {
            return {
              kind: "action-clarification",
              subject: "task",
              message: matches.length > 0
                ? `Which linked task did you mean: ${matches.map(({ task }) => `“${task.name}”`).join(" or ")}?`
                : `I couldn't find a task matching “${taskName}”.`,
              suggestions: matches.map(({ task }) => task.name),
              sources: [{ label: `${project.name} schedule`, href: `/projects/${project.id}/gantt` }],
            };
          }
          taskId = best.task.id;
        }
        if (operation === "ANSWER" && !answer) {
          return {
            kind: "action-clarification",
            subject: "answer",
            message: "What answer should I record for this RFI?",
            suggestions: [],
            sources: [{ label: `${project.name} RFI log`, href: `/projects/${project.id}/rfis` }],
          };
        }
        return createProjectControlActionProposal(
          {
            conversationId: context.conversationId,
            projectId: project.id,
            entity: "RFI",
            operation: operation === "CREATE" ? "CREATE" : "UPDATE",
            recordId,
            taskId,
            question: operation === "CREATE" ? question : undefined,
            answer: operation === "ANSWER" ? answer : undefined,
            status: operation === "CLOSE" ? "CLOSED" : operation === "ANSWER" ? "ANSWERED" : "OPEN",
            dueDate: operation === "CREATE" ? dueDate : undefined,
          },
          { organizationId: context.organizationId, userId: context.userId }
        );
      },
    }),

    proposeSubmittalChange: tool({
      description:
        "Prepare, but do not apply, a user-confirmable submittal creation or status decision. Resolve the submittal and optional linked task from human-readable text; never ask for an internal ID.",
      inputSchema: z.object({
        ...projectInput,
        operation: z.enum(["CREATE", "UPDATE_STATUS"]),
        title: z.string().trim().min(1).max(200).describe("The new submittal title or identifying text from an existing submittal."),
        specSection: z.string().trim().max(50).nullable().optional(),
        taskName: z.string().trim().min(1).max(200).optional(),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        status: z.enum(["PENDING", "APPROVED", "REJECTED", "REVISE_RESUBMIT"]).optional(),
      }),
      execute: async ({ projectId, operation, title, specSection, taskName, dueDate, status }) => {
        const project = await resolveProject(context, projectId);
        let recordId: string | undefined;
        if (operation === "UPDATE_STATUS") {
          if (!status) {
            return {
              kind: "action-clarification",
              subject: "status",
              message: "Should this submittal be approved, rejected, or marked revise and resubmit?",
              suggestions: ["Approved", "Rejected", "Revise and resubmit"],
              sources: [{ label: `${project.name} submittals`, href: `/projects/${project.id}/submittals` }],
            };
          }
          const records = await prisma.submittal.findMany({
            where: { projectId: project.id },
            select: { id: true, title: true, source: true },
            orderBy: { createdAt: "desc" },
            take: 200,
          });
          const matches = rankTaskNameMatches(
            records.map((record) => ({ ...record, name: record.title })),
            title,
            3
          );
          const [best, second] = matches;
          const unambiguous = best &&
            (best.score === 1 || (best.score >= 0.85 && (!second || best.score - second.score >= 0.15)));
          if (!unambiguous) {
            return {
              kind: "action-clarification",
              subject: "submittal",
              message: matches.length > 0
                ? `Which submittal did you mean: ${matches.map(({ task }) => `“${task.title}”`).join(" or ")}?`
                : `I couldn't find a submittal matching “${title}”.`,
              suggestions: matches.map(({ task }) => task.title),
              sources: [{ label: `${project.name} submittals`, href: `/projects/${project.id}/submittals` }],
            };
          }
          if (best.task.source !== "NATIVE") {
            return {
              kind: "action-clarification",
              subject: "submittal",
              message: "That submittal is synced from Procore and must be updated there.",
              suggestions: [],
              sources: [{ label: `${project.name} submittals`, href: `/projects/${project.id}/submittals` }],
            };
          }
          recordId = best.task.id;
        }

        let taskId: string | null | undefined;
        if (operation === "CREATE" && taskName) {
          const tasks = await prisma.task.findMany({
            where: { projectId: project.id },
            select: { id: true, name: true },
            orderBy: [{ startDate: "asc" }, { sequenceOrder: "asc" }],
          });
          const matches = rankTaskNameMatches(tasks, taskName, 3);
          const [best, second] = matches;
          const unambiguous = best &&
            (best.score === 1 || (best.score >= 0.85 && (!second || best.score - second.score >= 0.15)));
          if (!unambiguous) {
            return {
              kind: "action-clarification",
              subject: "task",
              message: matches.length > 0
                ? `Which linked task did you mean: ${matches.map(({ task }) => `“${task.name}”`).join(" or ")}?`
                : `I couldn't find a task matching “${taskName}”.`,
              suggestions: matches.map(({ task }) => task.name),
              sources: [{ label: `${project.name} schedule`, href: `/projects/${project.id}/gantt` }],
            };
          }
          taskId = best.task.id;
        }
        return createProjectControlActionProposal(
          {
            conversationId: context.conversationId,
            projectId: project.id,
            entity: "SUBMITTAL",
            operation: operation === "CREATE" ? "CREATE" : "UPDATE",
            recordId,
            taskId,
            title: operation === "CREATE" ? title : undefined,
            specSection: operation === "CREATE" ? specSection : undefined,
            dueDate: operation === "CREATE" ? dueDate : undefined,
            status: operation === "CREATE" ? "PENDING" : status,
          },
          { organizationId: context.organizationId, userId: context.userId }
        );
      },
    }),

    proposeTaskChange: tool({
      description:
        "Prepare, but do not apply, a user-confirmable task creation or update from natural task and member names. Supports name, dates, status, progress, assignee, and an append-only field note.",
      inputSchema: z.object({
        ...projectInput,
        operation: z.enum(["CREATE", "UPDATE"]),
        taskName: z.string().trim().min(1).max(200).describe("Existing task name for UPDATE, or new task name for CREATE."),
        newName: z.string().trim().min(1).max(200).optional(),
        assignedToName: z.string().trim().min(1).max(100).nullable().optional(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        status: z.enum(["NOT_STARTED", "IN_PROGRESS", "DONE", "DELAYED"]).optional(),
        progress: z.number().int().min(0).max(100).optional(),
        note: z.string().trim().min(1).max(1000).optional(),
      }),
      execute: async ({ projectId, operation, taskName, assignedToName, newName, ...change }) => {
        const project = await resolveProject(context, projectId);
        if (operation === "CREATE" && (!change.startDate || !change.endDate)) {
          return {
            kind: "action-clarification",
            subject: "dates",
            message: `What start and end dates should I use for “${newName ?? taskName}”?`,
            suggestions: [],
            sources: [{ label: `${project.name} schedule`, href: `/projects/${project.id}/gantt` }],
          };
        }
        let taskId: string | undefined;
        if (operation === "UPDATE") {
          const tasks = await prisma.task.findMany({
            where: { projectId: project.id },
            select: { id: true, name: true },
            orderBy: [{ startDate: "asc" }, { sequenceOrder: "asc" }],
            take: 200,
          });
          const taskMatches = rankTaskNameMatches(tasks, taskName, 3);
          const [bestTask, secondTask] = taskMatches;
          const taskIsUnambiguous =
            bestTask &&
            (bestTask.score === 1 ||
              (bestTask.score >= 0.85 && (!secondTask || bestTask.score - secondTask.score >= 0.15)));
          if (!taskIsUnambiguous) {
            return {
              kind: "action-clarification",
              subject: "task",
              message:
                taskMatches.length > 0
                  ? `I couldn't identify one task named “${taskName}”. Did you mean ${taskMatches
                      .map(({ task }) => `“${task.name}”`)
                      .join(" or ")}?`
                  : `I couldn't find a task matching “${taskName}”.`,
              suggestions: taskMatches.map(({ task }) => task.name),
              sources: [{ label: `${project.name} schedule`, href: `/projects/${project.id}/gantt` }],
            };
          }
          taskId = bestTask.task.id;
        }

        let assignedToId: string | null | undefined;
        if (assignedToName === null) {
          assignedToId = null;
        } else if (assignedToName) {
          const normalizedAssignee = normalizeSearchText(assignedToName);
          const members = await prisma.projectMember.findMany({
            where: { projectId: project.id },
            include: { user: { select: { name: true } } },
            orderBy: { user: { name: "asc" } },
          });
          const matches = members.filter((member) => {
            const name = normalizeSearchText(member.user.name);
            return name === normalizedAssignee || name.includes(normalizedAssignee);
          });
          if (matches.length !== 1) {
            return {
              kind: "action-clarification",
              subject: "assignee",
              message:
                matches.length > 1
                  ? `I found more than one project member matching “${assignedToName}”. Which one did you mean?`
                  : `I couldn't find a project member matching “${assignedToName}”.`,
              suggestions: matches.slice(0, 3).map((member) => member.user.name),
              sources: [{ label: `${project.name} members`, href: `/projects/${project.id}/members` }],
            };
          }
          assignedToId = matches[0].id;
        }

        return createTaskActionProposal(
          {
            ...change,
            conversationId: context.conversationId,
            projectId: project.id,
            operation,
            taskId,
            name: newName ?? taskName,
            assignedToId,
          },
          { organizationId: context.organizationId, userId: context.userId }
        );
      },
    }),

    proposeScheduleChange: tool({
      description:
        "Prepare, but do not apply, a dependency edit, bulk date shift, or dependency-aware what-if reflow. Use REFLOW_SUCCESSORS when a task delay/date change should automatically move only the downstream work required to preserve finish-to-start logic.",
      inputSchema: z.object({
        ...projectInput,
        operation: z.enum([
          "ADD_DEPENDENCY",
          "REMOVE_DEPENDENCY",
          "SHIFT_TASKS",
          "REFLOW_SUCCESSORS",
        ]),
        predecessorTaskName: z.string().trim().min(1).max(200).optional(),
        successorTaskName: z.string().trim().min(1).max(200).optional(),
        anchorTaskName: z.string().trim().min(1).max(200).optional(),
        taskNames: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
        scope: z.enum(["NAMED_TASKS", "ALL_TASKS", "ALL_INCOMPLETE", "STATUS"]).optional(),
        status: z.enum(["NOT_STARTED", "IN_PROGRESS", "DONE", "DELAYED"]).optional(),
        shiftDays: z.number().int().min(-365).max(365).optional(),
        newStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        newEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }),
      execute: async ({
        projectId,
        operation,
        predecessorTaskName,
        successorTaskName,
        anchorTaskName,
        taskNames,
        scope,
        status,
        shiftDays,
        newStartDate,
        newEndDate,
      }) => {
        const project = await resolveProject(context, projectId);
        const tasks = await prisma.task.findMany({
          where: { projectId: project.id },
          select: { id: true, name: true, status: true, startDate: true, endDate: true },
          orderBy: [{ startDate: "asc" }, { sequenceOrder: "asc" }],
        });

        function resolveTaskName(name: string) {
          const matches = rankTaskNameMatches(tasks, name, 3);
          const [best, second] = matches;
          const unambiguous =
            best &&
            (best.score === 1 || (best.score >= 0.85 && (!second || best.score - second.score >= 0.15)));
          return { matches, task: unambiguous ? best.task : null };
        }

        if (operation === "ADD_DEPENDENCY" || operation === "REMOVE_DEPENDENCY") {
          if (!predecessorTaskName || !successorTaskName) {
            return {
              kind: "action-clarification",
              subject: "dependency",
              message: "Which task is the predecessor, and which task should depend on it?",
              suggestions: [],
              sources: [{ label: `${project.name} schedule`, href: `/projects/${project.id}/gantt` }],
            };
          }
          const predecessor = resolveTaskName(predecessorTaskName);
          const successor = resolveTaskName(successorTaskName);
          if (!predecessor.task || !successor.task) {
            const unresolved = !predecessor.task ? predecessor : successor;
            const requestedName = !predecessor.task ? predecessorTaskName : successorTaskName;
            return {
              kind: "action-clarification",
              subject: "task",
              message:
                unresolved.matches.length > 0
                  ? `I couldn't identify one task named “${requestedName}”. Did you mean ${unresolved.matches
                      .map(({ task }) => `“${task.name}”`)
                      .join(" or ")}?`
                  : `I couldn't find a task matching “${requestedName}”.`,
              suggestions: unresolved.matches.map(({ task }) => task.name),
              sources: [{ label: `${project.name} schedule`, href: `/projects/${project.id}/gantt` }],
            };
          }
          return createScheduleActionProposal(
            {
              conversationId: context.conversationId,
              projectId: project.id,
              operation,
              predecessorId: predecessor.task.id,
              successorId: successor.task.id,
            },
            { organizationId: context.organizationId, userId: context.userId }
          );
        }

        if (operation === "REFLOW_SUCCESSORS") {
          if (!anchorTaskName) {
            return {
              kind: "action-clarification",
              subject: "task",
              message: "Which task should I move and use as the start of the downstream reflow?",
              suggestions: [],
              sources: [{ label: `${project.name} schedule`, href: `/projects/${project.id}/gantt` }],
            };
          }
          const resolved = resolveTaskName(anchorTaskName);
          if (!resolved.task) {
            return {
              kind: "action-clarification",
              subject: "task",
              message:
                resolved.matches.length > 0
                  ? `I couldn't identify one task named â€œ${anchorTaskName}â€. Did you mean ${resolved.matches
                      .map(({ task }) => `â€œ${task.name}â€`)
                      .join(" or ")}?`
                  : `I couldn't find a task matching â€œ${anchorTaskName}â€.`,
              suggestions: resolved.matches.map(({ task }) => task.name),
              sources: [{ label: `${project.name} schedule`, href: `/projects/${project.id}/gantt` }],
            };
          }

          const dateAtNoon = (value: string) => new Date(`${value}T12:00:00.000Z`);
          const startDelta = newStartDate
            ? Math.round((dateAtNoon(newStartDate).getTime() - resolved.task.startDate.getTime()) / MS_PER_DAY)
            : undefined;
          const endDelta = newEndDate
            ? Math.round((dateAtNoon(newEndDate).getTime() - resolved.task.endDate.getTime()) / MS_PER_DAY)
            : undefined;
          if (startDelta !== undefined && endDelta !== undefined && startDelta !== endDelta) {
            return {
              kind: "action-clarification",
              subject: "dates",
              message: "Those start and finish dates change the task duration. Give me one target date, or dates that preserve its current duration.",
              suggestions: [],
              sources: [{ label: `${project.name} schedule`, href: `/projects/${project.id}/gantt` }],
            };
          }
          const effectiveShiftDays = shiftDays ?? startDelta ?? endDelta;
          if (!effectiveShiftDays) {
            return {
              kind: "action-clarification",
              subject: "shift",
              message: "How many days should the task move, or what new start or finish date should I simulate?",
              suggestions: [],
              sources: [{ label: `${project.name} schedule`, href: `/projects/${project.id}/gantt` }],
            };
          }
          return createScheduleActionProposal(
            {
              conversationId: context.conversationId,
              projectId: project.id,
              operation,
              anchorTaskId: resolved.task.id,
              shiftDays: effectiveShiftDays,
            },
            { organizationId: context.organizationId, userId: context.userId }
          );
        }

        if (!shiftDays) {
          return {
            kind: "action-clarification",
            subject: "shift",
            message: "How many days should I shift the selected work? Use a negative number to move it earlier.",
            suggestions: [],
            sources: [{ label: `${project.name} schedule`, href: `/projects/${project.id}/gantt` }],
          };
        }

        let selectedTaskIds: string[] = [];
        const effectiveScope = scope ?? "NAMED_TASKS";
        if (effectiveScope === "ALL_TASKS") {
          selectedTaskIds = tasks.map((task) => task.id);
        } else if (effectiveScope === "ALL_INCOMPLETE") {
          selectedTaskIds = tasks.filter((task) => task.status !== "DONE").map((task) => task.id);
        } else if (effectiveScope === "STATUS") {
          if (!status) {
            return {
              kind: "action-clarification",
              subject: "status",
              message: "Which task status should I use for this bulk shift?",
              suggestions: ["Not started", "In progress", "Delayed", "Done"],
              sources: [{ label: `${project.name} schedule`, href: `/projects/${project.id}/gantt` }],
            };
          }
          selectedTaskIds = tasks.filter((task) => task.status === status).map((task) => task.id);
        } else {
          if (!taskNames?.length) {
            return {
              kind: "action-clarification",
              subject: "tasks",
              message: "Which tasks should I shift?",
              suggestions: [],
              sources: [{ label: `${project.name} schedule`, href: `/projects/${project.id}/gantt` }],
            };
          }
          for (const taskName of taskNames) {
            const resolved = resolveTaskName(taskName);
            if (!resolved.task) {
              return {
                kind: "action-clarification",
                subject: "task",
                message:
                  resolved.matches.length > 0
                    ? `I couldn't identify one task named “${taskName}”. Did you mean ${resolved.matches
                        .map(({ task }) => `“${task.name}”`)
                        .join(" or ")}?`
                    : `I couldn't find a task matching “${taskName}”.`,
                suggestions: resolved.matches.map(({ task }) => task.name),
                sources: [{ label: `${project.name} schedule`, href: `/projects/${project.id}/gantt` }],
              };
            }
            selectedTaskIds.push(resolved.task.id);
          }
        }

        if (selectedTaskIds.length === 0) {
          return {
            kind: "action-clarification",
            subject: "tasks",
            message: "No tasks match that bulk-shift scope.",
            suggestions: [],
            sources: [{ label: `${project.name} schedule`, href: `/projects/${project.id}/gantt` }],
          };
        }
        return createScheduleActionProposal(
          {
            conversationId: context.conversationId,
            projectId: project.id,
            operation,
            taskIds: [...new Set(selectedTaskIds)],
            shiftDays,
          },
          { organizationId: context.organizationId, userId: context.userId }
        );
      },
    }),

    getPortfolioHealth: tool({
      description:
        "Read live health, progress, PPC, PRR, schedule variance, and roadblock totals for every accessible project.",
      inputSchema: z.object({}),
      execute: async () => {
        const projects = await prisma.project.findMany({
          where: {
            organizationId: context.organizationId,
            isArchived: false,
            members: { some: { userId: context.userId } },
          },
          orderBy: { name: "asc" },
        });
        const summaries = await Promise.all(
          projects.map(async (project) => ({ project, summary: await loadProjectSummary(project.id) }))
        );
        return {
          kind: "portfolio-health",
          title: "Portfolio health",
          projects: summaries.map(({ project, summary }) => ({
            id: project.id,
            name: project.name,
            percentComplete: summary.percentComplete,
            ppc: summary.ppc,
            prr: summary.prr,
            healthScore: summary.healthScore,
            scheduleVarianceDays: summary.variance,
            openRoadblocks: summary.openRoadblocks,
            href: `/projects/${project.id}/dashboard`,
          })),
          sources: summaries.map(({ project }) => ({
            label: `${project.name} dashboard`,
            href: `/projects/${project.id}/dashboard`,
          })),
        };
      },
    }),

    getProjectOverview: tool({
      description:
        "Read a project's live progress, schedule variance, weekly reliability, roadblocks, and date range.",
      inputSchema: z.object(projectInput),
      execute: async ({ projectId }) => {
        const project = await resolveProject(context, projectId);
        const summary = await loadProjectSummary(project.id);
        return {
          kind: "project-overview",
          title: `${project.name} overview`,
          project: {
            id: project.id,
            name: project.name,
            startDate: formatDate(project.startDate),
            endDate: formatDate(project.endDate),
            percentComplete: summary.percentComplete,
            ppc: summary.ppc,
            prr: summary.prr,
            healthScore: summary.healthScore,
            scheduleVarianceDays: summary.variance,
            openRoadblocks: summary.openRoadblocks,
          },
          sources: [
            { label: `${project.name} dashboard`, href: `/projects/${project.id}/dashboard` },
            { label: "Master schedule", href: `/projects/${project.id}/gantt` },
            { label: "Weekly plan", href: `/projects/${project.id}/weekly-plan` },
          ],
        };
      },
    }),

    getScheduleRisks: tool({
      description:
        "Read delayed tasks and unresolved task roadblocks for a project, including owners and due dates.",
      inputSchema: z.object(projectInput),
      execute: async ({ projectId }) => {
        const project = await resolveProject(context, projectId);
        const risks = await prisma.task.findMany({
          where: {
            projectId: project.id,
            OR: [
              { status: "DELAYED" },
              { isRoadblock: true, roadblockStatus: "OPEN" },
            ],
          },
          include: {
            assignedTo: { include: { user: { select: { name: true } } } },
            roadblockOwner: { include: { user: { select: { name: true } } } },
          },
          orderBy: [{ roadblockDueDate: "asc" }, { startDate: "asc" }],
          take: 25,
        });
        return {
          kind: "schedule-risks",
          title: `${project.name} schedule risks`,
          count: risks.length,
          risks: risks.map((risk) => ({
            id: risk.id,
            name: risk.name,
            status: TASK_STATUS_LABELS[risk.status],
            startDate: formatDate(risk.startDate),
            endDate: formatDate(risk.endDate),
            assignee: risk.assignedTo?.user.name ?? null,
            roadblock: risk.roadblockNote,
            roadblockType: risk.roadblockType ? ROADBLOCK_TYPE_LABELS[risk.roadblockType] : null,
            roadblockOwner: risk.roadblockOwner?.user.name ?? null,
            roadblockDueDate: risk.roadblockDueDate ? formatDate(risk.roadblockDueDate) : null,
            href: `/projects/${project.id}/tasks/${risk.id}`,
          })),
          sources: [
            { label: "Master schedule", href: `/projects/${project.id}/gantt` },
            { label: "Roadblock log", href: `/projects/${project.id}/roadblocks` },
          ],
        };
      },
    }),

    getOpenItems: tool({
      description:
        "Read open roadblocks, RFIs, submittals, or schedule impact requests for one project.",
      inputSchema: z.object({
        ...projectInput,
        category: z.enum(["roadblocks", "rfis", "submittals", "impacts"]),
      }),
      execute: async ({ projectId, category }) => {
        const project = await resolveProject(context, projectId);
        const basePath = `/projects/${project.id}`;
        let items: Array<Record<string, string | null>> = [];
        const href = `${basePath}/${category}`;

        if (category === "roadblocks") {
          const records = await prisma.task.findMany({
            where: { projectId: project.id, isRoadblock: true, roadblockStatus: "OPEN" },
            include: { roadblockOwner: { include: { user: { select: { name: true } } } } },
            orderBy: { roadblockDueDate: "asc" },
            take: 30,
          });
          items = records.map((record) => ({
            id: record.id,
            title: record.name,
            status: "Open",
            detail: record.roadblockNote,
            owner: record.roadblockOwner?.user.name ?? null,
            dueDate: record.roadblockDueDate ? formatDate(record.roadblockDueDate) : null,
            href: `${basePath}/tasks/${record.id}`,
          }));
        } else if (category === "rfis") {
          const records = await prisma.rFI.findMany({
            where: { projectId: project.id, status: { not: "CLOSED" } },
            orderBy: { dueDate: "asc" },
            take: 30,
          });
          items = records.map((record) => ({
            id: record.id,
            title: record.question,
            status: record.status,
            detail: record.answer,
            owner: null,
            dueDate: record.dueDate ? formatDate(record.dueDate) : null,
            href,
          }));
        } else if (category === "submittals") {
          const records = await prisma.submittal.findMany({
            where: { projectId: project.id, status: { not: "APPROVED" } },
            orderBy: { dueDate: "asc" },
            take: 30,
          });
          items = records.map((record) => ({
            id: record.id,
            title: record.title,
            status: record.status,
            detail: record.specSection,
            owner: null,
            dueDate: record.dueDate ? formatDate(record.dueDate) : null,
            href,
          }));
        } else {
          const records = await prisma.scheduleImpactRequest.findMany({
            where: { projectId: project.id, status: "PENDING" },
            orderBy: { createdAt: "desc" },
            take: 30,
          });
          items = records.map((record) => ({
            id: record.id,
            title: record.description,
            status: record.status,
            detail: record.reviewNote,
            owner: null,
            dueDate: record.proposedNewEndDate ? formatDate(record.proposedNewEndDate) : null,
            href,
          }));
        }

        return {
          kind: "open-items",
          title: `${project.name} ${category}`,
          category,
          count: items.length,
          items,
          sources: [{ label: `${project.name} ${category}`, href }],
        };
      },
    }),
  };
}

export type AssistantTools = ReturnType<typeof createAssistantTools>;
