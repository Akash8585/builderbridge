"use client";

import { useState, useTransition } from "react";
import { createRfi, answerRfi, closeRfi } from "@/app/actions/rfis";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/ErrorText";
import { RFI_STATUS_LABELS, formatDate } from "@/lib/utils";
import type { RfiStatus, IntegrationSource } from "@prisma/client";

export type RfiRow = {
  id: string;
  question: string;
  answer: string | null;
  status: RfiStatus;
  source: IntegrationSource;
  dueDate: Date | null;
  createdAt: Date;
  raisedBy: { user: { name: string } };
  task: { id: string; name: string } | null;
};

export type TaskOption = { id: string; name: string };

const STATUS_COLORS: Record<RfiStatus, string> = {
  OPEN: "text-muted",
  ANSWERED: "text-success",
  CLOSED: "text-muted-soft",
};

export function RfiList({
  projectId,
  rfis,
  tasks,
  canAnswer,
}: {
  projectId: string;
  rfis: RfiRow[];
  tasks: TaskOption[];
  canAnswer: boolean;
}) {
  return (
    <div className="space-y-6">
      <NewRfiForm projectId={projectId} tasks={tasks} />

      {rfis.length === 0 ? (
        <p className="text-sm text-muted text-center py-6">No RFIs match this filter.</p>
      ) : (
        <ul className="space-y-3">
          {rfis.map((r) => (
            <RfiCard key={r.id} rfi={r} canAnswer={canAnswer} />
          ))}
        </ul>
      )}
    </div>
  );
}

function NewRfiForm({ projectId, tasks }: { projectId: string; tasks: TaskOption[] }) {
  const [question, setQuestion] = useState("");
  const [taskId, setTaskId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await createRfi({ projectId, question, taskId: taskId || null, dueDate: dueDate || null });
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setQuestion("");
    setTaskId("");
    setDueDate("");
  }

  return (
    <form onSubmit={handleSubmit} className="border border-hairline rounded-lg p-4 bg-surface-soft">
      <h3 className="text-sm font-semibold mb-3">Raise an RFI</h3>
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="What needs clarification?"
        rows={2}
        maxLength={1000}
        className="w-full text-sm rounded-md border border-hairline px-3 py-2 focus:outline-none focus:border-ink resize-none mb-3"
      />
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          className="h-10 rounded-md border border-hairline bg-canvas px-3 text-sm focus:outline-none focus:border-ink"
        >
          <option value="">No linked task</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          title="Response needed by (optional)"
          className="h-10 rounded-md border border-hairline bg-canvas px-3 text-sm focus:outline-none focus:border-ink"
        />
        <Button type="submit" variant="secondary" disabled={loading || !question.trim()}>
          {loading ? "Submitting…" : "Submit"}
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}

function RfiCard({ rfi, canAnswer }: { rfi: RfiRow; canAnswer: boolean }) {
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isOverdue = rfi.status === "OPEN" && rfi.dueDate && new Date(rfi.dueDate) < new Date();

  function handleAnswer() {
    setError(null);
    startTransition(async () => {
      const result = await answerRfi({ rfiId: rfi.id, answer });
      if (!result.success) setError(result.error);
      else setAnswer("");
    });
  }

  function handleClose() {
    setError(null);
    startTransition(async () => {
      const result = await closeRfi({ rfiId: rfi.id });
      if (!result.success) setError(result.error);
    });
  }

  return (
    <li className="border border-hairline rounded-lg p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-ink">{rfi.question}</span>
        <span className={`text-xs font-medium ${STATUS_COLORS[rfi.status]}`}>{RFI_STATUS_LABELS[rfi.status]}</span>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted mb-2">
        {rfi.source === "PROCORE" && <span className="text-muted-soft">From Procore</span>}
        {rfi.task && <span>Task: {rfi.task.name}</span>}
        {rfi.dueDate && (
          <span className={isOverdue ? "text-error font-medium" : undefined}>
            Due {formatDate(rfi.dueDate)}
            {isOverdue ? " — overdue" : ""}
          </span>
        )}
        <span>Raised by {rfi.raisedBy.user.name}</span>
      </div>
      {rfi.answer && <p className="text-sm text-body mb-2">Answer: {rfi.answer}</p>}
      {canAnswer && rfi.status === "OPEN" && (
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type an answer…"
            className="h-8 flex-1 min-w-[180px] rounded-md border border-hairline bg-canvas px-2 text-xs focus:outline-none focus:border-ink"
          />
          <Button variant="secondary" className="h-8 px-2 text-xs" onClick={handleAnswer} disabled={pending || !answer.trim()}>
            Answer
          </Button>
          <Button variant="text" className="h-8 px-2 text-xs text-muted" onClick={handleClose} disabled={pending}>
            Close
          </Button>
        </div>
      )}
      {canAnswer && rfi.status === "ANSWERED" && (
        <Button variant="text" className="h-7 px-2 text-xs text-muted mt-2" onClick={handleClose} disabled={pending}>
          Close
        </Button>
      )}
      <ErrorText>{error}</ErrorText>
    </li>
  );
}
