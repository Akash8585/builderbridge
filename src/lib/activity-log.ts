import { prisma } from "@/lib/prisma";

/**
 * Append-only audit trail for schedule-relevant changes. Never throws —
 * a logging failure should never break the mutation it's describing.
 */
export async function logActivity(params: {
  projectId: string;
  taskId?: string | null;
  taskName?: string | null;
  userId: string;
  action: string;
  detail?: string | null;
}) {
  try {
    await prisma.activityLogEntry.create({
      data: {
        projectId: params.projectId,
        taskId: params.taskId ?? null,
        taskName: params.taskName ?? null,
        userId: params.userId,
        action: params.action,
        detail: params.detail ?? null,
      },
    });
  } catch {
    // Best-effort logging; swallow errors so the underlying action still succeeds.
  }
}
