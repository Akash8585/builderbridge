"use client";

import { useEffect, useRef } from "react";
import { Send, Square } from "lucide-react";

type AssistantPromptInputProps = {
  value: string;
  busy: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
};

export function AssistantPromptInput({
  value,
  busy,
  disabled,
  onChange,
  onSubmit,
  onStop,
}: AssistantPromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 144)}px`;
  }, [value]);

  return (
    <form
      className="border-t border-hairline bg-canvas px-4 py-4 sm:px-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy && !disabled && value.trim()) onSubmit();
      }}
    >
      <div className="mx-auto flex max-w-2xl items-end gap-2 rounded-lg border border-hairline bg-canvas p-2 shadow-[0_8px_28px_rgba(17,17,17,0.08)] focus-within:border-muted-soft">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Ask BuilderBridge AI"
          maxLength={4000}
          rows={1}
          disabled={disabled}
          className="min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-6 text-ink outline-none placeholder:text-muted-soft disabled:cursor-not-allowed"
          aria-label="Message BuilderBridge AI"
        />
        {busy ? (
          <button
            type="button"
            onClick={onStop}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ink text-white transition-colors hover:bg-primary-active"
            aria-label="Stop response"
            title="Stop response"
          >
            <Square size={14} fill="currentColor" aria-hidden />
          </button>
        ) : (
          <button
            type="submit"
            disabled={disabled || !value.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ink text-white transition-colors hover:bg-primary-active disabled:bg-primary-disabled disabled:text-muted"
            aria-label="Send message"
            title="Send message"
          >
            <Send size={16} aria-hidden />
          </button>
        )}
      </div>
    </form>
  );
}
