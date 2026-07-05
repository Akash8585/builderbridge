"use client";

import { useState, useTransition } from "react";
import { updateTaskStatus, deleteTask } from "@/app/actions/tasks";
import { StatusBadge } from "@/components/StatusBadge";
import { RoadblockDialog } from "@/components/RoadblockDialog";
import { EditTaskForm } from "@/components/EditTaskForm";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/ErrorText";
import { formatDate, TASK_STATUS_LABELS } from "@/lib/utils";
import type { TaskStatus, RoadblockStatus } from "@prisma/client";

export type TaskRow = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: TaskStatus;
  isRoadblock: boolean;
  roadblockNote: string | null;
  roadblockStatus: RoadblockStatus | null;
  assignedTo: { id: string; userId: string; user: { name: string } } | null;
};

export type MemberOption = { id: string; userId: string; name: string; role: "GC_OWNER" | "TRADE" };

const STATUS_OPTIONS: TaskStatus[] = ["NOT_STARTED", "IN_PROGRESS", "DONE", "DELAYED"];

export function TaskTable({
  tasks,
  members,
  currentUserId,
  isOwner,
}: {
  tasks: TaskRow[];
  members: MemberOption[];
  currentUserId: string;
  isOwner: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (tasks.length === 0) {
    return <p className="text-sm text-muted py-8 text-center">No tasks yet.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-hairline text-left text-muted">
          <th className="py-2 pr-3 font-medium">Task</th>
          <th className="py-2 pr-3 font-medium">Assigned to</th>
          <th className="py-2 pr-3 font-medium">Start</th>
          <th className="py-2 pr-3 font-medium">End</th>
          <th className="py-2 pr-3 font-medium">Status</th>
          <th className="py-2 pr-3 font-medium">Roadblock</th>
          {isOwner && <th className="py-2 font-medium text-right">Actions</th>}
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => {
          const canEdit = isOwner || task.assignedTo?.userId === currentUserId;
          if (editingId === task.id) {
            return (
              <tr key={task.id} className="border-b border-hairline-soft">
                <td colSpan={isOwner ? 7 : 6} className="py-3">
                  <EditTaskForm
                    task={task}
                    members={members}
                    onDone={() => setEditingId(null)}
                  />
                </td>
              </tr>
            );
          }
          return (
            <TaskRow
              key={task.id}
              task={task}
              canEdit={canEdit}
              isOwner={isOwner}
              onEdit={() => setEditingId(task.id)}
            />
          );
        })}
      </tbody>
    </table>
  );
}

function TaskRow({
  task,
  canEdit,
  isOwner,
  onEdit,
}: {
  task: TaskRow;
  canEdit: boolean;
  isOwner: boolean;
  onEdit: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleStatusChange(status: TaskStatus) {
    setError(null);
    startTransition(async () => {
      const result = await updateTaskStatus({ taskId: task.id, status });
      if (!result.success) setError(result.error);
    });
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteTask({ taskId: task.id });
      if (!result.success) setError(result.error);
    });
  }

  return (
    <tr className="border-b border-hairline-soft align-top">
      <td className="py-3 pr-3 font-medium text-ink">{task.name}</td>
      <td className="py-3 pr-3 text-body">{task.assignedTo?.user.name ?? "Unassigned"}</td>
      <td className="py-3 pr-3 text-muted whitespace-nowrap">{formatDate(task.startDate)}</td>
      <td className="py-3 pr-3 text-muted whitespace-nowrap">{formatDate(task.endDate)}</td>
      <td className="py-3 pr-3">
        {canEdit ? (
          <select
            value={task.status}
            disabled={pending}
            onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
            className="h-8 rounded-md border border-hairline bg-canvas px-2 text-xs focus:outline-none focus:border-ink"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        ) : (
          <StatusBadge status={task.status} />
        )}
        <ErrorText>{error}</ErrorText>
      </td>
      <td className="py-3 pr-3">
        <RoadblockDialog
          taskId={task.id}
          isRoadblock={task.isRoadblock}
          roadblockNote={task.roadblockNote}
          roadblockStatus={task.roadblockStatus}
          canResolve={canEdit}
        />
      </td>
      {isOwner && (
        <td className="py-3 text-right whitespace-nowrap">
          <Button variant="text" className="text-xs" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="text" className="text-xs text-error ml-2" onClick={handleDelete} disabled={pending}>
            Delete
          </Button>
        </td>
      )}
    </tr>
  );
}
