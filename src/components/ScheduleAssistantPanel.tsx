"use client";

import { useState } from "react";
import { askScheduleAssistant } from "@/app/actions/ai-assistant";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/ErrorText";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What's currently blocking the schedule?",
  "Which trades are behind on commitments?",
  "What's due this week?",
];

export function ScheduleAssistantPanel({ projectId }: { projectId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setError(null);
    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setQuestion("");

    const result = await askScheduleAssistant({ projectId, question: trimmed });
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setMessages((prev) => [...prev, { role: "assistant", content: result.data }]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await ask(question);
  }

  return (
    <div className="flex flex-col h-[65vh]">
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-muted mb-4">
              Ask a question about this project&apos;s schedule, roadblocks, or commitments.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="text-xs px-3 py-1.5 rounded-pill border border-hairline text-muted hover:text-ink hover:border-ink transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  m.role === "user" ? "bg-ink text-canvas" : "bg-surface-soft text-body"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))
        )}
        {loading && <div className="text-sm text-muted-soft">Thinking…</div>}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about this project's schedule…"
          maxLength={1000}
          className="h-10 flex-1 rounded-md border border-hairline bg-canvas px-3 text-sm focus:outline-none focus:border-ink"
        />
        <Button type="submit" disabled={loading || !question.trim()}>
          Ask
        </Button>
      </form>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
