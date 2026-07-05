"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { requireProjectMember, requireTaskEditAccess } from "@/lib/permissions";
import { ok, fail, taskStatusSchema, type ActionResult } from "./schemas";
import type { Task } from "@prisma/client";

const createTaskSchema = z
  .object({
    projectId: z.string().min(1, "projectId is required"),
    name: z.string().min(1, "Task name is required").max(200),
    assignedToId: z.string().cuid().optional().nullable(),
    startDate: z.coerce.date({ message: "A valid start date is required" }),
    endDate: z.coerce.date({ message: "A valid end date is required" }),
    status: taskStatusSchema.default("NOT_STARTED"),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

export async function createTask(input: unknown): Promise<ActionResult<Task>> {
  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    // Only GC_OWNER can create tasks (per spec: "GC/Owner creates tasks").
    const role = await requireProjectMember(user.id, parsed.data.projectId);
    if (role !== "GC_OWNER") throw new Error("Only a GC/Owner can create tasks");

    const task = await prisma.task.create({
      data: {
        projectId: parsed.data.projectId,
        name: parsed.data.name,
        assignedToId: parsed.data.assignedToId ?? null,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        status: parsed.data.status,
      },
    });

    revalidatePath(`/projects/${parsed.data.projectId}`);
    revalidatePath(`/projects/${parsed.data.projectId}/gantt`);
    revalidatePath(`/projects/${parsed.data.projectId}/dashboard`);
    return ok(task);
  } catch (error) {
    return fail(error);
  }
}

const updateTaskSchema = z
  .object({
    taskId: z.string().min(1, "taskId is required"),
    name: z.string().min(1, "Task name is required").max(200),
    assignedToId: z.string().cuid().optional().nullable(),
    startDate: z.coerce.date({ message: "A valid start date is required" }),
    endDate: z.coerce.date({ message: "A valid end date is required" }),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

export async function updateTask(input: unknown): Promise<ActionResult<Task>> {
  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    const existing = await requireTaskEditAccess(user.id, parsed.data.taskId);

    const task = await prisma.task.update({
      where: { id: parsed.data.taskId },
      data: {
        name: parsed.data.name,
        assignedToId: parsed.data.assignedToId ?? null,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
      },
    });

    revalidatePath(`/projects/${existing.projectId}`);
    revalidatePath(`/projects/${existing.projectId}/gantt`);
    return ok(task);
  } catch (error) {
    return fail(error);
  }
}

const updateTaskStatusSchema = z.object({
  taskId: z.string().min(1, "taskId is required"),
  status: taskStatusSchema,
});

export async function updateTaskStatus(input: unknown): Promise<ActionResult<Task>> {
  const parsed = updateTaskStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    const existing = await requireTaskEditAccess(user.id, parsed.data.taskId);

    const task = await prisma.task.update({
      where: { id: parsed.data.taskId },
      data: { status: parsed.data.status },
    });

    revalidatePath(`/projects/${existing.projectId}`);
    revalidatePath(`/projects/${existing.projectId}/gantt`);
    revalidatePath(`/projects/${existing.projectId}/dashboard`);
    return ok(task);
  } catch (error) {
    return fail(error);
  }
}

const flagRoadblockSchema = z.object({
  taskId: z.string().min(1, "taskId is required"),
  roadblockNote: z
    .string()
    .min(1, "Please describe what's blocking this task")
    .max(500, "Keep the note under 500 characters"),
});

export async function flagRoadblock(input: unknown): Promise<ActionResult<Task>> {
  const parsed = flagRoadblockSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    const existing = await prisma.task.findUnique({ where: { id: parsed.data.taskId } });
    if (!existing) throw new Error("Task not found");

    // Any project member can flag a roadblock (view access is enough).
    await requireProjectMember(user.id, existing.projectId);

    const task = await prisma.task.update({
      where: { id: parsed.data.taskId },
      data: {
        isRoadblock: true,
        roadblockStatus: "OPEN",
        roadblockNote: parsed.data.roadblockNote,
        roadblockRaisedBy: user.id,
        resolvedAt: null,
      },
    });

    revalidatePath(`/projects/${existing.projectId}`);
    revalidatePath(`/projects/${existing.projectId}/gantt`);
    revalidatePath(`/projects/${existing.projectId}/dashboard`);
    return ok(task);
  } catch (error) {
    return fail(error);
  }
}

const resolveRoadblockSchema = z.object({
  taskId: z.string().min(1, "taskId is required"),
});

export async function resolveRoadblock(input: unknown): Promise<ActionResult<Task>> {
  const parsed = resolveRoadblockSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    // Only GC_OWNER or the assigned TRADE member may resolve.
    const existing = await requireTaskEditAccess(user.id, parsed.data.taskId);

    const task = await prisma.task.update({
      where: { id: parsed.data.taskId },
      data: { roadblockStatus: "RESOLVED", resolvedAt: new Date() },
    });

    revalidatePath(`/projects/${existing.projectId}`);
    revalidatePath(`/projects/${existing.projectId}/gantt`);
    revalidatePath(`/projects/${existing.projectId}/dashboard`);
    return ok(task);
  } catch (error) {
    return fail(error);
  }
}

const deleteTaskSchema = z.object({ taskId: z.string().min(1, "taskId is required") });

export async function deleteTask(input: unknown): Promise<ActionResult<null>> {
  const parsed = deleteTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    const existing = await prisma.task.findUnique({ where: { id: parsed.data.taskId } });
    if (!existing) throw new Error("Task not found");

    const role = await requireProjectMember(user.id, existing.projectId);
    if (role !== "GC_OWNER") throw new Error("Only a GC/Owner can delete tasks");

    await prisma.task.delete({ where: { id: parsed.data.taskId } });

    revalidatePath(`/projects/${existing.projectId}`);
    revalidatePath(`/projects/${existing.projectId}/gantt`);
    revalidatePath(`/projects/${existing.projectId}/dashboard`);
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}
