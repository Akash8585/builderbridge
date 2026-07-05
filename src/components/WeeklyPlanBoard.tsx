"use client";

import { useState, useTransition } from "react";
import { commitToWeek, updateCommitmentStatus } from "@/app/actions/weekly-plan";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/ErrorText";
import { COMMITMENT_STATUS_LABELS } from "@/lib/utils";
import type { CommitmentStatus } from "@prisma/client";

export type CommitmentRow = {
  id: string;
  status: CommitmentStatus;
  reasonForVariance: string | null;
  task: { id: string; name: string };
  committedBy: { user: { name: string } };
};

export type CommittableTask = { id: string; name: string };

const STATUS_OPTIONS: CommitmentStatus[] = ["COMMITTED", "COMPLETED", "NOT_COMPLETED"];

export function WeeklyPlanBoard({
  weekStartDate,
  commitments,
  committableTasks,
}: {
  weekStartDate: string;
  commitments: CommitmentRow[];
  committableTasks: CommittableTask[];
}) {
  return (
    <div className="space-y-4">
      {commitments.length === 0 ? (
        <p className="text-sm text-muted py-4 text-center">No commitments for this week yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-muted">
              <th className="py-2 pr-3 font-medium">Task</th>
              <th className="py-2 pr-3 font-medium">Committed by</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {commitments.map((c) => (
              <CommitmentRowView key={c.id} commitment={c} />
            ))}
          </tbody>
        </table>
      )}

      {committableTasks.length > 0 && <CommitForm weekStartDate={weekStartDate} tasks={committableTasks} />}
    </div>
  );
}

function CommitmentRowView({ commitment }: { commitment: CommitmentRow }) {
  const [status, setStatus] = useState(commitment.status);
  const [reason, setReason] = useState(commitment.reasonForVariance ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleStatusChange(next: CommitmentStatus) {
    setStatus(next);
    setError(null);
    if (next !== "NOT_COMPLETED") {
      startTransition(async () => {
        const result = await updateCommitmentStatus({ commitmentId: commitment.id, status: next });
        if (!result.success) setError(result.error);
      });
    }
  }

  function handleSaveReason() {
    setError(null);
    startTransition(async () => {
      const result = await updateCommitmentStatus({
        commitmentId: commitment.id,
        status: "NOT_COMPLETED",
        reasonForVariance: reason,
      });
      if (!result.success) setError(result.error);
    });
  }

  return (
    <tr className="border-b border-hairline-soft align-top">
      <td className="py-3 pr-3 font-medium text-ink">{commitment.task.name}</td>
      <td className="py-3 pr-3 text-muted">{commitment.committedBy.user.name}</td>
      <td className="py-3">
        <select
          value={status}
          disabled={pending}
          onChange={(e) => handleStatusChange(e.target.value as CommitmentStatus)}
          className="h-8 rounded-md border border-hairline bg-canvas px-2 text-xs focus:outline-none focus:border-ink disabled:opacity-50"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {COMMITMENT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        {status === "NOT_COMPLETED" && (
          <div className="mt-2 flex items-center gap-2">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for variance"
              className="h-8 flex-1 min-w-[160px] rounded-md border border-hairline bg-canvas px-2 text-xs focus:outline-none focus:border-ink"
            />
            <Button variant="secondary" className="h-8 px-2 text-xs" onClick={handleSaveReason} disabled={pending}>
              Save
            </Button>
          </div>
        )}
        <ErrorText>{error}</ErrorText>
      </td>
    </tr>
  );
}

function CommitForm({ weekStartDate, tasks }: { weekStartDate: string; tasks: CommittableTask[] }) {
  const [taskId, setTaskId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCommit() {
    if (!taskId) return;
    setError(null);
    setLoading(true);
    const result = await commitToWeek({ taskId, weekStartDate });
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setTaskId("");
  }

  return (
    <div className="border border-hairline rounded-lg p-4 bg-surface-soft">
      <h3 className="text-sm font-semibold mb-3">Commit a task to this week</h3>
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          className="h-10 rounded-md border border-hairline bg-canvas px-3 text-sm focus:outline-none focus:border-ink"
        >
          <option value="">Select a task…</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <Button variant="secondary" onClick={handleCommit} disabled={loading || !taskId}>
          {loading ? "Committing…" : "Commit"}
        </Button>
      </div>
      <p className="text-xs text-muted-soft mt-2">
        Once committed, this can&apos;t be un-committed — only marked completed or not completed with a reason.
      </p>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
