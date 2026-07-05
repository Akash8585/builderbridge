import { prisma } from "@/lib/prisma";
import type { ProjectRole } from "@prisma/client";

export class PermissionError extends Error {}

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
 * Throws unless the user is a GC_OWNER on the project. Returns their role otherwise.
 */
export async function requireProjectOwner(userId: string, projectId: string): Promise<ProjectRole> {
  const role = await requireProjectMember(userId, projectId);
  if (role !== "GC_OWNER") throw new PermissionError("Only a GC/Owner can perform this action");
  return role;
}

/**
 * Loads a task and verifies the current user may edit it: either a GC_OWNER on the
 * project, or the ProjectMember the task is assigned to. Throws otherwise.
 */
export async function requireTaskEditAccess(userId: string, taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignedTo: true },
  });
  if (!task) throw new PermissionError("Task not found");

  const role = await requireProjectMember(userId, task.projectId);
  const isAssignedTrade = task.assignedTo?.userId === userId;

  if (role !== "GC_OWNER" && !isAssignedTrade) {
    throw new PermissionError("Not authorized to edit this task");
  }

  return task;
}
