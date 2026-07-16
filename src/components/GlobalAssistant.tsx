"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import {
  Bot,
  Building2,
  ChevronDown,
  FolderKanban,
  MessageSquare,
  PanelLeft,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { AssistantConversation } from "@/components/ai-elements/AssistantConversation";
import { AssistantPromptInput } from "@/components/ai-elements/AssistantPromptInput";
import type {
  AssistantBootstrap,
  AssistantConversationDetail,
  AssistantConversationSummary,
} from "@/lib/assistant-types";

const PORTFOLIO_SUGGESTIONS = [
  "Which projects need attention today?",
  "Where are our biggest schedule risks?",
  "Compare open roadblocks across the portfolio.",
  "What should leadership focus on this week?",
];

const PROJECT_SUGGESTIONS = [
  "What is most likely to delay this project?",
  "Summarize the open roadblocks.",
  "Which tasks need attention this week?",
  "Review current RFIs and submittals.",
];

function focusProjectIdFromPath(pathname: string | null): string | null {
  const match = pathname?.match(/^\/projects\/([^/]+)/);
  const projectId = match?.[1];
  return projectId && projectId !== "new" ? projectId : null;
}

function initialTitle(prompt: string): string {
  const singleLine = prompt.replace(/\s+/g, " ").trim();
  return singleLine.length <= 54 ? singleLine : `${singleLine.slice(0, 53).trimEnd()}...`;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error ?? "Something went wrong. Please try again.");
  }
  return payload as T;
}

type ChatWorkspaceProps = {
  detail: AssistantConversationDetail;
  projectScoped: boolean;
  pendingPrompt: string | null;
  onPromptConsumed: () => void;
  onSent: (prompt: string) => void;
  onUpdated: () => void;
};

function ChatWorkspace({
  detail,
  projectScoped,
  pendingPrompt,
  onPromptConsumed,
  onSent,
  onUpdated,
}: ChatWorkspaceProps) {
  const [input, setInput] = useState("");
  const pendingSentRef = useRef(false);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/assistant/chat",
        body: { conversationId: detail.conversation.id },
      }),
    [detail.conversation.id]
  );
  const { messages, sendMessage, status, error, stop } = useChat<UIMessage>({
    id: detail.conversation.id,
    messages: detail.messages,
    transport,
    onFinish: onUpdated,
  });
  const busy = status === "submitted" || status === "streaming";

  const send = useCallback(
    (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || busy) return;
      onSent(trimmed);
      setInput("");
      void sendMessage({ text: trimmed });
    },
    [busy, onSent, sendMessage]
  );

  useEffect(() => {
    if (!pendingPrompt || pendingSentRef.current || status !== "ready") return;
    pendingSentRef.current = true;
    send(pendingPrompt);
    onPromptConsumed();
  }, [onPromptConsumed, pendingPrompt, send, status]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-canvas">
      <AssistantConversation
        messages={messages}
        busy={busy}
        suggestions={projectScoped ? PROJECT_SUGGESTIONS : PORTFOLIO_SUGGESTIONS}
        onSuggestion={send}
      />
      {error && (
        <div className="mx-auto w-full max-w-2xl px-6 pb-2 text-sm text-error" role="alert">
          {error.message}
        </div>
      )}
      <AssistantPromptInput
        value={input}
        busy={busy}
        onChange={setInput}
        onSubmit={() => send(input)}
        onStop={() => void stop()}
      />
    </div>
  );
}

export function GlobalAssistant() {
  const pathname = usePathname();
  const focusProjectId = focusProjectIdFromPath(pathname);
  const [open, setOpen] = useState(false);
  const [bootstrap, setBootstrap] = useState<AssistantBootstrap | null>(null);
  const [scopeId, setScopeId] = useState<string | null>(null);
  const [active, setActive] = useState<AssistantConversationDetail | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [railOpen, setRailOpen] = useState(false);

  const loadConversation = useCallback(async (conversationId: string) => {
    setLoading(true);
    setError(null);
    try {
      const detail = await fetchJson<AssistantConversationDetail>(
        `/api/assistant/conversations/${conversationId}`
      );
      setActive(detail);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load this conversation.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextBootstrap = await fetchJson<AssistantBootstrap>("/api/assistant/conversations");
      setBootstrap(nextBootstrap);
      const nextScope =
        focusProjectId && nextBootstrap.projects.some((project) => project.id === focusProjectId)
          ? focusProjectId
          : null;
      setScopeId(nextScope);
      const latest = nextBootstrap.conversations.find((conversation) => conversation.projectId === nextScope);
      if (latest) {
        const detail = await fetchJson<AssistantConversationDetail>(
          `/api/assistant/conversations/${latest.id}`
        );
        setActive(detail);
      } else {
        setActive(null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load BuilderBridge AI.");
    } finally {
      setLoading(false);
    }
  }, [focusProjectId]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const openWorkspace = useCallback(() => {
    setOpen(true);
    void loadWorkspace();
  }, [loadWorkspace]);

  const currentConversations = useMemo(
    () => bootstrap?.conversations.filter((conversation) => conversation.projectId === scopeId) ?? [],
    [bootstrap, scopeId]
  );
  const scopeName =
    scopeId === null
      ? "Portfolio"
      : bootstrap?.projects.find((project) => project.id === scopeId)?.name ?? "Project";

  const selectScope = useCallback(
    (projectId: string | null) => {
      setScopeId(projectId);
      setRailOpen(false);
      setPendingPrompt(null);
      const latest = bootstrap?.conversations.find((conversation) => conversation.projectId === projectId);
      if (latest) void loadConversation(latest.id);
      else setActive(null);
    },
    [bootstrap, loadConversation]
  );

  const createConversation = useCallback(
    async (prompt?: string) => {
      setLoading(true);
      setError(null);
      try {
        const conversation = await fetchJson<AssistantConversationSummary>("/api/assistant/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: scopeId }),
        });
        setBootstrap((current) =>
          current
            ? { ...current, conversations: [conversation, ...current.conversations] }
            : current
        );
        setActive({ conversation, messages: [] });
        setPendingPrompt(prompt ?? null);
        setRailOpen(false);
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : "Could not start a conversation.");
      } finally {
        setLoading(false);
      }
    },
    [scopeId]
  );

  async function deleteConversation(conversationId: string) {
      if (!window.confirm("Delete this conversation? This cannot be undone.")) return;
      try {
        const response = await fetch(`/api/assistant/conversations/${conversationId}`, { method: "DELETE" });
        if (!response.ok) throw new Error("Could not delete this conversation.");
        const remaining = bootstrap?.conversations.filter((conversation) => conversation.id !== conversationId) ?? [];
        setBootstrap((current) => (current ? { ...current, conversations: remaining } : current));
        if (active?.conversation.id === conversationId) {
          const next = remaining.find((conversation) => conversation.projectId === scopeId);
          if (next) void loadConversation(next.id);
          else setActive(null);
        }
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Could not delete this conversation.");
      }
  }

  const handleSent = useCallback((prompt: string) => {
    setActive((current) => {
      if (!current || current.conversation.messageCount > 0) return current;
      return {
        ...current,
        conversation: { ...current.conversation, title: initialTitle(prompt), messageCount: 1 },
      };
    });
    setBootstrap((current) =>
      current
        ? {
            ...current,
            conversations: current.conversations.map((conversation) =>
              conversation.id === active?.conversation.id && conversation.messageCount === 0
                ? { ...conversation, title: initialTitle(prompt), messageCount: 1 }
                : conversation
            ),
          }
        : current
    );
  }, [active?.conversation.id]);

  const refreshSummaries = useCallback(async () => {
    try {
      const nextBootstrap = await fetchJson<AssistantBootstrap>("/api/assistant/conversations");
      setBootstrap(nextBootstrap);
    } catch {
      // The streamed conversation remains usable even if refreshing its title fails.
    }
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={openWorkspace}
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-ink text-white shadow-[0_12px_30px_rgba(17,17,17,0.24)] transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 sm:bottom-6 sm:right-6"
        aria-label="Open BuilderBridge AI"
        title="BuilderBridge AI"
      >
        <Sparkles size={20} aria-hidden />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
            aria-label="Close BuilderBridge AI"
            onClick={() => setOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="BuilderBridge AI"
            className="relative flex h-full w-full max-w-[980px] overflow-hidden border-l border-hairline bg-canvas shadow-[-20px_0_60px_rgba(17,17,17,0.18)]"
          >
            <div
              className={`${railOpen ? "flex" : "hidden"} absolute inset-y-0 left-0 z-20 w-[260px] flex-col border-r border-white/10 bg-app-sidebar text-white md:static md:flex`}
            >
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-ink">
                    <Bot size={17} aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">BuilderBridge AI</p>
                    <p className="text-[11px] text-white/45">Powered by OpenRouter</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRailOpen(false)}
                  className="rounded-md p-2 text-white/55 hover:bg-white/10 hover:text-white md:hidden"
                  aria-label="Close project navigation"
                >
                  <X size={17} aria-hidden />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
                <button
                  type="button"
                  onClick={() => void createConversation()}
                  aria-label="Start new conversation"
                  className="mb-5 flex h-10 w-full items-center justify-center gap-2 rounded-md border border-white/15 bg-white text-sm font-semibold text-ink transition-colors hover:bg-white/90"
                >
                  <Plus size={16} aria-hidden />
                  New conversation
                </button>

                <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-white/35">Projects</p>
                <nav className="space-y-1" aria-label="Assistant project scopes">
                  <button
                    type="button"
                    onClick={() => selectScope(null)}
                    className={`flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm transition-colors ${scopeId === null ? "bg-white/12 text-white" : "text-white/65 hover:bg-white/7 hover:text-white"}`}
                  >
                    <FolderKanban size={15} aria-hidden />
                    <span className="truncate">Portfolio</span>
                  </button>
                  {bootstrap?.projects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => selectScope(project.id)}
                      className={`flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm transition-colors ${scopeId === project.id ? "bg-white/12 text-white" : "text-white/65 hover:bg-white/7 hover:text-white"}`}
                    >
                      <Building2 size={15} aria-hidden />
                      <span className="truncate">{project.name}</span>
                    </button>
                  ))}
                </nav>

                <div className="mb-2 mt-6 flex items-center justify-between px-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/35">Conversations</p>
                  <span className="text-[10px] text-white/30">{currentConversations.length}</span>
                </div>
                <div className="space-y-1">
                  {currentConversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      className={`group flex items-center rounded-md ${active?.conversation.id === conversation.id ? "bg-white/12" : "hover:bg-white/7"}`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          void loadConversation(conversation.id);
                          setRailOpen(false);
                        }}
                        className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left text-xs text-white/70"
                      >
                        <MessageSquare size={14} className="shrink-0 text-white/35" aria-hidden />
                        <span className="truncate">{conversation.title}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteConversation(conversation.id)}
                        className="mr-1 hidden rounded p-1.5 text-white/35 hover:bg-white/10 hover:text-white group-hover:block focus:block"
                        aria-label={`Delete ${conversation.title}`}
                        title="Delete conversation"
                      >
                        <Trash2 size={13} aria-hidden />
                      </button>
                    </div>
                  ))}
                  {!loading && currentConversations.length === 0 && (
                    <p className="px-2.5 py-2 text-xs leading-5 text-white/35">No conversations yet.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              <header className="flex h-16 shrink-0 items-center gap-3 border-b border-hairline px-4 sm:px-5">
                <button
                  type="button"
                  onClick={() => setRailOpen(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-surface-soft hover:text-ink md:hidden"
                  aria-label="Open project navigation"
                >
                  <PanelLeft size={18} aria-hidden />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{active?.conversation.title ?? "New conversation"}</p>
                  <p className="truncate text-xs text-muted">{scopeName}</p>
                </div>
                <div className="relative md:hidden">
                  <select
                    value={scopeId ?? "__portfolio__"}
                    onChange={(event) => selectScope(event.target.value === "__portfolio__" ? null : event.target.value)}
                    className="h-9 max-w-36 appearance-none rounded-md border border-hairline bg-canvas py-0 pl-3 pr-8 text-xs font-medium text-body"
                    aria-label="Choose project scope"
                  >
                    <option value="__portfolio__">Portfolio</option>
                    {bootstrap?.projects.map((project) => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-3 text-muted" aria-hidden />
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-surface-soft hover:text-ink"
                  aria-label="Close BuilderBridge AI"
                  title="Close"
                >
                  <X size={19} aria-hidden />
                </button>
              </header>

              {error && !active ? (
                <div className="flex flex-1 items-center justify-center px-6 text-center">
                  <div>
                    <p className="text-sm text-error" role="alert">{error}</p>
                    <button type="button" onClick={() => void loadWorkspace()} className="mt-4 text-sm font-semibold text-ink underline underline-offset-4">
                      Try again
                    </button>
                  </div>
                </div>
              ) : loading && !active ? (
                <div className="flex flex-1 items-center justify-center text-sm text-muted">Loading conversations...</div>
              ) : active ? (
                <ChatWorkspace
                  key={active.conversation.id}
                  detail={active}
                  projectScoped={scopeId !== null}
                  pendingPrompt={pendingPrompt}
                  onPromptConsumed={() => setPendingPrompt(null)}
                  onSent={handleSent}
                  onUpdated={refreshSummaries}
                />
              ) : (
                <div className="flex flex-1 items-center justify-center px-6">
                  <div className="max-w-sm text-center">
                    <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-md bg-ink text-white">
                      <Sparkles size={19} aria-hidden />
                    </span>
                    <h3 className="mt-5 font-display text-xl text-ink">Start with {scopeName}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">Create a conversation to explore the live project data in this scope.</p>
                    <button
                      type="button"
                      onClick={() => void createConversation()}
                      className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white hover:bg-primary-active"
                    >
                      <Plus size={16} aria-hidden />
                      New conversation
                    </button>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
