"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { requireCommitAccess } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import { COMMITMENT_STATUS_LABELS } from "@/lib/utils";
import { ok, fail, commitmentStatusSchema, type ActionResult } from "./schemas";
import type { WeeklyCommitment } from "@prisma/client";

const commitToWeekSchema = z.object({
  taskId: z.string().min(1, "taskId is required"),
  weekStartDate: z.coerce.date({ message: "A valid week start date is required" }),
});

export async function commitToWeek(input: unknown): Promise<ActionResult<WeeklyCommitment>> {
  const parsed = commitToWeekSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    const task = await requireCommitAccess(user.id, parsed.data.taskId);

    const committer = await prisma.projectMember.findUniqueOrThrow({
      where: { projectId_userId: { projectId: task.projectId, userId: user.id } },
    });

    const existing = await prisma.weeklyCommitment.findUnique({
      where: { taskId_weekStartDate: { taskId: parsed.data.taskId, weekStartDate: parsed.data.weekStartDate } },
    });
    if (existing) throw new Error("This task is already committed for that week");

    const commitment = await prisma.weeklyCommitment.create({
      data: {
        taskId: parsed.data.taskId,
        weekStartDate: parsed.data.weekStartDate,
        committedById: committer.id,
      },
    });

    await logActivity({
      projectId: task.projectId,
      taskId: task.id,
      taskName: task.name,
      userId: user.id,
      action: "commitment_made",
      detail: `Committed "${task.name}" for the week of ${parsed.data.weekStartDate.toDateString()}`,
    });

    revalidatePath(`/projects/${task.projectId}/weekly-plan`);
    return ok(commitment);
  } catch (error) {
    return fail(error);
  }
}

const updateCommitmentStatusSchema = z
  .object({
    commitmentId: z.string().min(1, "commitmentId is required"),
    status: commitmentStatusSchema,
    reasonForVariance: z.string().max(500, "Keep the reason under 500 characters").optional().nullable(),
  })
  .refine((data) => data.status !== "NOT_COMPLETED" || !!data.reasonForVariance?.trim(), {
    message: "Please give a reason for variance when marking a commitment not completed",
    path: ["reasonForVariance"],
  });

export async function updateCommitmentStatus(input: unknown): Promise<ActionResult<WeeklyCommitment>> {
  const parsed = updateCommitmentStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    const existing = await prisma.weeklyCommitment.findUnique({
      where: { id: parsed.data.commitmentId },
      include: { task: true },
    });
    if (!existing) throw new Error("Commitment not found");

    await requireCommitAccess(user.id, existing.taskId);

    const commitment = await prisma.weeklyCommitment.update({
      where: { id: parsed.data.commitmentId },
      data: {
        status: parsed.data.status,
        reasonForVariance: parsed.data.status === "NOT_COMPLETED" ? parsed.data.reasonForVariance : null,
      },
    });

    await logActivity({
      projectId: existing.task.projectId,
      taskId: existing.task.id,
      taskName: existing.task.name,
      userId: user.id,
      action: "commitment_status_changed",
      detail: `Commitment on "${existing.task.name}" marked ${COMMITMENT_STATUS_LABELS[parsed.data.status]}${
        parsed.data.reasonForVariance ? ` — ${parsed.data.reasonForVariance}` : ""
      }`,
    });

    revalidatePath(`/projects/${existing.task.projectId}/weekly-plan`);
    return ok(commitment);
  } catch (error) {
    return fail(error);
  }
}
