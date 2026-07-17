"use client";

import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import { Bot, ExternalLink, FileText, Image as ImageIcon, Sparkles } from "lucide-react";
import { isFileUIPart, isToolUIPart } from "ai";
import type { FileUIPart } from "ai";
import { AssistantToolResult } from "@/components/ai-elements/AssistantToolResult";

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

function AttachmentPreview({ part, userMessage }: { part: FileUIPart; userMessage: boolean }) {
  const isImage = part.mediaType.startsWith("image/");
  return (
    <a
      href={part.url}
      target="_blank"
      rel="noreferrer"
      className={`group block overflow-hidden rounded-md border transition-colors ${
        userMessage
          ? "border-white/10 bg-white/[0.06] hover:bg-white/[0.09]"
          : "border-white/[0.09] bg-white/[0.04] text-white/75 hover:border-white/15"
      }`}
    >
      {isImage && (
        // Authenticated project files must load directly in the browser so its session cookie is included.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={part.url} alt="" className="max-h-44 w-full object-cover" />
      )}
      <span className="flex min-w-0 items-center gap-2 px-3 py-2">
        {isImage ? (
          <ImageIcon size={15} className="shrink-0 opacity-70" aria-hidden />
        ) : (
          <FileText size={15} className="shrink-0 opacity-70" aria-hidden />
        )}
        <span className="min-w-0 flex-1 truncate text-xs font-medium">
          {part.filename ?? "Project attachment"}
        </span>
        <ExternalLink size={13} className="shrink-0 opacity-55 group-hover:opacity-100" aria-hidden />
      </span>
    </a>
  );
}

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
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-7 sm:px-8">
      {messages.length === 0 ? (
        <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center py-10">
          <span className="mb-5 flex h-10 w-10 items-center justify-center rounded-md bg-white text-[#111211]">
            <Sparkles size={18} aria-hidden />
          </span>
          <h3 className="font-display text-2xl text-white">What needs attention?</h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-white/40">
            Ask about schedule risk, roadblocks, commitments, RFIs, submittals, or portfolio health.
          </p>
          <div className="mt-7 grid gap-2 sm:grid-cols-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onSuggestion(suggestion)}
                className="min-h-14 rounded-md border border-white/[0.08] bg-white/[0.025] px-3.5 py-3 text-left text-sm leading-5 text-white/55 transition-colors hover:border-white/15 hover:bg-white/[0.055] hover:text-white"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl space-y-9 pb-4">
          {messages.map((message) => {
            const text = getUIMessageText(message);
            const toolParts = message.parts.filter(isToolUIPart);
            const fileParts = message.parts.filter(isFileUIPart);
            const hasToolError = toolParts.some((part) => part.state === "output-error");
            if (!text && toolParts.length === 0 && fileParts.length === 0) return null;
            const isUser = message.role === "user";
            return (
              <div key={message.id} className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
                {!isUser && (
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.05] text-white/65">
                    <Bot size={15} aria-hidden />
                  </span>
                )}
                <div
                  data-message-role={isUser ? "user" : "assistant"}
                  className={
                    isUser
                      ? "max-w-[82%] whitespace-pre-wrap rounded-lg border border-white/[0.08] bg-white/[0.08] px-4 py-3 text-sm leading-6 text-white/90"
                      : "max-w-[calc(100%-40px)] space-y-3 whitespace-pre-wrap pt-0.5 text-[15px] leading-7 text-white/72"
                  }
                >
                  {fileParts.length > 0 && (
                    <div className="grid gap-2">
                      {fileParts.map((part) => (
                        <AttachmentPreview
                          key={`${part.url}:${part.filename ?? "file"}`}
                          part={part}
                          userMessage={isUser}
                        />
                      ))}
                    </div>
                  )}
                  {toolParts.map((part) => (
                    <AssistantToolResult key={part.toolCallId} part={part} />
                  ))}
                  {text && !hasToolError && <div>{text}</div>}
                </div>
              </div>
            );
          })}
          {busy && messages.at(-1)?.role === "user" && (
            <div className="flex items-center gap-3 text-white/35">
              <span className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.05] text-white/65">
                <Bot size={15} aria-hidden />
              </span>
              <span className="flex gap-1" aria-label="BuilderBridge AI is thinking">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/35" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/35 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/35 [animation-delay:300ms]" />
              </span>
            </div>
          )}
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
