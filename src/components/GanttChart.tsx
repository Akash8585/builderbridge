import { daysBetween, formatDate, TASK_STATUS_LABELS } from "@/lib/utils";
import type { TaskStatus } from "@prisma/client";

type GanttTask = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: TaskStatus;
  isRoadblock: boolean;
  assignedTo: { user: { name: string } } | null;
};

const BAR_COLORS: Record<TaskStatus, string> = {
  NOT_STARTED: "bg-surface-strong",
  IN_PROGRESS: "bg-brand-accent",
  DONE: "bg-success",
  DELAYED: "bg-error",
};

export function GanttChart({
  tasks,
  rangeStart,
  rangeEnd,
}: {
  tasks: GanttTask[];
  rangeStart: Date;
  rangeEnd: Date;
}) {
  const totalDays = Math.max(daysBetween(rangeStart, rangeEnd), 1);

  if (tasks.length === 0) {
    return <p className="text-sm text-muted py-8 text-center">No tasks to display yet.</p>;
  }

  return (
    <div className="border border-hairline rounded-lg overflow-hidden">
      <div className="flex border-b border-hairline bg-surface-soft text-xs text-muted">
        <div className="w-48 shrink-0 px-3 py-2 font-medium">Task</div>
        <div className="flex-1 px-3 py-2 flex justify-between font-medium">
          <span>{formatDate(rangeStart)}</span>
          <span>{formatDate(rangeEnd)}</span>
        </div>
      </div>
      {tasks.map((task) => {
        const offsetDays = Math.max(daysBetween(rangeStart, task.startDate), 0);
        const durationDays = Math.max(daysBetween(task.startDate, task.endDate), 1);
        const leftPct = (offsetDays / totalDays) * 100;
        const widthPct = Math.min((durationDays / totalDays) * 100, 100 - leftPct);

        return (
          <div key={task.id} className="flex items-center border-b border-hairline-soft last:border-b-0">
            <div className="w-48 shrink-0 px-3 py-3 text-sm">
              <div className="font-medium text-ink truncate">{task.name}</div>
              <div className="text-xs text-muted truncate">
                {task.assignedTo?.user.name ?? "Unassigned"}
              </div>
            </div>
            <div className="flex-1 relative h-10 px-3">
              <div className="absolute inset-y-0 my-auto h-6" style={{ left: `${leftPct}%`, width: `${widthPct}%` }}>
                <div
                  className={`h-full rounded-md ${BAR_COLORS[task.status]} flex items-center px-2 min-w-[2px]`}
                  title={`${TASK_STATUS_LABELS[task.status]}: ${formatDate(task.startDate)} – ${formatDate(task.endDate)}`}
                >
                  {task.isRoadblock && <span className="text-xs">⚠</span>}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
