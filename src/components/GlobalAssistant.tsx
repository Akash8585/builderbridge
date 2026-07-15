"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { askAssistant } from "@/app/actions/ai-assistant";
import { stripAssistantMarkdown } from "@/lib/assistant-plain-text";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/ErrorText";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Which projects have the most open roadblocks?",
  "What's blocking the schedule right now?",
  "How is portfolio health looking?",
  "What should I focus on this week?",
];

function focusProjectIdFromPath(pathname: string | null): string | undefined {
  if (!pathname) return undefined;
  const match = pathname.match(/^\/projects\/([^/]+)/);
  const id = match?.[1];
  if (!id || id === "new") return undefined;
  return id;
}

export function GlobalAssistant() {
  const pathname = usePathname();
  const focusProjectId = focusProjectIdFromPath(pathname);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setError(null);
    setLoading(true);

    const history = messages;
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setQuestion("");

    const result = await askAssistant({
      question: trimmed,
      focusProjectId,
      history,
    });
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setMessages((prev) => [...prev, { role: "assistant", content: stripAssistantMarkdown(result.data) }]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await ask(question);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-ink text-canvas shadow-[0_12px_30px_rgba(17,17,17,0.24)] transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 sm:bottom-6 sm:right-6"
        aria-label="Open AI assistant"
        title="AI Assistant"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3c4.97 0 9 3.58 9 8 0 2.13-.9 4.07-2.38 5.5L19 21l-4.5-2.2C13.7 19.27 12.86 19.35 12 19.35 7.03 19.35 3 15.77 3 11 3 6.58 7.03 3 12 3Z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-ink/20"
            aria-label="Close assistant"
            onClick={close}
          />
          <aside
            role="dialog"
            aria-label="AI Assistant"
            className="relative flex h-full w-full max-w-lg flex-col border-l border-hairline bg-app-bg shadow-[-16px_0_40px_rgba(17,17,17,0.14)]"
          >
            <header className="flex shrink-0 items-center justify-between border-b border-white/10 bg-ink px-5 py-4 text-white">
              <div>
                <h2 className="font-display text-lg">AI Assistant</h2>
                <p className="text-xs text-white/60">
                  {focusProjectId ? "Portfolio + current project context" : "Portfolio-wide context"}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-md p-2 text-white/60 hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
              </button>
            </header>

            <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
              <div className="flex-1 space-y-4 overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="mb-4 text-sm text-muted">
                      Ask about your projects, schedule, roadblocks, or how BuilderBridge works.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => ask(s)}
                          className="rounded-md border border-hairline bg-canvas px-3 py-2 text-left text-xs text-muted transition-colors hover:border-muted-soft hover:text-ink"
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
                        className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-4 py-2.5 text-sm ${
                          m.role === "user" ? "bg-ink text-canvas" : "border border-hairline bg-canvas text-body"
                        }`}
                      >
                        {m.content}
                      </div>
                    </div>
                  ))
                )}
                {loading && <div className="text-sm text-muted-soft">Thinking…</div>}
              </div>

              <form onSubmit={handleSubmit} className="mt-4 flex shrink-0 items-center gap-2 border-t border-hairline pt-4">
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask anything about your work…"
                  maxLength={1000}
                  className="h-10 flex-1 rounded-md border border-hairline bg-canvas px-3 text-sm shadow-sm focus:border-ink focus:outline-none"
                />
                <Button type="submit" disabled={loading || !question.trim()}>
                  Ask
                </Button>
              </form>
              <ErrorText>{error}</ErrorText>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
