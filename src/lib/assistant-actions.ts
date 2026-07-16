import { z } from "zod";
import type {
  AssistantActionProposal,
  Prisma,
  RFI,
  RoadblockType,
  Submittal,
  Task,
  TaskStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  requireProjectMember,
  requireScheduleEditAccess,
  requireTaskEditAccess,
} from "@/lib/permissions";
import { formatDate, ROADBLOCK_TYPE_LABELS, TASK_STATUS_LABELS } from "@/lib/utils";
import { notifyUser } from "@/lib/notifications";
import { wouldCreateCycle } from "@/lib/critical-path";
import {
  analyzeScheduleImpact,
  computeScheduleCriticalTasks,
  projectFinish,
  shiftTaskByDays,
  simulateDownstreamReflow,
  type ScheduleImpactTask,
} from "@/lib/schedule-impact";
import type {
  AssistantActionChange,
  AssistantActionProposalView,
  AssistantActionToolOutput,
} from "@/lib/assistant-types";

const roadblockTypeSchema = z.enum([
  "CHANGE_ORDER",
  "INSPECTION",
  "LABOR",
  "MATERIAL",
  "WEATHER",
  "OTHER",
]);

const createRoadblockProposalSchema = z.object({
  conversationId: z.string().min(1),
  taskId: z.string().min(1),
  note: z.string().trim().min(1).max(500).optional(),
  roadblockType: roadblockTypeSchema.optional(),
  ownerMemberId: z.string().min(1).nullable().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD for the due date").nullable().optional(),
});

const roadblockPayloadSchema = z.object({
  taskId: z.string(),
  note: z.string().min(1).max(500),
  roadblockType: roadblockTypeSchema,
  ownerMemberId: z.string().nullable(),
  dueDate: z.string().datetime().nullable(),
});

const roadblockSnapshotSchema = z.object({
  taskName: z.string(),
  projectName: z.string(),
  isRoadblock: z.boolean(),
  roadblockStatus: z.enum(["OPEN", "RESOLVED"]).nullable(),
  note: z.string().nullable(),
  roadblockType: roadblockTypeSchema.nullable(),
  ownerMemberId: z.string().nullable(),
  ownerName: z.string().nullable(),
  dueDate: z.string().datetime().nullable(),
});

const taskStatusSchema = z.enum(["NOT_STARTED", "IN_PROGRESS", "DONE", "DELAYED"]);

const createTaskChangeProposalSchema = z.object({
  conversationId: z.string().min(1),
  projectId: z.string().min(1),
  operation: z.enum(["CREATE", "UPDATE"]),
  taskId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  assignedToId: z.string().min(1).nullable().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: taskStatusSchema.optional(),
  progress: z.number().int().min(0).max(100).optional(),
  note: z.string().trim().min(1).max(1000).optional(),
});

const taskChangePayloadSchema = z.object({
  operation: z.enum(["CREATE", "UPDATE"]),
  name: z.string().min(1).max(200),
  assignedToId: z.string().nullable(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  status: taskStatusSchema,
  progress: z.number().int().min(0).max(100),
  note: z.string().max(1000).nullable(),
});

const taskChangeSnapshotSchema = z.object({
  projectName: z.string(),
  taskName: z.string(),
  exists: z.boolean(),
  name: z.string().nullable(),
  assignedToId: z.string().nullable(),
  assignedToName: z.string().nullable(),
  startDate: z.string().datetime().nullable(),
  endDate: z.string().datetime().nullable(),
  status: taskStatusSchema.nullable(),
  progress: z.number().int().min(0).max(100).nullable(),
});

const scheduleOperationSchema = z.enum([
  "ADD_DEPENDENCY",
  "REMOVE_DEPENDENCY",
  "SHIFT_TASKS",
  "REFLOW_SUCCESSORS",
]);
const scheduleDependencySchema = z.object({
  action: z.enum(["ADD", "REMOVE"]),
  predecessorId: z.string(),
  predecessorName: z.string(),
  successorId: z.string(),
  successorName: z.string(),
});
const scheduleShiftSchema = z.object({
  taskId: z.string(),
  taskName: z.string(),
  days: z.number().int(),
  reason: z.enum(["REQUESTED", "DEPENDENCY_REFLOW"]).optional(),
  beforeStart: z.string().datetime(),
  beforeEnd: z.string().datetime(),
  afterStart: z.string().datetime(),
  afterEnd: z.string().datetime(),
});
const scheduleSimulationSchema = z.object({
  anchorTaskId: z.string(),
  anchorTaskName: z.string(),
  requestedDays: z.number().int(),
  appliedAnchorDays: z.number().int().optional(),
  downstreamTaskCount: z.number().int().min(0),
  projectFinishBefore: z.string().datetime(),
  projectFinishAfter: z.string().datetime(),
  projectFinishDeltaDays: z.number().int(),
  criticalBefore: z.array(z.string()),
  criticalAfter: z.array(z.string()),
});
const schedulePayloadSchema = z.object({
  operation: scheduleOperationSchema,
  dependencies: z.array(scheduleDependencySchema),
  shifts: z.array(scheduleShiftSchema),
  warnings: z.array(z.string()),
  simulation: scheduleSimulationSchema.optional(),
});
const scheduleTaskSnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});
const scheduleEdgeSnapshotSchema = z.object({
  id: z.string(),
  predecessorId: z.string(),
  successorId: z.string(),
});
const scheduleSnapshotSchema = z.object({
  projectName: z.string(),
  projectStart: z.string().datetime(),
  projectEnd: z.string().datetime(),
  tasks: z.array(scheduleTaskSnapshotSchema),
  edges: z.array(scheduleEdgeSnapshotSchema),
});
const createScheduleProposalSchema = z.object({
  conversationId: z.string().min(1),
  projectId: z.string().min(1),
  operation: scheduleOperationSchema,
  predecessorId: z.string().min(1).optional(),
  successorId: z.string().min(1).optional(),
  anchorTaskId: z.string().min(1).optional(),
  taskIds: z.array(z.string().min(1)).min(1).max(50).optional(),
  shiftDays: z.number().int().min(-365).max(365).refine((value) => value !== 0).optional(),
});

const projectControlStatusSchema = z.enum([
  "OPEN",
  "ANSWERED",
  "CLOSED",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "REVISE_RESUBMIT",
]);
const createProjectControlProposalSchema = z.object({
  conversationId: z.string().min(1),
  projectId: z.string().min(1),
  entity: z.enum(["RFI", "SUBMITTAL"]),
  operation: z.enum(["CREATE", "UPDATE"]),
  recordId: z.string().min(1).optional(),
  taskId: z.string().min(1).nullable().optional(),
  question: z.string().trim().min(1).max(1000).optional(),
  answer: z.string().trim().min(1).max(2000).nullable().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  specSection: z.string().trim().max(50).nullable().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  status: projectControlStatusSchema.optional(),
});
const rfiControlPayloadSchema = z.object({
  entity: z.literal("RFI"),
  operation: z.enum(["CREATE", "UPDATE"]),
  recordId: z.string().nullable(),
  taskId: z.string().nullable(),
  taskName: z.string().nullable(),
  question: z.string().min(1).max(1000),
  answer: z.string().max(2000).nullable(),
  status: z.enum(["OPEN", "ANSWERED", "CLOSED"]),
  dueDate: z.string().datetime().nullable(),
});
const submittalControlPayloadSchema = z.object({
  entity: z.literal("SUBMITTAL"),
  operation: z.enum(["CREATE", "UPDATE"]),
  recordId: z.string().nullable(),
  taskId: z.string().nullable(),
  taskName: z.string().nullable(),
  title: z.string().min(1).max(200),
  specSection: z.string().max(50).nullable(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "REVISE_RESUBMIT"]),
  dueDate: z.string().datetime().nullable(),
});
const projectControlPayloadSchema = z.discriminatedUnion("entity", [
  rfiControlPayloadSchema,
  submittalControlPayloadSchema,
]);
const rfiControlSnapshotSchema = z.object({
  entity: z.literal("RFI"),
  projectName: z.string(),
  exists: z.boolean(),
  source: z.enum(["NATIVE", "PROCORE", "AUTODESK"]).nullable(),
  taskId: z.string().nullable(),
  taskName: z.string().nullable(),
  question: z.string().nullable(),
  answer: z.string().nullable(),
  status: z.enum(["OPEN", "ANSWERED", "CLOSED"]).nullable(),
  dueDate: z.string().datetime().nullable(),
});
const submittalControlSnapshotSchema = z.object({
  entity: z.literal("SUBMITTAL"),
  projectName: z.string(),
  exists: z.boolean(),
  source: z.enum(["NATIVE", "PROCORE", "AUTODESK"]).nullable(),
  taskId: z.string().nullable(),
  taskName: z.string().nullable(),
  title: z.string().nullable(),
  specSection: z.string().nullable(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "REVISE_RESUBMIT"]).nullable(),
  dueDate: z.string().datetime().nullable(),
});
const projectControlSnapshotSchema = z.discriminatedUnion("entity", [
  rfiControlSnapshotSchema,
  submittalControlSnapshotSchema,
]);

export class AssistantActionError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

class ProposalAlreadyHandledError extends Error {}

type ActionContext = {
  organizationId: string;
  userId: string;
};

function parseDueDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new AssistantActionError("Use a valid due date.");
  return date;
}

function dateSnapshot(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function parseTaskDate(value: string, label: string): Date {
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new AssistantActionError(`Use a valid ${label}.`);
  return date;
}

function displayDate(value: string | null): string {
  return value ? formatDate(new Date(value)) : "Not set";
}

function displayValue(value: string | null): string {
  return value?.trim() || "Not set";
}

function sameRoadblockSnapshot(task: Task, snapshot: z.infer<typeof roadblockSnapshotSchema>): boolean {
  return (
    task.isRoadblock === snapshot.isRoadblock &&
    task.roadblockStatus === snapshot.roadblockStatus &&
    task.roadblockNote === snapshot.note &&
    task.roadblockType === snapshot.roadblockType &&
    task.roadblockOwnerId === snapshot.ownerMemberId &&
    dateSnapshot(task.roadblockDueDate) === snapshot.dueDate
  );
}

function sameTaskSnapshot(task: Task, snapshot: z.infer<typeof taskChangeSnapshotSchema>): boolean {
  return (
    snapshot.exists &&
    task.name === snapshot.name &&
    task.assignedToId === snapshot.assignedToId &&
    dateSnapshot(task.startDate) === snapshot.startDate &&
    dateSnapshot(task.endDate) === snapshot.endDate &&
    task.status === snapshot.status &&
    task.progress === snapshot.progress
  );
}

function sameProjectControlSnapshot(
  record: RFI | Submittal,
  snapshot: z.infer<typeof projectControlSnapshotSchema>
): boolean {
  if (!snapshot.exists || record.source !== snapshot.source) return false;
  if (snapshot.entity === "RFI" && "question" in record) {
    return (
      record.taskId === snapshot.taskId &&
      record.question === snapshot.question &&
      record.answer === snapshot.answer &&
      record.status === snapshot.status &&
      dateSnapshot(record.dueDate) === snapshot.dueDate
    );
  }
  if (snapshot.entity === "SUBMITTAL" && "title" in record) {
    return (
      record.taskId === snapshot.taskId &&
      record.title === snapshot.title &&
      record.specSection === snapshot.specSection &&
      record.status === snapshot.status &&
      dateSnapshot(record.dueDate) === snapshot.dueDate
    );
  }
  return false;
}

const PROJECT_CONTROL_STATUS_LABELS: Record<z.infer<typeof projectControlStatusSchema>, string> = {
  OPEN: "Open",
  ANSWERED: "Answered",
  CLOSED: "Closed",
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  REVISE_RESUBMIT: "Revise and resubmit",
};

async function requireOwnedConversation(conversationId: string, context: ActionContext) {
  const conversation = await prisma.assistantConversation.findFirst({
    where: {
      id: conversationId,
      organizationId: context.organizationId,
      createdById: context.userId,
    },
  });
  if (!conversation) throw new AssistantActionError("Conversation not found.", 404);
  return conversation;
}

async function loadProposal(proposalId: string, context: ActionContext) {
  const proposal = await prisma.assistantActionProposal.findFirst({
    where: {
      id: proposalId,
      createdById: context.userId,
      conversation: { organizationId: context.organizationId, createdById: context.userId },
    },
  });
  if (!proposal) throw new AssistantActionError("Action proposal not found.", 404);

  if (proposal.status === "PENDING" && proposal.expiresAt <= new Date()) {
    return prisma.assistantActionProposal.update({
      where: { id: proposal.id },
      data: { status: "EXPIRED" },
    });
  }
  return proposal;
}

function changesForProposal(
  payload: z.infer<typeof roadblockPayloadSchema>,
  snapshot: z.infer<typeof roadblockSnapshotSchema>,
  ownerName: string | null
): AssistantActionChange[] {
  const changes: AssistantActionChange[] = [];
  if (!snapshot.isRoadblock) {
    changes.push({ field: "status", label: "Roadblock", before: "Not flagged", after: "Open" });
  }
  if (snapshot.note !== payload.note) {
    changes.push({ field: "note", label: "Description", before: displayValue(snapshot.note), after: payload.note });
  }
  if (snapshot.roadblockType !== payload.roadblockType) {
    changes.push({
      field: "type",
      label: "Type",
      before: snapshot.roadblockType ? ROADBLOCK_TYPE_LABELS[snapshot.roadblockType] : "Not set",
      after: ROADBLOCK_TYPE_LABELS[payload.roadblockType],
    });
  }
  if (snapshot.ownerMemberId !== payload.ownerMemberId) {
    changes.push({
      field: "owner",
      label: "Owner",
      before: displayValue(snapshot.ownerName),
      after: displayValue(ownerName),
    });
  }
  if (snapshot.dueDate !== payload.dueDate) {
    changes.push({
      field: "dueDate",
      label: "Need by",
      before: displayDate(snapshot.dueDate),
      after: displayDate(payload.dueDate),
    });
  }
  return changes;
}

async function roadblockProposalView(proposal: AssistantActionProposal): Promise<AssistantActionProposalView> {
  const payload = roadblockPayloadSchema.parse(proposal.payload);
  const snapshot = roadblockSnapshotSchema.parse(proposal.snapshot);
  const owner = payload.ownerMemberId
    ? await prisma.projectMember.findUnique({
        where: { id: payload.ownerMemberId },
        include: { user: { select: { name: true } } },
      })
    : null;
  const actionLabel = snapshot.isRoadblock ? "Update roadblock" : "Flag roadblock";
  return {
    id: proposal.id,
    projectId: proposal.projectId,
    status: proposal.status,
    actionLabel,
    title: `${actionLabel} on ${snapshot.taskName}`,
    projectName: snapshot.projectName,
    taskName: snapshot.taskName,
    changes: changesForProposal(payload, snapshot, owner?.user.name ?? null),
    warnings: [],
    href: `/projects/${proposal.projectId}/tasks/${proposal.taskId}`,
    hrefLabel: "Open task",
    expiresAt: proposal.expiresAt.toISOString(),
    confirmedAt: proposal.confirmedAt?.toISOString() ?? null,
    cancelledAt: proposal.cancelledAt?.toISOString() ?? null,
    result: proposal.result,
  };
}

function taskChangesForProposal(
  payload: z.infer<typeof taskChangePayloadSchema>,
  snapshot: z.infer<typeof taskChangeSnapshotSchema>,
  assigneeName: string | null
): AssistantActionChange[] {
  const changes: AssistantActionChange[] = [];
  const before = snapshot.exists ? snapshot : null;
  if (!before || before.name !== payload.name) {
    changes.push({ field: "name", label: "Task", before: before?.name ?? "New task", after: payload.name });
  }
  if (!before || before.assignedToId !== payload.assignedToId) {
    changes.push({
      field: "assignee",
      label: "Assigned to",
      before: displayValue(before?.assignedToName ?? null),
      after: displayValue(assigneeName),
    });
  }
  if (!before || before.startDate !== payload.startDate) {
    changes.push({
      field: "startDate",
      label: "Start",
      before: before ? displayDate(before.startDate) : "Not set",
      after: displayDate(payload.startDate),
    });
  }
  if (!before || before.endDate !== payload.endDate) {
    changes.push({
      field: "endDate",
      label: "End",
      before: before ? displayDate(before.endDate) : "Not set",
      after: displayDate(payload.endDate),
    });
  }
  if (!before || before.status !== payload.status) {
    changes.push({
      field: "taskStatus",
      label: "Status",
      before: before?.status ? TASK_STATUS_LABELS[before.status] : "Not started",
      after: TASK_STATUS_LABELS[payload.status],
    });
  }
  if (!before || before.progress !== payload.progress) {
    changes.push({
      field: "progress",
      label: "Progress",
      before: before?.progress === null || !before ? "0%" : `${before.progress}%`,
      after: `${payload.progress}%`,
    });
  }
  if (payload.note) {
    changes.push({ field: "fieldNote", label: "Field note", before: "No new note", after: payload.note });
  }
  return changes;
}

async function taskProposalView(proposal: AssistantActionProposal): Promise<AssistantActionProposalView> {
  const payload = taskChangePayloadSchema.parse(proposal.payload);
  const snapshot = taskChangeSnapshotSchema.parse(proposal.snapshot);
  const assignee = payload.assignedToId
    ? await prisma.projectMember.findUnique({
        where: { id: payload.assignedToId },
        include: { user: { select: { name: true } } },
      })
    : null;
  const result = proposal.result as { taskId?: string; href?: string } | null;
  const actionLabel = payload.operation === "CREATE" ? "Create task" : "Update task";
  return {
    id: proposal.id,
    projectId: proposal.projectId,
    status: proposal.status,
    actionLabel,
    title: `${actionLabel}: ${payload.name}`,
    projectName: snapshot.projectName,
    taskName: payload.name,
    changes: taskChangesForProposal(payload, snapshot, assignee?.user.name ?? null),
    warnings: [],
    href: result?.href ?? `/projects/${proposal.projectId}/gantt`,
    hrefLabel: result?.taskId ? "Open task" : "Open schedule",
    expiresAt: proposal.expiresAt.toISOString(),
    confirmedAt: proposal.confirmedAt?.toISOString() ?? null,
    cancelledAt: proposal.cancelledAt?.toISOString() ?? null,
    result: proposal.result,
  };
}

function scheduleChangesForProposal(
  payload: z.infer<typeof schedulePayloadSchema>
): AssistantActionChange[] {
  if (payload.operation === "SHIFT_TASKS" || payload.operation === "REFLOW_SUCCESSORS") {
    const taskChanges = payload.shifts.map((shift) => ({
      field: `shift-${shift.taskId}`,
      label: shift.taskName,
      before: `${displayDate(shift.beforeStart)} to ${displayDate(shift.beforeEnd)}`,
      after: `${displayDate(shift.afterStart)} to ${displayDate(shift.afterEnd)}${
        shift.reason === "DEPENDENCY_REFLOW" ? " (reflowed)" : ""
      }`,
    }));
    if (!payload.simulation) return taskChanges;
    return [
      {
        field: "project-finish",
        label: "Project finish",
        before: displayDate(payload.simulation.projectFinishBefore),
        after: displayDate(payload.simulation.projectFinishAfter),
      },
      {
        field: "critical-path",
        label: "Critical work",
        before: payload.simulation.criticalBefore.join(", ") || "None identified",
        after: payload.simulation.criticalAfter.join(", ") || "None identified",
      },
      ...taskChanges,
    ];
  }
  return payload.dependencies.map((dependency) => ({
    field: `dependency-${dependency.predecessorId}-${dependency.successorId}`,
    label: "Dependency",
    before:
      dependency.action === "ADD"
        ? "No finish-to-start link"
        : `${dependency.successorName} depends on ${dependency.predecessorName}`,
    after:
      dependency.action === "ADD"
        ? `${dependency.successorName} depends on ${dependency.predecessorName}`
        : "Link removed",
  }));
}

async function scheduleProposalView(
  proposal: AssistantActionProposal
): Promise<AssistantActionProposalView> {
  const payload = schedulePayloadSchema.parse(proposal.payload);
  const snapshot = scheduleSnapshotSchema.parse(proposal.snapshot);
  const actionLabel =
    payload.operation === "REFLOW_SUCCESSORS"
      ? "Reflow schedule"
      : payload.operation === "SHIFT_TASKS"
      ? "Shift schedule"
      : payload.operation === "ADD_DEPENDENCY"
        ? "Add dependency"
        : "Remove dependency";
  const title =
    payload.operation === "REFLOW_SUCCESSORS"
      ? `What-if: ${payload.simulation?.anchorTaskName ?? "downstream schedule"}`
      : payload.operation === "SHIFT_TASKS"
      ? `${actionLabel}: ${payload.shifts.length} ${payload.shifts.length === 1 ? "task" : "tasks"}`
      : `${actionLabel}: ${payload.dependencies[0]?.successorName ?? "schedule logic"}`;
  return {
    id: proposal.id,
    projectId: proposal.projectId,
    status: proposal.status,
    actionLabel,
    title,
    projectName: snapshot.projectName,
    taskName:
      payload.simulation?.anchorTaskName ??
      payload.dependencies[0]?.successorName ??
      "Master schedule",
    changes: scheduleChangesForProposal(payload),
    warnings: payload.warnings,
    href: `/projects/${proposal.projectId}/gantt`,
    hrefLabel: "Open schedule",
    expiresAt: proposal.expiresAt.toISOString(),
    confirmedAt: proposal.confirmedAt?.toISOString() ?? null,
    cancelledAt: proposal.cancelledAt?.toISOString() ?? null,
    result: proposal.result,
  };
}

function projectControlChangesForProposal(
  payload: z.infer<typeof projectControlPayloadSchema>,
  snapshot: z.infer<typeof projectControlSnapshotSchema>
): AssistantActionChange[] {
  const changes: AssistantActionChange[] = [];
  if (payload.entity === "RFI" && snapshot.entity === "RFI") {
    if (!snapshot.exists) {
      changes.push({ field: "question", label: "RFI", before: "New RFI", after: payload.question });
    }
    if (snapshot.answer !== payload.answer) {
      changes.push({
        field: "answer",
        label: "Answer",
        before: displayValue(snapshot.answer),
        after: displayValue(payload.answer),
      });
    }
  } else if (payload.entity === "SUBMITTAL" && snapshot.entity === "SUBMITTAL") {
    if (!snapshot.exists) {
      changes.push({ field: "title", label: "Submittal", before: "New submittal", after: payload.title });
    }
    if (snapshot.specSection !== payload.specSection) {
      changes.push({
        field: "specSection",
        label: "Spec section",
        before: displayValue(snapshot.specSection),
        after: displayValue(payload.specSection),
      });
    }
  }
  if (snapshot.taskId !== payload.taskId) {
    changes.push({
      field: "linkedTask",
      label: "Linked task",
      before: displayValue(snapshot.taskName),
      after: payload.taskId ? displayValue(payload.taskName) : "Not linked",
    });
  } else if (!snapshot.exists && snapshot.taskName) {
    changes.push({ field: "linkedTask", label: "Linked task", before: "Not linked", after: snapshot.taskName });
  }
  if (snapshot.status !== payload.status) {
    changes.push({
      field: "status",
      label: "Status",
      before: snapshot.status ? PROJECT_CONTROL_STATUS_LABELS[snapshot.status] : "Not created",
      after: PROJECT_CONTROL_STATUS_LABELS[payload.status],
    });
  }
  if (snapshot.dueDate !== payload.dueDate) {
    changes.push({
      field: "dueDate",
      label: "Due date",
      before: displayDate(snapshot.dueDate),
      after: displayDate(payload.dueDate),
    });
  }
  return changes;
}

async function projectControlProposalView(
  proposal: AssistantActionProposal
): Promise<AssistantActionProposalView> {
  const payload = projectControlPayloadSchema.parse(proposal.payload);
  const snapshot = projectControlSnapshotSchema.parse(proposal.snapshot);
  const result = proposal.result as { href?: string } | null;
  const isCreate = payload.operation === "CREATE";
  const actionLabel = payload.entity === "RFI"
    ? isCreate
      ? "Raise RFI"
      : payload.status === "CLOSED"
        ? "Close RFI"
        : "Answer RFI"
    : isCreate
      ? "Create submittal"
      : "Update submittal";
  const recordName = payload.entity === "RFI" ? payload.question : payload.title;
  const href = payload.entity === "RFI"
    ? `/projects/${proposal.projectId}/rfis`
    : `/projects/${proposal.projectId}/submittals`;
  return {
    id: proposal.id,
    projectId: proposal.projectId,
    status: proposal.status,
    actionLabel,
    title: `${actionLabel}: ${recordName}`,
    projectName: snapshot.projectName,
    taskName: payload.taskName ?? snapshot.taskName ?? (payload.entity === "RFI" ? "RFI log" : "Submittals log"),
    changes: projectControlChangesForProposal(payload, snapshot),
    warnings: [],
    href: result?.href ?? href,
    hrefLabel: payload.entity === "RFI" ? "Open RFI log" : "Open submittals",
    expiresAt: proposal.expiresAt.toISOString(),
    confirmedAt: proposal.confirmedAt?.toISOString() ?? null,
    cancelledAt: proposal.cancelledAt?.toISOString() ?? null,
    result: proposal.result,
  };
}

async function proposalView(proposal: AssistantActionProposal): Promise<AssistantActionProposalView> {
  if (proposal.kind === "TASK_CHANGE") return taskProposalView(proposal);
  if (proposal.kind === "SCHEDULE_CHANGE") return scheduleProposalView(proposal);
  if (proposal.kind === "PROJECT_CONTROL_CHANGE") return projectControlProposalView(proposal);
  return roadblockProposalView(proposal);
}

export async function createRoadblockActionProposal(
  input: unknown,
  context: ActionContext
): Promise<AssistantActionToolOutput> {
  const parsed = createRoadblockProposalSchema.parse(input);
  await requireOwnedConversation(parsed.conversationId, context);

  const task = await prisma.task.findFirst({
    where: {
      id: parsed.taskId,
      project: { organizationId: context.organizationId, isArchived: false },
    },
    include: {
      project: { select: { name: true } },
      roadblockOwner: { include: { user: { select: { name: true } } } },
    },
  });
  if (!task) throw new AssistantActionError("Task not found.", 404);
  if (task.isRoadblock && task.roadblockStatus !== "OPEN") {
    throw new AssistantActionError("Only an open roadblock can be updated.");
  }

  if (task.isRoadblock) await requireScheduleEditAccess(context.userId, task.projectId);
  else await requireProjectMember(context.userId, task.projectId);

  let ownerName: string | null = task.roadblockOwner?.user.name ?? null;
  if (parsed.ownerMemberId) {
    const owner = await prisma.projectMember.findFirst({
      where: { id: parsed.ownerMemberId, projectId: task.projectId },
      include: { user: { select: { name: true } } },
    });
    if (!owner) throw new AssistantActionError("The selected owner is not a member of this project.");
    ownerName = owner.user.name;
  } else if (parsed.ownerMemberId === null) {
    ownerName = null;
  }

  const parsedDueDate = parseDueDate(parsed.dueDate);
  const proposedNote = parsed.note ?? task.roadblockNote;
  if (!proposedNote) throw new AssistantActionError("Describe what is blocking the task before proposing it.");

  const payload = roadblockPayloadSchema.parse({
    taskId: task.id,
    note: proposedNote,
    roadblockType: parsed.roadblockType ?? task.roadblockType ?? "OTHER",
    ownerMemberId:
      parsed.ownerMemberId === undefined ? task.roadblockOwnerId : parsed.ownerMemberId,
    dueDate: dateSnapshot(parsedDueDate === undefined ? task.roadblockDueDate : parsedDueDate),
  });
  const snapshot = roadblockSnapshotSchema.parse({
    taskName: task.name,
    projectName: task.project.name,
    isRoadblock: task.isRoadblock,
    roadblockStatus: task.roadblockStatus,
    note: task.roadblockNote,
    roadblockType: task.roadblockType,
    ownerMemberId: task.roadblockOwnerId,
    ownerName: task.roadblockOwner?.user.name ?? null,
    dueDate: dateSnapshot(task.roadblockDueDate),
  });
  const changes = changesForProposal(payload, snapshot, ownerName);
  if (changes.length === 0) throw new AssistantActionError("This proposal would not change the roadblock.");

  const proposal = await prisma.assistantActionProposal.create({
    data: {
      conversationId: parsed.conversationId,
      projectId: task.projectId,
      taskId: task.id,
      createdById: context.userId,
      kind: "ROADBLOCK_CHANGE",
      payload: payload as Prisma.InputJsonValue,
      snapshot: snapshot as Prisma.InputJsonValue,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });
  const view = await proposalView(proposal);
  return {
    kind: "action-proposal",
    proposal: view,
    sources: [{ label: `${task.name} task`, href: view.href }],
  };
}

function normalizeTaskState(params: {
  currentStatus: TaskStatus;
  currentProgress: number;
  status?: TaskStatus;
  progress?: number;
}) {
  let status = params.status ?? params.currentStatus;
  let progress = params.progress ?? params.currentProgress;

  if (params.status === "DONE" && params.progress === undefined) progress = 100;
  if (params.status === "NOT_STARTED" && params.progress === undefined) progress = 0;
  if (params.progress === 100 && params.status === undefined) status = "DONE";
  if (
    params.progress !== undefined &&
    params.progress > 0 &&
    params.progress < 100 &&
    params.status === undefined &&
    status === "NOT_STARTED"
  ) {
    status = "IN_PROGRESS";
  }
  return { status, progress };
}

async function requireTaskChangeAccess(
  userId: string,
  projectId: string,
  taskId: string | null,
  payload: z.infer<typeof taskChangePayloadSchema>,
  snapshot: z.infer<typeof taskChangeSnapshotSchema>
) {
  const structuralChange =
    payload.operation === "CREATE" ||
    payload.name !== snapshot.name ||
    payload.assignedToId !== snapshot.assignedToId ||
    payload.startDate !== snapshot.startDate ||
    payload.endDate !== snapshot.endDate;

  if (structuralChange) return requireScheduleEditAccess(userId, projectId);
  if (payload.status !== snapshot.status || payload.progress !== snapshot.progress) {
    if (!taskId) throw new AssistantActionError("Task not found.", 404);
    return requireTaskEditAccess(userId, taskId);
  }
  return requireProjectMember(userId, projectId);
}

export async function createTaskActionProposal(
  input: unknown,
  context: ActionContext
): Promise<AssistantActionToolOutput> {
  const parsed = createTaskChangeProposalSchema.parse(input);
  const conversation = await requireOwnedConversation(parsed.conversationId, context);
  if (conversation.projectId && conversation.projectId !== parsed.projectId) {
    throw new AssistantActionError("This conversation belongs to a different project.", 409);
  }

  const project = await prisma.project.findFirst({
    where: {
      id: parsed.projectId,
      organizationId: context.organizationId,
      isArchived: false,
      members: { some: { userId: context.userId } },
    },
    select: { id: true, name: true },
  });
  if (!project) throw new AssistantActionError("Project not found.", 404);
  if (parsed.operation === "UPDATE" && !parsed.taskId) {
    throw new AssistantActionError("Choose a task to update.");
  }

  const task = parsed.operation === "UPDATE"
    ? await prisma.task.findFirst({
        where: { id: parsed.taskId, projectId: project.id },
        include: { assignedTo: { include: { user: { select: { name: true } } } } },
      })
    : null;
  if (parsed.operation === "UPDATE" && !task) throw new AssistantActionError("Task not found.", 404);

  const name = parsed.name ?? task?.name;
  if (!name) throw new AssistantActionError("Provide a task name.");
  if (parsed.operation === "CREATE" && (!parsed.startDate || !parsed.endDate)) {
    throw new AssistantActionError("Provide both a start date and end date for the new task.");
  }

  const startDate = parsed.startDate
    ? parseTaskDate(parsed.startDate, "start date")
    : task?.startDate;
  const endDate = parsed.endDate ? parseTaskDate(parsed.endDate, "end date") : task?.endDate;
  if (!startDate || !endDate) throw new AssistantActionError("Provide valid task dates.");
  if (endDate < startDate) throw new AssistantActionError("End date must be on or after the start date.");

  let assignedToId = parsed.assignedToId === undefined ? task?.assignedToId ?? null : parsed.assignedToId;
  let assignedToName = task?.assignedTo?.user.name ?? null;
  if (assignedToId) {
    const assignee = await prisma.projectMember.findFirst({
      where: { id: assignedToId, projectId: project.id },
      include: { user: { select: { name: true } } },
    });
    if (!assignee) throw new AssistantActionError("The selected assignee is no longer on this project.");
    assignedToId = assignee.id;
    assignedToName = assignee.user.name;
  } else {
    assignedToName = null;
  }

  const normalized = normalizeTaskState({
    currentStatus: task?.status ?? "NOT_STARTED",
    currentProgress: task?.progress ?? 0,
    status: parsed.status,
    progress: parsed.progress,
  });
  const payload = taskChangePayloadSchema.parse({
    operation: parsed.operation,
    name,
    assignedToId,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    status: normalized.status,
    progress: normalized.progress,
    note: parsed.note ?? null,
  });
  const snapshot = taskChangeSnapshotSchema.parse({
    projectName: project.name,
    taskName: task?.name ?? name,
    exists: Boolean(task),
    name: task?.name ?? null,
    assignedToId: task?.assignedToId ?? null,
    assignedToName: task?.assignedTo?.user.name ?? null,
    startDate: task ? task.startDate.toISOString() : null,
    endDate: task ? task.endDate.toISOString() : null,
    status: task?.status ?? null,
    progress: task?.progress ?? null,
  });

  await requireTaskChangeAccess(context.userId, project.id, task?.id ?? null, payload, snapshot);
  const changes = taskChangesForProposal(payload, snapshot, assignedToName);
  if (changes.length === 0) throw new AssistantActionError("This proposal would not change the task.");

  const proposal = await prisma.assistantActionProposal.create({
    data: {
      conversationId: parsed.conversationId,
      projectId: project.id,
      taskId: task?.id ?? null,
      createdById: context.userId,
      kind: "TASK_CHANGE",
      payload: payload as Prisma.InputJsonValue,
      snapshot: snapshot as Prisma.InputJsonValue,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });
  const view = await proposalView(proposal);
  return {
    kind: "action-proposal",
    proposal: view,
    sources: [{ label: `${project.name} schedule`, href: `/projects/${project.id}/gantt` }],
  };
}

function scheduleTaskForImpact(task: {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
}): ScheduleImpactTask {
  return {
    id: task.id,
    name: task.name,
    startDate: task.startDate,
    endDate: task.endDate,
  };
}

export async function createScheduleActionProposal(
  input: unknown,
  context: ActionContext
): Promise<AssistantActionToolOutput> {
  const parsed = createScheduleProposalSchema.parse(input);
  const conversation = await requireOwnedConversation(parsed.conversationId, context);
  if (conversation.projectId && conversation.projectId !== parsed.projectId) {
    throw new AssistantActionError("This conversation belongs to a different project.", 409);
  }

  const project = await prisma.project.findFirst({
    where: {
      id: parsed.projectId,
      organizationId: context.organizationId,
      isArchived: false,
      members: { some: { userId: context.userId } },
    },
  });
  if (!project) throw new AssistantActionError("Project not found.", 404);
  await requireScheduleEditAccess(context.userId, project.id);

  const [tasks, edges] = await Promise.all([
    prisma.task.findMany({ where: { projectId: project.id }, orderBy: { id: "asc" } }),
    prisma.taskDependency.findMany({
      where: { predecessor: { projectId: project.id } },
      orderBy: { id: "asc" },
    }),
  ]);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const beforeTasks = tasks.map(scheduleTaskForImpact);
  let afterTasks = beforeTasks;
  let afterEdges = edges.map((edge) => ({
    predecessorId: edge.predecessorId,
    successorId: edge.successorId,
  }));
  const dependencies: z.infer<typeof scheduleDependencySchema>[] = [];
  const shifts: z.infer<typeof scheduleShiftSchema>[] = [];
  let simulation: z.infer<typeof scheduleSimulationSchema> | undefined;
  const changedTaskIds: string[] = [];
  const changedEdges: Array<{ predecessorId: string; successorId: string }> = [];

  if (parsed.operation === "REFLOW_SUCCESSORS") {
    if (!parsed.anchorTaskId || parsed.shiftDays === undefined) {
      throw new AssistantActionError("Choose a task and a non-zero schedule change to simulate.");
    }
    const anchor = taskById.get(parsed.anchorTaskId);
    if (!anchor) throw new AssistantActionError("The task to simulate is no longer available.", 409);
    if (anchor.status === "DONE") {
      throw new AssistantActionError("Completed tasks cannot be moved by a what-if schedule reflow.", 409);
    }

    const reflow = simulateDownstreamReflow({
      tasks: beforeTasks,
      edges: afterEdges,
      anchorTaskId: anchor.id,
      shiftDays: parsed.shiftDays,
      lockedTaskIds: tasks.filter((task) => task.status === "DONE").map((task) => task.id),
    });
    if (reflow.blockedTaskIds.length > 0) {
      const blockedNames = reflow.blockedTaskIds
        .map((taskId) => taskById.get(taskId)?.name)
        .filter((name): name is string => Boolean(name));
      throw new AssistantActionError(
        `The reflow would need to move completed work: ${blockedNames.join(", ")}.`,
        409
      );
    }
    if (reflow.anchorAppliedDays === 0) {
      throw new AssistantActionError(
        `${anchor.name} is already at the earliest date allowed by its predecessors.`,
        409
      );
    }
    if (reflow.changedTaskIds.length > 50) {
      throw new AssistantActionError(
        "This reflow affects more than 50 tasks. Narrow the request or reflow the schedule in stages.",
        409
      );
    }

    afterTasks = reflow.afterTasks;
    const afterById = new Map(afterTasks.map((task) => [task.id, task]));
    for (const taskId of reflow.changedTaskIds) {
      const before = taskById.get(taskId);
      const after = afterById.get(taskId);
      if (!before || !after) continue;
      const days = Math.round((after.startDate.getTime() - before.startDate.getTime()) / 86_400_000);
      changedTaskIds.push(taskId);
      shifts.push({
        taskId,
        taskName: before.name,
        days,
        reason: taskId === anchor.id ? "REQUESTED" : "DEPENDENCY_REFLOW",
        beforeStart: before.startDate.toISOString(),
        beforeEnd: before.endDate.toISOString(),
        afterStart: after.startDate.toISOString(),
        afterEnd: after.endDate.toISOString(),
      });
    }

    const finishBefore = projectFinish(beforeTasks);
    const finishAfter = projectFinish(afterTasks);
    if (!finishBefore || !finishAfter) {
      throw new AssistantActionError("The project has no scheduled work to simulate.", 409);
    }
    const criticalBeforeIds = computeScheduleCriticalTasks(beforeTasks, afterEdges);
    const criticalAfterIds = computeScheduleCriticalTasks(afterTasks, afterEdges);
    simulation = scheduleSimulationSchema.parse({
      anchorTaskId: anchor.id,
      anchorTaskName: anchor.name,
      requestedDays: parsed.shiftDays,
      appliedAnchorDays: reflow.anchorAppliedDays,
      downstreamTaskCount: reflow.downstreamTaskIds.length,
      projectFinishBefore: finishBefore.toISOString(),
      projectFinishAfter: finishAfter.toISOString(),
      projectFinishDeltaDays: Math.round(
        (finishAfter.getTime() - finishBefore.getTime()) / 86_400_000
      ),
      criticalBefore: tasks
        .filter((task) => criticalBeforeIds.has(task.id))
        .map((task) => task.name),
      criticalAfter: tasks
        .filter((task) => criticalAfterIds.has(task.id))
        .map((task) => task.name),
    });
  } else if (parsed.operation === "SHIFT_TASKS") {
    if (!parsed.taskIds || parsed.shiftDays === undefined) {
      throw new AssistantActionError("Choose at least one task and a non-zero number of days.");
    }
    const uniqueTaskIds = [...new Set(parsed.taskIds)];
    for (const taskId of uniqueTaskIds) {
      const task = taskById.get(taskId);
      if (!task) throw new AssistantActionError("One of the selected tasks is no longer available.", 409);
      const shifted = shiftTaskByDays(scheduleTaskForImpact(task), parsed.shiftDays);
      changedTaskIds.push(task.id);
      shifts.push({
        taskId: task.id,
        taskName: task.name,
        days: parsed.shiftDays,
        beforeStart: task.startDate.toISOString(),
        beforeEnd: task.endDate.toISOString(),
        afterStart: shifted.startDate.toISOString(),
        afterEnd: shifted.endDate.toISOString(),
      });
    }
    const shiftsById = new Map(shifts.map((shift) => [shift.taskId, shift]));
    afterTasks = beforeTasks.map((task) => {
      const shift = shiftsById.get(task.id);
      return shift
        ? { ...task, startDate: new Date(shift.afterStart), endDate: new Date(shift.afterEnd) }
        : task;
    });
  } else {
    if (!parsed.predecessorId || !parsed.successorId) {
      throw new AssistantActionError("Choose both the predecessor and successor tasks.");
    }
    const predecessor = taskById.get(parsed.predecessorId);
    const successor = taskById.get(parsed.successorId);
    if (!predecessor || !successor) throw new AssistantActionError("Task not found.", 404);
    if (predecessor.id === successor.id) {
      throw new AssistantActionError("A task cannot depend on itself.");
    }
    const existingEdge = edges.find(
      (edge) => edge.predecessorId === predecessor.id && edge.successorId === successor.id
    );
    const action = parsed.operation === "ADD_DEPENDENCY" ? "ADD" : "REMOVE";
    if (action === "ADD") {
      if (existingEdge) throw new AssistantActionError("That dependency already exists.", 409);
      if (wouldCreateCycle(afterEdges, predecessor.id, successor.id)) {
        throw new AssistantActionError("That dependency would create a circular schedule.", 409);
      }
      afterEdges = [...afterEdges, { predecessorId: predecessor.id, successorId: successor.id }];
    } else {
      if (!existingEdge) throw new AssistantActionError("That dependency does not exist.", 404);
      afterEdges = afterEdges.filter(
        (edge) => !(edge.predecessorId === predecessor.id && edge.successorId === successor.id)
      );
    }
    dependencies.push({
      action,
      predecessorId: predecessor.id,
      predecessorName: predecessor.name,
      successorId: successor.id,
      successorName: successor.name,
    });
    changedEdges.push({ predecessorId: predecessor.id, successorId: successor.id });
  }

  const warnings = analyzeScheduleImpact({
    projectStart: project.startDate,
    projectEnd: project.endDate,
    beforeTasks,
    afterTasks,
    beforeEdges: edges,
    afterEdges,
    changedTaskIds,
    changedEdges,
  });
  if (simulation) {
    if (
      simulation.appliedAnchorDays !== undefined &&
      simulation.appliedAnchorDays !== simulation.requestedDays
    ) {
      warnings.unshift(
        `Predecessor logic limits the requested ${simulation.requestedDays}-day move; ${simulation.anchorTaskName} can move by ${simulation.appliedAnchorDays} day${Math.abs(simulation.appliedAnchorDays) === 1 ? "" : "s"}.`
      );
    }
    if (simulation.projectFinishDeltaDays === 0) {
      warnings.unshift(
        `Available schedule float absorbs this change; the current project finish remains ${displayDate(simulation.projectFinishAfter)}.`
      );
    } else {
      warnings.unshift(
        `The current project finish moves by ${simulation.projectFinishDeltaDays} day${Math.abs(simulation.projectFinishDeltaDays) === 1 ? "" : "s"}, from ${displayDate(simulation.projectFinishBefore)} to ${displayDate(simulation.projectFinishAfter)}.`
      );
    }
    const beforeCritical = new Set(simulation.criticalBefore);
    const addedCritical = simulation.criticalAfter.filter((name) => !beforeCritical.has(name));
    const afterCritical = new Set(simulation.criticalAfter);
    const removedCritical = simulation.criticalBefore.filter((name) => !afterCritical.has(name));
    if (addedCritical.length > 0 || removedCritical.length > 0) {
      warnings.push(
        `Critical work changes${addedCritical.length > 0 ? `; added: ${addedCritical.join(", ")}` : ""}${removedCritical.length > 0 ? `; removed: ${removedCritical.join(", ")}` : ""}.`
      );
    }
  }
  const payload = schedulePayloadSchema.parse({
    operation: parsed.operation,
    dependencies,
    shifts,
    warnings,
    simulation,
  });
  const snapshot = scheduleSnapshotSchema.parse({
    projectName: project.name,
    projectStart: project.startDate.toISOString(),
    projectEnd: project.endDate.toISOString(),
    tasks: tasks.map((task) => ({
      id: task.id,
      name: task.name,
      startDate: task.startDate.toISOString(),
      endDate: task.endDate.toISOString(),
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      predecessorId: edge.predecessorId,
      successorId: edge.successorId,
    })),
  });

  const proposal = await prisma.assistantActionProposal.create({
    data: {
      conversationId: parsed.conversationId,
      projectId: project.id,
      taskId: simulation?.anchorTaskId ?? shifts[0]?.taskId ?? dependencies[0]?.successorId ?? null,
      createdById: context.userId,
      kind: "SCHEDULE_CHANGE",
      payload: payload as Prisma.InputJsonValue,
      snapshot: snapshot as Prisma.InputJsonValue,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });
  const view = await proposalView(proposal);
  return {
    kind: "action-proposal",
    proposal: view,
    sources: [{ label: `${project.name} schedule`, href: `/projects/${project.id}/gantt` }],
  };
}

export async function createProjectControlActionProposal(
  input: unknown,
  context: ActionContext
): Promise<AssistantActionToolOutput> {
  const parsed = createProjectControlProposalSchema.parse(input);
  const conversation = await requireOwnedConversation(parsed.conversationId, context);
  if (conversation.projectId && conversation.projectId !== parsed.projectId) {
    throw new AssistantActionError("This conversation belongs to a different project.", 409);
  }

  const project = await prisma.project.findFirst({
    where: {
      id: parsed.projectId,
      organizationId: context.organizationId,
      isArchived: false,
      members: { some: { userId: context.userId } },
    },
    select: { id: true, name: true },
  });
  if (!project) throw new AssistantActionError("Project not found.", 404);
  if (parsed.operation === "UPDATE" && !parsed.recordId) {
    throw new AssistantActionError(`Choose the ${parsed.entity === "RFI" ? "RFI" : "submittal"} to update.`);
  }

  const task = parsed.taskId
    ? await prisma.task.findFirst({
        where: { id: parsed.taskId, projectId: project.id },
        select: { id: true, name: true },
      })
    : null;
  if (parsed.taskId && !task) throw new AssistantActionError("The linked task is no longer available.", 409);

  let payload: z.infer<typeof projectControlPayloadSchema>;
  let snapshot: z.infer<typeof projectControlSnapshotSchema>;
  if (parsed.entity === "RFI") {
    const existing = parsed.operation === "UPDATE"
      ? await prisma.rFI.findFirst({
          where: { id: parsed.recordId, projectId: project.id },
          include: { task: { select: { name: true } } },
        })
      : null;
    if (parsed.operation === "UPDATE" && !existing) throw new AssistantActionError("RFI not found.", 404);
    if (existing?.source !== undefined && existing.source !== "NATIVE") {
      throw new AssistantActionError("Synced RFIs must be updated in their source system.", 409);
    }
    if (parsed.operation === "CREATE") {
      await requireProjectMember(context.userId, project.id);
      if (!parsed.question) throw new AssistantActionError("Provide the RFI question.");
      if (parsed.answer || (parsed.status && parsed.status !== "OPEN")) {
        throw new AssistantActionError("A new RFI must begin open and unanswered.");
      }
    } else {
      await requireScheduleEditAccess(context.userId, project.id);
    }

    const status = parsed.operation === "CREATE"
      ? "OPEN"
      : parsed.status === "CLOSED"
        ? "CLOSED"
        : parsed.status === "ANSWERED" || parsed.answer !== undefined
          ? "ANSWERED"
          : existing!.status;
    if (!(["OPEN", "ANSWERED", "CLOSED"] as const).includes(status)) {
      throw new AssistantActionError("Choose a valid RFI status.");
    }
    const answer = parsed.operation === "CREATE"
      ? null
      : parsed.answer === undefined
        ? existing!.answer
        : parsed.answer;
    if (status === "ANSWERED" && !answer) {
      throw new AssistantActionError("Provide an answer before marking the RFI answered.");
    }
    const dueDate = parsed.operation === "CREATE"
      ? parseDueDate(parsed.dueDate) ?? null
      : existing!.dueDate;
    payload = rfiControlPayloadSchema.parse({
      entity: "RFI",
      operation: parsed.operation,
      recordId: existing?.id ?? null,
      taskId: existing?.taskId ?? task?.id ?? null,
      taskName: existing?.task?.name ?? task?.name ?? null,
      question: existing?.question ?? parsed.question,
      answer,
      status,
      dueDate: dateSnapshot(dueDate),
    });
    snapshot = rfiControlSnapshotSchema.parse({
      entity: "RFI",
      projectName: project.name,
      exists: Boolean(existing),
      source: existing?.source ?? null,
      taskId: existing?.taskId ?? null,
      taskName: existing?.task?.name ?? null,
      question: existing?.question ?? null,
      answer: existing?.answer ?? null,
      status: existing?.status ?? null,
      dueDate: dateSnapshot(existing?.dueDate ?? null),
    });
  } else {
    const existing = parsed.operation === "UPDATE"
      ? await prisma.submittal.findFirst({
          where: { id: parsed.recordId, projectId: project.id },
          include: { task: { select: { name: true } } },
        })
      : null;
    if (parsed.operation === "UPDATE" && !existing) throw new AssistantActionError("Submittal not found.", 404);
    if (existing?.source !== undefined && existing.source !== "NATIVE") {
      throw new AssistantActionError("Synced submittals must be updated in their source system.", 409);
    }
    if (parsed.operation === "CREATE") {
      await requireProjectMember(context.userId, project.id);
      if (!parsed.title) throw new AssistantActionError("Provide the submittal title.");
      if (parsed.status && parsed.status !== "PENDING") {
        throw new AssistantActionError("A new submittal must begin pending.");
      }
    } else {
      await requireScheduleEditAccess(context.userId, project.id);
      if (!parsed.status || !(["PENDING", "APPROVED", "REJECTED", "REVISE_RESUBMIT"] as const).includes(parsed.status as never)) {
        throw new AssistantActionError("Choose the new submittal status.");
      }
    }

    const dueDate = parsed.operation === "CREATE"
      ? parseDueDate(parsed.dueDate) ?? null
      : existing!.dueDate;
    payload = submittalControlPayloadSchema.parse({
      entity: "SUBMITTAL",
      operation: parsed.operation,
      recordId: existing?.id ?? null,
      taskId: existing?.taskId ?? task?.id ?? null,
      taskName: existing?.task?.name ?? task?.name ?? null,
      title: existing?.title ?? parsed.title,
      specSection: existing?.specSection ?? parsed.specSection ?? null,
      status: parsed.operation === "CREATE" ? "PENDING" : parsed.status,
      dueDate: dateSnapshot(dueDate),
    });
    snapshot = submittalControlSnapshotSchema.parse({
      entity: "SUBMITTAL",
      projectName: project.name,
      exists: Boolean(existing),
      source: existing?.source ?? null,
      taskId: existing?.taskId ?? null,
      taskName: existing?.task?.name ?? null,
      title: existing?.title ?? null,
      specSection: existing?.specSection ?? null,
      status: existing?.status ?? null,
      dueDate: dateSnapshot(existing?.dueDate ?? null),
    });
  }

  const changes = projectControlChangesForProposal(payload, snapshot);
  if (changes.length === 0) throw new AssistantActionError("This proposal would not change the project record.");
  const proposal = await prisma.assistantActionProposal.create({
    data: {
      conversationId: parsed.conversationId,
      projectId: project.id,
      taskId: payload.taskId,
      createdById: context.userId,
      kind: "PROJECT_CONTROL_CHANGE",
      payload: payload as Prisma.InputJsonValue,
      snapshot: snapshot as Prisma.InputJsonValue,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });
  const view = await proposalView(proposal);
  return {
    kind: "action-proposal",
    proposal: view,
    sources: [{
      label: `${project.name} ${payload.entity === "RFI" ? "RFI log" : "submittals"}`,
      href: view.href,
    }],
  };
}

async function confirmRoadblockAction(
  proposal: AssistantActionProposal,
  context: ActionContext
) {
  if (!proposal.taskId) throw new AssistantActionError("Task not found.", 404);
  const taskId = proposal.taskId;
  const payload = roadblockPayloadSchema.parse(proposal.payload);
  const snapshot = roadblockSnapshotSchema.parse(proposal.snapshot);

  const taskForAccess = await prisma.task.findFirst({
    where: {
      id: taskId,
      projectId: proposal.projectId,
      project: { organizationId: context.organizationId, isArchived: false },
    },
  });
  if (!taskForAccess) throw new AssistantActionError("Task not found.", 404);
  if (snapshot.isRoadblock) await requireScheduleEditAccess(context.userId, proposal.projectId);
  else await requireProjectMember(context.userId, proposal.projectId);

  if (payload.ownerMemberId) {
    const ownerExists = await prisma.projectMember.count({
      where: { id: payload.ownerMemberId, projectId: proposal.projectId },
    });
    if (!ownerExists) throw new AssistantActionError("The selected roadblock owner is no longer on this project.", 409);
  }

  const result = {
    taskId,
    projectId: proposal.projectId,
    href: `/projects/${proposal.projectId}/tasks/${taskId}`,
  };

  try {
    await prisma.$transaction(async (tx) => {
      const currentTask = await tx.task.findUnique({ where: { id: taskId } });
      if (!currentTask) throw new AssistantActionError("Task not found.", 404);
      if (!sameRoadblockSnapshot(currentTask, snapshot)) {
        throw new AssistantActionError(
          "This roadblock changed after the proposal was created. Ask BuilderBridge AI to prepare a fresh proposal.",
          409
        );
      }

      const claimed = await tx.assistantActionProposal.updateMany({
        where: { id: proposal.id, status: "PENDING" },
        data: {
          status: "CONFIRMED",
          confirmedAt: new Date(),
          result: result as Prisma.InputJsonValue,
        },
      });
      if (claimed.count !== 1) throw new ProposalAlreadyHandledError();

      await tx.task.update({
        where: { id: taskId },
        data: {
          isRoadblock: true,
          roadblockStatus: "OPEN",
          roadblockNote: payload.note,
          roadblockType: payload.roadblockType as RoadblockType,
          roadblockOwnerId: payload.ownerMemberId,
          roadblockDueDate: payload.dueDate ? new Date(payload.dueDate) : null,
          roadblockRaisedBy: currentTask.roadblockRaisedBy ?? context.userId,
          resolvedAt: null,
        },
      });

      await tx.activityLogEntry.create({
        data: {
          projectId: proposal.projectId,
          taskId,
          taskName: currentTask.name,
          userId: context.userId,
          action: snapshot.isRoadblock ? "assistant_roadblock_updated" : "assistant_roadblock_flagged",
          detail: `${snapshot.isRoadblock ? "Updated" : "Flagged"} roadblock via BuilderBridge AI confirmation: ${payload.note}`,
        },
      });
    });
  } catch (error) {
    if (!(error instanceof ProposalAlreadyHandledError)) throw error;
  }

  const confirmedProposal = await loadProposal(proposal.id, context);
  if (confirmedProposal.status !== "CONFIRMED") {
    throw new AssistantActionError("This proposal could not be confirmed.", 409);
  }
  return proposalView(confirmedProposal);
}

async function confirmTaskChangeAction(
  proposal: AssistantActionProposal,
  context: ActionContext
) {
  const payload = taskChangePayloadSchema.parse(proposal.payload);
  const snapshot = taskChangeSnapshotSchema.parse(proposal.snapshot);
  const project = await prisma.project.findFirst({
    where: {
      id: proposal.projectId,
      organizationId: context.organizationId,
      isArchived: false,
      members: { some: { userId: context.userId } },
    },
    select: { id: true },
  });
  if (!project) throw new AssistantActionError("Project not found.", 404);
  await requireTaskChangeAccess(context.userId, proposal.projectId, proposal.taskId, payload, snapshot);

  if (payload.assignedToId) {
    const assigneeExists = await prisma.projectMember.count({
      where: { id: payload.assignedToId, projectId: proposal.projectId },
    });
    if (!assigneeExists) {
      throw new AssistantActionError("The selected assignee is no longer on this project.", 409);
    }
  }

  let appliedTaskId: string | null = null;
  try {
    await prisma.$transaction(async (tx) => {
      const currentTask = proposal.taskId
        ? await tx.task.findUnique({ where: { id: proposal.taskId } })
        : null;
      if (payload.operation === "UPDATE") {
        if (!currentTask || !sameTaskSnapshot(currentTask, snapshot)) {
          throw new AssistantActionError(
            "This task changed after the proposal was created. Ask BuilderBridge AI to prepare a fresh proposal.",
            409
          );
        }
      }

      const claimed = await tx.assistantActionProposal.updateMany({
        where: { id: proposal.id, status: "PENDING" },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });
      if (claimed.count !== 1) throw new ProposalAlreadyHandledError();

      const task = payload.operation === "CREATE"
        ? await tx.task.create({
            data: {
              projectId: proposal.projectId,
              name: payload.name,
              assignedToId: payload.assignedToId,
              startDate: new Date(payload.startDate),
              endDate: new Date(payload.endDate),
              status: payload.status,
              progress: payload.progress,
            },
          })
        : await tx.task.update({
            where: { id: proposal.taskId! },
            data: {
              name: payload.name,
              assignedToId: payload.assignedToId,
              startDate: new Date(payload.startDate),
              endDate: new Date(payload.endDate),
              status: payload.status,
              progress: payload.progress,
            },
          });
      appliedTaskId = task.id;

      if (payload.note) {
        await tx.taskUpdate.create({
          data: { taskId: task.id, authorId: context.userId, note: payload.note },
        });
      }

      await tx.activityLogEntry.create({
        data: {
          projectId: proposal.projectId,
          taskId: task.id,
          taskName: task.name,
          userId: context.userId,
          action: payload.operation === "CREATE" ? "assistant_task_created" : "assistant_task_updated",
          detail: `${payload.operation === "CREATE" ? "Created" : "Updated"} task via BuilderBridge AI confirmation: ${task.name}`,
        },
      });

      const result = {
        taskId: task.id,
        projectId: proposal.projectId,
        href: `/projects/${proposal.projectId}/tasks/${task.id}`,
      };
      await tx.assistantActionProposal.update({
        where: { id: proposal.id },
        data: { taskId: task.id, result: result as Prisma.InputJsonValue },
      });
    });
  } catch (error) {
    if (!(error instanceof ProposalAlreadyHandledError)) throw error;
  }

  const confirmedProposal = await loadProposal(proposal.id, context);
  if (confirmedProposal.status !== "CONFIRMED") {
    throw new AssistantActionError("This proposal could not be confirmed.", 409);
  }

  if (
    appliedTaskId &&
    payload.assignedToId &&
    (payload.operation === "CREATE" || payload.assignedToId !== snapshot.assignedToId)
  ) {
    const assignee = await prisma.projectMember.findUnique({
      where: { id: payload.assignedToId },
      select: { userId: true },
    });
    if (assignee) {
      await notifyUser({
        userId: assignee.userId,
        actorUserId: context.userId,
        subject: `Task assigned: ${payload.name}`,
        heading: "You've been assigned a task",
        bodyLines: [
          `<strong>${payload.name}</strong> was assigned to you.`,
          `Scheduled ${displayDate(payload.startDate)} to ${displayDate(payload.endDate)}.`,
        ],
        path: `/projects/${proposal.projectId}/tasks/${appliedTaskId}`,
      });
    }
  }
  return proposalView(confirmedProposal);
}

function scheduleAffectedTaskIds(payload: z.infer<typeof schedulePayloadSchema>) {
  return new Set([
    ...payload.shifts.map((shift) => shift.taskId),
    ...payload.dependencies.flatMap((dependency) => [
      dependency.predecessorId,
      dependency.successorId,
    ]),
  ]);
}

function sameDependencyGraph(
  current: Array<{ id: string; predecessorId: string; successorId: string }>,
  snapshot: z.infer<typeof scheduleSnapshotSchema>["edges"]
) {
  if (current.length !== snapshot.length) return false;
  const currentKeys = current
    .map((edge) => `${edge.id}:${edge.predecessorId}:${edge.successorId}`)
    .sort();
  const snapshotKeys = snapshot
    .map((edge) => `${edge.id}:${edge.predecessorId}:${edge.successorId}`)
    .sort();
  return currentKeys.every((key, index) => key === snapshotKeys[index]);
}

async function confirmScheduleChangeAction(
  proposal: AssistantActionProposal,
  context: ActionContext
) {
  const payload = schedulePayloadSchema.parse(proposal.payload);
  const snapshot = scheduleSnapshotSchema.parse(proposal.snapshot);
  const project = await prisma.project.findFirst({
    where: {
      id: proposal.projectId,
      organizationId: context.organizationId,
      isArchived: false,
      members: { some: { userId: context.userId } },
    },
  });
  if (!project) throw new AssistantActionError("Project not found.", 404);
  await requireScheduleEditAccess(context.userId, proposal.projectId);

  const [currentTasks, currentEdges] = await Promise.all([
    prisma.task.findMany({ where: { projectId: proposal.projectId } }),
    prisma.taskDependency.findMany({
      where: { predecessor: { projectId: proposal.projectId } },
    }),
  ]);
  if (
    project.startDate.toISOString() !== snapshot.projectStart ||
    project.endDate.toISOString() !== snapshot.projectEnd ||
    !sameDependencyGraph(currentEdges, snapshot.edges)
  ) {
    throw new AssistantActionError(
      "The schedule logic changed after this proposal was created. Ask BuilderBridge AI for a fresh proposal.",
      409
    );
  }

  const affectedIds = scheduleAffectedTaskIds(payload);
  const currentById = new Map(currentTasks.map((task) => [task.id, task]));
  const snapshotById = new Map(snapshot.tasks.map((task) => [task.id, task]));
  for (const taskId of affectedIds) {
    const current = currentById.get(taskId);
    const before = snapshotById.get(taskId);
    if (
      !current ||
      !before ||
      current.name !== before.name ||
      current.startDate.toISOString() !== before.startDate ||
      current.endDate.toISOString() !== before.endDate
    ) {
      throw new AssistantActionError(
        "An affected task changed after this proposal was created. Ask BuilderBridge AI for a fresh proposal.",
        409
      );
    }
  }

  const graph = currentEdges.map((edge) => ({
    predecessorId: edge.predecessorId,
    successorId: edge.successorId,
  }));
  if (payload.operation === "ADD_DEPENDENCY") {
    const dependency = payload.dependencies[0];
    if (!dependency || wouldCreateCycle(graph, dependency.predecessorId, dependency.successorId)) {
      throw new AssistantActionError("That dependency would now create a circular schedule.", 409);
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const transactionEdges = await tx.taskDependency.findMany({
        where: { predecessor: { projectId: proposal.projectId } },
      });
      if (!sameDependencyGraph(transactionEdges, snapshot.edges)) {
        throw new AssistantActionError(
          "The schedule logic changed after this proposal was created. Ask BuilderBridge AI for a fresh proposal.",
          409
        );
      }
      const transactionTasks = await tx.task.findMany({
        where: { id: { in: [...affectedIds] }, projectId: proposal.projectId },
      });
      const transactionById = new Map(transactionTasks.map((task) => [task.id, task]));
      for (const taskId of affectedIds) {
        const current = transactionById.get(taskId);
        const before = snapshotById.get(taskId);
        if (
          !current ||
          !before ||
          current.name !== before.name ||
          current.startDate.toISOString() !== before.startDate ||
          current.endDate.toISOString() !== before.endDate
        ) {
          throw new AssistantActionError(
            "An affected task changed after this proposal was created. Ask BuilderBridge AI for a fresh proposal.",
            409
          );
        }
      }
      if (payload.operation === "ADD_DEPENDENCY") {
        const dependency = payload.dependencies[0];
        const transactionGraph = transactionEdges.map((edge) => ({
          predecessorId: edge.predecessorId,
          successorId: edge.successorId,
        }));
        if (
          !dependency ||
          wouldCreateCycle(transactionGraph, dependency.predecessorId, dependency.successorId)
        ) {
          throw new AssistantActionError("That dependency would now create a circular schedule.", 409);
        }
      }

      const claimed = await tx.assistantActionProposal.updateMany({
        where: { id: proposal.id, status: "PENDING" },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });
      if (claimed.count !== 1) throw new ProposalAlreadyHandledError();

      if (payload.operation === "SHIFT_TASKS" || payload.operation === "REFLOW_SUCCESSORS") {
        for (const shift of payload.shifts) {
          const shifted = await tx.task.updateMany({
            where: {
              id: shift.taskId,
              name: shift.taskName,
              startDate: new Date(shift.beforeStart),
              endDate: new Date(shift.beforeEnd),
            },
            data: {
              startDate: new Date(shift.afterStart),
              endDate: new Date(shift.afterEnd),
            },
          });
          if (shifted.count !== 1) {
            throw new AssistantActionError(
              "An affected task changed after this proposal was created. Ask BuilderBridge AI for a fresh proposal.",
              409
            );
          }
          await tx.activityLogEntry.create({
            data: {
              projectId: proposal.projectId,
              taskId: shift.taskId,
              taskName: shift.taskName,
              userId: context.userId,
              action: "assistant_task_rescheduled",
              detail:
                shift.reason === "DEPENDENCY_REFLOW"
                  ? `Reflowed "${shift.taskName}" by ${shift.days} day${Math.abs(shift.days) === 1 ? "" : "s"} to preserve dependency logic via BuilderBridge AI confirmation`
                  : `Shifted "${shift.taskName}" by ${shift.days} day${Math.abs(shift.days) === 1 ? "" : "s"} via BuilderBridge AI confirmation`,
            },
          });
        }
      } else {
        const dependency = payload.dependencies[0];
        if (!dependency) throw new AssistantActionError("Dependency details are missing.", 409);
        if (dependency.action === "ADD") {
          await tx.taskDependency.create({
            data: {
              predecessorId: dependency.predecessorId,
              successorId: dependency.successorId,
            },
          });
        } else {
          const removed = await tx.taskDependency.deleteMany({
            where: {
              predecessorId: dependency.predecessorId,
              successorId: dependency.successorId,
            },
          });
          if (removed.count !== 1) throw new AssistantActionError("Dependency not found.", 409);
        }
        await tx.activityLogEntry.create({
          data: {
            projectId: proposal.projectId,
            taskId: dependency.successorId,
            taskName: dependency.successorName,
            userId: context.userId,
            action:
              dependency.action === "ADD"
                ? "assistant_dependency_added"
                : "assistant_dependency_removed",
            detail:
              dependency.action === "ADD"
                ? `"${dependency.successorName}" now depends on "${dependency.predecessorName}" via BuilderBridge AI confirmation`
                : `Removed dependency from "${dependency.predecessorName}" to "${dependency.successorName}" via BuilderBridge AI confirmation`,
          },
        });
      }

      await tx.assistantActionProposal.update({
        where: { id: proposal.id },
        data: {
          result: {
            projectId: proposal.projectId,
            href: `/projects/${proposal.projectId}/gantt`,
          },
        },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (!(error instanceof ProposalAlreadyHandledError)) throw error;
  }

  const confirmedProposal = await loadProposal(proposal.id, context);
  if (confirmedProposal.status !== "CONFIRMED") {
    throw new AssistantActionError("This proposal could not be confirmed.", 409);
  }
  return proposalView(confirmedProposal);
}

async function confirmProjectControlAction(
  proposal: AssistantActionProposal,
  context: ActionContext
) {
  const payload = projectControlPayloadSchema.parse(proposal.payload);
  const snapshot = projectControlSnapshotSchema.parse(proposal.snapshot);
  const project = await prisma.project.findFirst({
    where: {
      id: proposal.projectId,
      organizationId: context.organizationId,
      isArchived: false,
      members: { some: { userId: context.userId } },
    },
    select: { id: true },
  });
  if (!project) throw new AssistantActionError("Project not found.", 404);
  if (payload.operation === "CREATE") {
    await requireProjectMember(context.userId, proposal.projectId);
  } else {
    await requireScheduleEditAccess(context.userId, proposal.projectId);
  }

  let appliedRecordId: string | null = null;
  let notifyRaisedByUserId: string | null = null;
  try {
    await prisma.$transaction(async (tx) => {
      const member = await tx.projectMember.findUnique({
        where: {
          projectId_userId: { projectId: proposal.projectId, userId: context.userId },
        },
      });
      if (!member) throw new AssistantActionError("You are no longer a member of this project.", 403);
      if (payload.taskId) {
        const taskExists = await tx.task.count({
          where: { id: payload.taskId, projectId: proposal.projectId },
        });
        if (!taskExists) throw new AssistantActionError("The linked task is no longer available.", 409);
      }

      if (payload.operation === "UPDATE") {
        if (!payload.recordId) throw new AssistantActionError("Project record not found.", 404);
        const current = payload.entity === "RFI"
          ? await tx.rFI.findUnique({ where: { id: payload.recordId } })
          : await tx.submittal.findUnique({ where: { id: payload.recordId } });
        if (!current || current.projectId !== proposal.projectId || !sameProjectControlSnapshot(current, snapshot)) {
          throw new AssistantActionError(
            `This ${payload.entity === "RFI" ? "RFI" : "submittal"} changed after the proposal was created. Ask BuilderBridge AI to prepare a fresh proposal.`,
            409
          );
        }
        if (current.source !== "NATIVE") {
          throw new AssistantActionError("Synced records must be updated in their source system.", 409);
        }
      }

      const claimed = await tx.assistantActionProposal.updateMany({
        where: { id: proposal.id, status: "PENDING" },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });
      if (claimed.count !== 1) throw new ProposalAlreadyHandledError();

      if (payload.entity === "RFI") {
        const rfi = payload.operation === "CREATE"
          ? await tx.rFI.create({
              data: {
                projectId: proposal.projectId,
                taskId: payload.taskId,
                question: payload.question,
                dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
                raisedById: member.id,
              },
            })
          : await tx.rFI.update({
              where: { id: payload.recordId! },
              data: { answer: payload.answer, status: payload.status },
            });
        appliedRecordId = rfi.id;
        if (payload.operation === "UPDATE" && payload.status === "ANSWERED") {
          const raiser = await tx.projectMember.findUnique({
            where: { id: rfi.raisedById },
            select: { userId: true },
          });
          notifyRaisedByUserId = raiser?.userId ?? null;
        }
        await tx.activityLogEntry.create({
          data: {
            projectId: proposal.projectId,
            taskId: payload.taskId,
            taskName: payload.taskName,
            userId: context.userId,
            action: payload.operation === "CREATE"
              ? "assistant_rfi_raised"
              : payload.status === "CLOSED"
                ? "assistant_rfi_closed"
                : "assistant_rfi_answered",
            detail: payload.operation === "CREATE"
              ? `Raised RFI via BuilderBridge AI confirmation: ${payload.question}`
              : payload.status === "CLOSED"
                ? `Closed RFI via BuilderBridge AI confirmation: ${payload.question}`
                : `Answered RFI via BuilderBridge AI confirmation: ${payload.question}`,
          },
        });
      } else {
        const submittal = payload.operation === "CREATE"
          ? await tx.submittal.create({
              data: {
                projectId: proposal.projectId,
                taskId: payload.taskId,
                title: payload.title,
                specSection: payload.specSection,
                dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
                submittedById: member.id,
              },
            })
          : await tx.submittal.update({
              where: { id: payload.recordId! },
              data: { status: payload.status },
            });
        appliedRecordId = submittal.id;
        await tx.activityLogEntry.create({
          data: {
            projectId: proposal.projectId,
            taskId: payload.taskId,
            taskName: payload.taskName,
            userId: context.userId,
            action: payload.operation === "CREATE"
              ? "assistant_submittal_created"
              : "assistant_submittal_status_changed",
            detail: payload.operation === "CREATE"
              ? `Created submittal via BuilderBridge AI confirmation: ${payload.title}`
              : `Marked "${payload.title}" ${PROJECT_CONTROL_STATUS_LABELS[payload.status]} via BuilderBridge AI confirmation`,
          },
        });
      }

      const href = payload.entity === "RFI"
        ? `/projects/${proposal.projectId}/rfis`
        : `/projects/${proposal.projectId}/submittals`;
      await tx.assistantActionProposal.update({
        where: { id: proposal.id },
        data: {
          result: {
            recordId: appliedRecordId,
            projectId: proposal.projectId,
            href,
          },
        },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (!(error instanceof ProposalAlreadyHandledError)) throw error;
  }

  const confirmedProposal = await loadProposal(proposal.id, context);
  if (confirmedProposal.status !== "CONFIRMED") {
    throw new AssistantActionError("This proposal could not be confirmed.", 409);
  }
  if (
    appliedRecordId &&
    payload.entity === "RFI" &&
    payload.operation === "UPDATE" &&
    payload.status === "ANSWERED" &&
    payload.answer &&
    notifyRaisedByUserId
  ) {
    await notifyUser({
      userId: notifyRaisedByUserId,
      actorUserId: context.userId,
      subject: "Your RFI was answered",
      heading: "Your RFI has an answer",
      bodyLines: [`Question: "${payload.question}"`, `Answer: ${payload.answer}`],
      path: `/projects/${proposal.projectId}/rfis`,
    });
  }
  return proposalView(confirmedProposal);
}

export async function confirmAssistantAction(proposalId: string, context: ActionContext) {
  const proposal = await loadProposal(proposalId, context);
  if (proposal.status === "CONFIRMED") return proposalView(proposal);
  if (proposal.status !== "PENDING") {
    throw new AssistantActionError(`This proposal is already ${proposal.status.toLowerCase()}.`, 409);
  }
  if (proposal.kind === "TASK_CHANGE") return confirmTaskChangeAction(proposal, context);
  if (proposal.kind === "SCHEDULE_CHANGE") return confirmScheduleChangeAction(proposal, context);
  if (proposal.kind === "PROJECT_CONTROL_CHANGE") return confirmProjectControlAction(proposal, context);
  return confirmRoadblockAction(proposal, context);
}

export async function cancelAssistantAction(proposalId: string, context: ActionContext) {
  let proposal = await loadProposal(proposalId, context);
  if (proposal.status === "CANCELLED") return proposalView(proposal);
  if (proposal.status !== "PENDING") {
    throw new AssistantActionError(`This proposal is already ${proposal.status.toLowerCase()}.`, 409);
  }

  const cancelled = await prisma.assistantActionProposal.updateMany({
    where: { id: proposal.id, status: "PENDING" },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  if (cancelled.count !== 1) throw new AssistantActionError("This proposal was already handled.", 409);
  proposal = await loadProposal(proposalId, context);
  return proposalView(proposal);
}

type ProposalState = Pick<
  AssistantActionProposal,
  "id" | "status" | "result" | "confirmedAt" | "cancelledAt"
>;

export function getAssistantProposalId(part: unknown): string | null {
  if (!part || typeof part !== "object" || !("output" in part)) return null;
  const output = (part as { output?: unknown }).output;
  if (!output || typeof output !== "object" || !("proposal" in output)) return null;
  const proposal = (output as { proposal?: unknown }).proposal;
  if (!proposal || typeof proposal !== "object" || !("id" in proposal)) return null;
  return typeof proposal.id === "string" ? proposal.id : null;
}

export async function loadAssistantProposalStates(
  proposalIds: string[],
  conversationId: string
): Promise<Map<string, ProposalState>> {
  if (proposalIds.length === 0) return new Map();
  await prisma.assistantActionProposal.updateMany({
    where: {
      id: { in: proposalIds },
      conversationId,
      status: "PENDING",
      expiresAt: { lte: new Date() },
    },
    data: { status: "EXPIRED" },
  });
  const proposals = await prisma.assistantActionProposal.findMany({
    where: { id: { in: proposalIds }, conversationId },
    select: {
      id: true,
      status: true,
      result: true,
      confirmedAt: true,
      cancelledAt: true,
    },
  });
  return new Map(proposals.map((proposal) => [proposal.id, proposal]));
}

export function hydrateAssistantActionPart(part: unknown, states: Map<string, ProposalState>): unknown {
  const proposalId = getAssistantProposalId(part);
  if (!proposalId || !part || typeof part !== "object") return part;
  const state = states.get(proposalId);
  if (!state) return part;
  const output = (part as { output: Record<string, unknown> }).output;
  const proposal = output.proposal as Record<string, unknown>;
  return {
    ...part,
    output: {
      ...output,
      proposal: {
        ...proposal,
        status: state.status,
        result: state.result,
        confirmedAt: state.confirmedAt?.toISOString() ?? null,
        cancelledAt: state.cancelledAt?.toISOString() ?? null,
      },
    },
  };
}
