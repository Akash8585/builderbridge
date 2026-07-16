"use client";

import { useEffect, useRef } from "react";
import { FileText, Image as ImageIcon, LoaderCircle, Paperclip, Send, Square, X } from "lucide-react";
import {
  formatAttachmentBytes,
  MAX_ASSISTANT_ATTACHMENTS,
} from "@/lib/assistant-attachments";
import type { AssistantAttachmentView } from "@/lib/assistant-types";

type AssistantPromptInputProps = {
  value: string;
  busy: boolean;
  disabled?: boolean;
  projectScoped: boolean;
  attachments: AssistantAttachmentView[];
  uploading: boolean;
  attachmentError: string | null;
  onChange: (value: string) => void;
  onFilesSelected: (files: FileList) => void;
  onRemoveAttachment: (attachmentId: string) => void;
  onSubmit: () => void;
  onStop: () => void;
};

export function AssistantPromptInput({
  value,
  busy,
  disabled,
  projectScoped,
  attachments,
  uploading,
  attachmentError,
  onChange,
  onFilesSelected,
  onRemoveAttachment,
  onSubmit,
  onStop,
}: AssistantPromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      {(attachments.length > 0 || attachmentError) && (
        <div className="mx-auto mb-2 max-w-2xl">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((attachment) => {
                const isImage = attachment.mediaType.startsWith("image/");
                const Icon = isImage ? ImageIcon : FileText;
                return (
                  <div
                    key={attachment.id}
                    className="flex min-w-0 max-w-full items-center gap-2 rounded-md border border-hairline bg-surface-soft px-2.5 py-2"
                  >
                    <Icon size={15} className="shrink-0 text-muted" aria-hidden />
                    <div className="min-w-0">
                      <p className="max-w-52 truncate text-xs font-medium text-ink">{attachment.fileName}</p>
                      <p className="text-[11px] text-muted">{formatAttachmentBytes(attachment.sizeBytes)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveAttachment(attachment.id)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-muted transition-colors hover:bg-canvas hover:text-ink"
                      aria-label={`Remove ${attachment.fileName}`}
                      title="Remove attachment"
                    >
                      <X size={13} aria-hidden />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {attachmentError && <p className="mt-2 text-xs text-error">{attachmentError}</p>}
        </div>
      )}
      <div className="mx-auto flex max-w-2xl items-end gap-2 rounded-lg border border-hairline bg-canvas p-2 shadow-[0_8px_28px_rgba(17,17,17,0.08)] focus-within:border-muted-soft">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(event) => {
            if (event.target.files?.length) onFilesSelected(event.target.files);
            event.target.value = "";
          }}
          aria-label="Choose project attachments"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={
            disabled ||
            uploading ||
            !projectScoped ||
            attachments.length >= MAX_ASSISTANT_ATTACHMENTS
          }
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-soft hover:text-ink disabled:cursor-not-allowed disabled:text-muted-soft"
          aria-label="Attach project files"
          title={projectScoped ? "Attach PDF or image" : "Choose a project conversation to attach files"}
        >
          {uploading ? (
            <LoaderCircle size={16} className="animate-spin" aria-hidden />
          ) : (
            <Paperclip size={16} aria-hidden />
          )}
        </button>
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
