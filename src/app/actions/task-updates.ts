"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { requireProjectMember } from "@/lib/permissions";
import { uploadFile, buildStorageKey } from "@/lib/storage";
import { ok, fail, type ActionResult } from "./schemas";
import type { TaskUpdate } from "@prisma/client";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB

const addTaskUpdateSchema = z.object({
  taskId: z.string().min(1, "taskId is required"),
  note: z.string().max(1000, "Keep the note under 1000 characters").optional(),
});

/**
 * Field Tracking: log a progress note and/or photo against a task, from any
 * project member. Accepts FormData so it can carry an optional photo File.
 *
 * Photo storage goes through lib/storage.ts — S3-compatible object storage
 * when configured, local disk fallback in dev.
 */
export async function addTaskUpdate(formData: FormData): Promise<ActionResult<TaskUpdate>> {
  const parsed = addTaskUpdateSchema.safeParse({
    taskId: formData.get("taskId"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const photo = formData.get("photo");
  const hasPhoto = photo instanceof File && photo.size > 0;

  if (!parsed.data.note?.trim() && !hasPhoto) {
    return { success: false, error: "Add a note or a photo before posting an update" };
  }

  try {
    const user = await requireUser();
    const task = await prisma.task.findUnique({ where: { id: parsed.data.taskId } });
    if (!task) throw new Error("Task not found");

    // Any project member can post a field update (view access is enough).
    await requireProjectMember(user.id, task.projectId);

    let photoUrl: string | null = null;
    if (hasPhoto) {
      const file = photo as File;
      if (file.size > MAX_PHOTO_BYTES) throw new Error("Photo must be under 5MB");
      if (!file.type.startsWith("image/")) throw new Error("Only image files are supported");

      const key = buildStorageKey(`tasks/${task.id}`, file.name);
      const bytes = Buffer.from(await file.arrayBuffer());
      photoUrl = await uploadFile(key, bytes, file.type);
    }

    const update = await prisma.taskUpdate.create({
      data: {
        taskId: task.id,
        authorId: user.id,
        note: parsed.data.note?.trim() || null,
        photoUrl,
      },
    });

    revalidatePath(`/projects/${task.projectId}/tasks/${task.id}`);
    return ok(update);
  } catch (error) {
    return fail(error);
  }
}
