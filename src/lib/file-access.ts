import { prisma } from "@/lib/prisma";
import { requireProjectMember } from "@/lib/permissions";
import { normalizeStorageKey } from "@/lib/storage";

export type StorageScope =
  | { kind: "PROJECT"; projectId: string }
  | { kind: "TASK"; taskId: string };

export function storageScopeForKey(key: string): StorageScope {
  const parts = normalizeStorageKey(key).split("/");
  if (parts[0] === "drawings" && parts[1]) {
    return { kind: "PROJECT", projectId: parts[1] };
  }
  if (parts[0] === "documents" && parts[1]) {
    return { kind: "PROJECT", projectId: parts[1] };
  }
  if (parts[0] === "tasks" && parts[1]) {
    return { kind: "TASK", taskId: parts[1] };
  }
  throw new Error("Unsupported storage path");
}

export async function requireStoredFileAccess(userId: string, key: string): Promise<void> {
  const scope = storageScopeForKey(key);
  if (scope.kind === "PROJECT") {
    await requireProjectMember(userId, scope.projectId);
    return;
  }
  const task = await prisma.task.findUnique({
    where: { id: scope.taskId },
    select: { projectId: true },
  });
  if (!task) throw new Error("File not found");
  await requireProjectMember(userId, task.projectId);
}
