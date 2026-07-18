import { prisma } from "@/lib/prisma";
import type { ProjectRole } from "@prisma/client";

export class PermissionError extends Error {}

/** Roles considered "GC-side" (office/field management), as opposed to TRADE. */
const GC_SIDE_ROLES: ProjectRole[] = ["PROJECT_MANAGER", "SCHEDULER", "SUPERINTENDENT"];

/** Roles allowed to resolve a roadblock on behalf of the team (besides the assigned trade). */
const ROADBLOCK_RESOLVER_ROLES: ProjectRole[] = ["PROJECT_MANAGER", "SUPERINTENDENT"];

/** Pure UI-gating helpers (no DB access) — use when the role is already known. */
export function isProjectManager(role: ProjectRole): boolean {
  return role === "PROJECT_MANAGER";
}

export function canManageSchedule(role: ProjectRole): boolean {
  return GC_SIDE_ROLES.includes(role);
}

export function canResolveRoadblocks(role: ProjectRole): boolean {
  return ROADBLOCK_RESOLVER_ROLES.includes(role);
}

/** Returns the user's organization membership, or null when access was removed. */
export async function getOrganizationMembership(userId: string, organizationId: string) {
  return prisma.member.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
}

/** Every organization-scoped Agent operation must pass this guard first. */
export async function requireOrganizationMember(userId: string, organizationId: string) {
  const membership = await getOrganizationMembership(userId, organizationId);
  if (!membership) throw new PermissionError("You do not have access to this organization");
  return membership;
}

/**
 * Returns the current user's role on a project, or null if they aren't a member.
 */
export async function getProjectRole(userId: string, projectId: string): Promise<ProjectRole | null> {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  return member?.role ?? null;
}

/**
 * Throws if the user is not a member of the project. Returns their role otherwise.
 */
export async function requireProjectMember(userId: string, projectId: string): Promise<ProjectRole> {
  const role = await getProjectRole(userId, projectId);
  if (!role) throw new PermissionError("You are not a member of this project");
  return role;
}

/**
 * Project-level administration: archive/unarchive the project, invite/remove members.
 * Project Manager only.
 */
export async function requireProjectManager(userId: string, projectId: string): Promise<ProjectRole> {
  const role = await requireProjectMember(userId, projectId);
  if (role !== "PROJECT_MANAGER") {
    throw new PermissionError("Only a Project Manager can perform this action");
  }
  return role;
}

/**
 * Master Schedule management: create/edit/delete tasks, dates, dependencies.
 * Project Manager, Scheduler, or Superintendent (any GC-side role).
 */
export async function requireScheduleEditAccess(userId: string, projectId: string): Promise<ProjectRole> {
  const role = await requireProjectMember(userId, projectId);
  if (!GC_SIDE_ROLES.includes(role)) {
    throw new PermissionError("Only a Project Manager, Scheduler, or Superintendent can edit the schedule");
  }
  return role;
}

/**
 * Loads a task and verifies the current user may edit it: any GC-side role
 * (Project Manager, Scheduler, Superintendent), or the ProjectMember the task
 * is assigned to. Throws otherwise.
 */
export async function requireTaskEditAccess(userId: string, taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignedTo: true },
  });
  if (!task) throw new PermissionError("Task not found");

  const role = await requireProjectMember(userId, task.projectId);
  const isAssignedTrade = task.assignedTo?.userId === userId;

  if (!GC_SIDE_ROLES.includes(role) && !isAssignedTrade) {
    throw new PermissionError("Not authorized to edit this task");
  }

  return task;
}

/**
 * Weekly Work Plan commitments: Project Manager or Superintendent can commit any
 * task on behalf of the team; a Trade partner can commit their own assigned task.
 * Scheduler has no commit access (matches the approved capability matrix).
 */
export async function requireCommitAccess(userId: string, taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignedTo: true },
  });
  if (!task) throw new PermissionError("Task not found");

  const role = await requireProjectMember(userId, task.projectId);
  const isAssignedTrade = task.assignedTo?.userId === userId;

  if (!ROADBLOCK_RESOLVER_ROLES.includes(role) && !isAssignedTrade) {
    throw new PermissionError("Only a Project Manager, Superintendent, or the assigned trade can commit this task");
  }

  return task;
}

/**
 * Future commitment removal is limited to the person who made the commitment,
 * or a Project Manager/Superintendent responsible for the weekly plan.
 */
export async function requireCommitmentRemovalAccess(userId: string, commitmentId: string) {
  const commitment = await prisma.weeklyCommitment.findUnique({
    where: { id: commitmentId },
    include: { task: true, committedBy: true },
  });
  if (!commitment) throw new PermissionError("Commitment not found");

  const role = await requireProjectMember(userId, commitment.task.projectId);
  const isCommitter = commitment.committedBy.userId === userId;
  if (!ROADBLOCK_RESOLVER_ROLES.includes(role) && !isCommitter) {
    throw new PermissionError(
      "Only a Project Manager, Superintendent, or the person who made the commitment can remove it"
    );
  }

  return commitment;
}

/**
 * Loads a task and verifies the current user may resolve a roadblock on it:
 * Project Manager, Superintendent, or the assigned trade partner. Schedulers
 * cannot resolve roadblocks. Throws otherwise.
 */
export async function requireRoadblockResolveAccess(userId: string, taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignedTo: true },
  });
  if (!task) throw new PermissionError("Task not found");

  const role = await requireProjectMember(userId, task.projectId);
  const isAssignedTrade = task.assignedTo?.userId === userId;

  if (!ROADBLOCK_RESOLVER_ROLES.includes(role) && !isAssignedTrade) {
    throw new PermissionError("Only a Project Manager, Superintendent, or the assigned trade can resolve this roadblock");
  }

  return task;
}
