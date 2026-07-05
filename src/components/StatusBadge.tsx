import type { TaskStatus } from "@prisma/client";
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from "@/lib/utils";

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-pill text-xs font-medium ${TASK_STATUS_COLORS[status]}`}
    >
      {TASK_STATUS_LABELS[status]}
    </span>
  );
}
