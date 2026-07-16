"use client";

import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import { Bot, Sparkles } from "lucide-react";

export function getUIMessageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is Extract<(typeof message.parts)[number], { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

type AssistantConversationProps = {
  messages: UIMessage[];
  busy: boolean;
  suggestions: string[];
  onSuggestion: (suggestion: string) => void;
};

export function AssistantConversation({
  messages,
  busy,
  suggestions,
  onSuggestion,
}: AssistantConversationProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: busy ? "auto" : "smooth", block: "end" });
  }, [messages, busy]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
      {messages.length === 0 ? (
        <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center py-10">
          <span className="mb-5 flex h-10 w-10 items-center justify-center rounded-md bg-ink text-white">
            <Sparkles size={18} aria-hidden />
          </span>
          <h3 className="font-display text-2xl text-ink">What needs attention?</h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted">
            Ask about schedule risk, roadblocks, commitments, RFIs, submittals, or portfolio health.
          </p>
          <div className="mt-7 grid gap-2 sm:grid-cols-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onSuggestion(suggestion)}
                className="min-h-14 rounded-md border border-hairline bg-canvas px-3.5 py-3 text-left text-sm leading-5 text-body transition-colors hover:border-muted-soft hover:bg-surface-soft hover:text-ink"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-2xl space-y-7">
          {messages.map((message) => {
            const text = getUIMessageText(message);
            if (!text) return null;
            const isUser = message.role === "user";
            return (
              <div key={message.id} className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
                {!isUser && (
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ink text-white">
                    <Bot size={15} aria-hidden />
                  </span>
                )}
                <div
                  data-message-role={isUser ? "user" : "assistant"}
                  className={
                    isUser
                      ? "max-w-[82%] whitespace-pre-wrap rounded-lg bg-ink px-4 py-3 text-sm leading-6 text-white"
                      : "max-w-[calc(100%-40px)] whitespace-pre-wrap pt-0.5 text-sm leading-6 text-body"
                  }
                >
                  {text}
                </div>
              </div>
            );
          })}
          {busy && messages.at(-1)?.role === "user" && (
            <div className="flex items-center gap-3 text-muted-soft">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink text-white">
                <Bot size={15} aria-hidden />
              </span>
              <span className="flex gap-1" aria-label="BuilderBridge AI is thinking">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-soft" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-soft [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-soft [animation-delay:300ms]" />
              </span>
            </div>
          )}
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
