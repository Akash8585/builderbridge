"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import {
  Bot,
  Building2,
  FolderKanban,
  LayoutDashboard,
  MessageSquare,
  PanelLeft,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { AssistantConversation } from "@/components/ai-elements/AssistantConversation";
import { AssistantPromptInput } from "@/components/ai-elements/AssistantPromptInput";
import type {
  AssistantAttachmentView,
  AssistantBootstrap,
  AssistantConversationDetail,
  AssistantConversationSummary,
} from "@/lib/assistant-types";
import {
  isAllowedAssistantAttachmentType,
  MAX_ASSISTANT_ATTACHMENT_BYTES,
  MAX_ASSISTANT_ATTACHMENTS,
} from "@/lib/assistant-attachments";

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
  const response = await fetch(url, { cache: "no-store", ...init });
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
  draftPrompt: string | null;
  onSent: (prompt: string) => void;
  onUpdated: () => void;
  onRecovered: (detail: AssistantConversationDetail) => void;
};

function ChatWorkspace({
  detail,
  projectScoped,
  pendingPrompt,
  onPromptConsumed,
  draftPrompt,
  onSent,
  onUpdated,
  onRecovered,
}: ChatWorkspaceProps) {
  const [input, setInput] = useState(draftPrompt ?? "");
  const [attachments, setAttachments] = useState<AssistantAttachmentView[]>([]);
  const [uploading, setUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
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

  const uploadAttachments = useCallback(
    async (files: FileList) => {
      const availableSlots = MAX_ASSISTANT_ATTACHMENTS - attachments.length;
      if (availableSlots <= 0) return;
      const selected = Array.from(files).slice(0, availableSlots);
      const invalid = selected.find(
        (file) =>
          file.size > MAX_ASSISTANT_ATTACHMENT_BYTES ||
          !isAllowedAssistantAttachmentType(file.type)
      );
      if (invalid) {
        setAttachmentError(
          invalid.size > MAX_ASSISTANT_ATTACHMENT_BYTES
            ? `${invalid.name} is larger than 20 MB.`
            : `${invalid.name} is not a supported PDF or image.`
        );
        return;
      }

      setUploading(true);
      setAttachmentError(
        files.length > availableSlots ? "You can attach up to four files per message." : null
      );
      const results = await Promise.allSettled(
        selected.map(async (file) => {
          const formData = new FormData();
          formData.set("conversationId", detail.conversation.id);
          formData.set("file", file);
          return fetchJson<AssistantAttachmentView>("/api/assistant/attachments", {
            method: "POST",
            body: formData,
          });
        })
      );
      const uploaded = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
      const failed = results.find((result) => result.status === "rejected");
      setAttachments((current) => [...current, ...uploaded].slice(0, MAX_ASSISTANT_ATTACHMENTS));
      if (failed?.status === "rejected") {
        setAttachmentError(
          failed.reason instanceof Error ? failed.reason.message : "An attachment could not be uploaded."
        );
      }
      setUploading(false);
    },
    [attachments.length, detail.conversation.id]
  );

  const removeAttachment = useCallback(async (attachmentId: string) => {
    setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
    setAttachmentError(null);
    await fetch(`/api/assistant/attachments/${attachmentId}`, { method: "DELETE" }).catch(
      () => undefined
    );
  }, []);

  const send = useCallback(
    (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || busy) return;
      const files = attachments.map((attachment) => ({
        type: "file" as const,
        filename: attachment.fileName,
        mediaType: attachment.mediaType,
        url: attachment.url,
      }));
      onSent(trimmed);
      setInput("");
      setAttachments([]);
      setAttachmentError(null);
      const expectedMessageCount = messages.length + 2;
      const adoptPersistedResponse = async () => {
        for (let attempt = 0; attempt < 30; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 4_000));
          try {
            const persisted = await fetchJson<AssistantConversationDetail>(
              `/api/assistant/conversations/${detail.conversation.id}`
            );
            if (
              persisted.messages.at(-1)?.role === "assistant" &&
              persisted.messages.length >= expectedMessageCount
            ) {
              await stop();
              onRecovered(persisted);
              return;
            }
          } catch {
            // Retry while the provider is still completing or the connection is recovering.
          }
        }
      };
      void adoptPersistedResponse();
      void sendMessage({ text: trimmed, files });
    },
    [attachments, busy, detail.conversation.id, messages.length, onRecovered, onSent, sendMessage, stop]
  );

  useEffect(() => {
    if (!pendingPrompt || pendingSentRef.current || status !== "ready") return;
    pendingSentRef.current = true;
    send(pendingPrompt);
    onPromptConsumed();
  }, [onPromptConsumed, pendingPrompt, send, status]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-transparent text-white">
      <AssistantConversation
        messages={messages}
        busy={busy}
        suggestions={projectScoped ? PROJECT_SUGGESTIONS : PORTFOLIO_SUGGESTIONS}
        onSuggestion={send}
      />
      {error && (
        <div className="mx-auto w-full max-w-3xl px-6 pb-2 text-sm text-error" role="alert">
          {error.message}
        </div>
      )}
      <AssistantPromptInput
        value={input}
        busy={busy}
        projectScoped={projectScoped}
        attachments={attachments}
        uploading={uploading}
        attachmentError={attachmentError}
        onChange={setInput}
        onFilesSelected={(files) => void uploadAttachments(files)}
        onRemoveAttachment={(attachmentId) => void removeAttachment(attachmentId)}
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
  const [draftPrompt, setDraftPrompt] = useState<string | null>(null);
  const [draftVersion, setDraftVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [railOpen, setRailOpen] = useState(false);
  const [conversationQuery, setConversationQuery] = useState("");

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

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("builderbridge:assistant-state", { detail: { open } })
    );
  }, [open]);

  useEffect(() => {
    const toggleAssistant = (event: Event) => {
      const requestedOpen = (event as CustomEvent<{ open?: boolean }>).detail?.open;
      const nextOpen = typeof requestedOpen === "boolean" ? requestedOpen : !open;
      setOpen(nextOpen);
      if (nextOpen) void loadWorkspace();
    };
    window.addEventListener("builderbridge:toggle-assistant", toggleAssistant);
    return () => window.removeEventListener("builderbridge:toggle-assistant", toggleAssistant);
  }, [loadWorkspace, open]);

  useEffect(() => {
    const openConversation = async (event: Event) => {
      const conversationId = (event as CustomEvent<{ conversationId?: string }>).detail?.conversationId;
      if (!conversationId) return;
      setOpen(true);
      setLoading(true);
      setError(null);
      try {
        const [nextBootstrap, detail] = await Promise.all([
          fetchJson<AssistantBootstrap>("/api/assistant/conversations"),
          fetchJson<AssistantConversationDetail>(`/api/assistant/conversations/${conversationId}`),
        ]);
        setBootstrap(nextBootstrap);
        setScopeId(detail.conversation.projectId);
        setActive(detail);
        setRailOpen(false);
      } catch (openError) {
        setError(openError instanceof Error ? openError.message : "Could not open this conversation.");
      } finally {
        setLoading(false);
      }
    };
    window.addEventListener("builderbridge:open-assistant-conversation", openConversation);
    return () => window.removeEventListener("builderbridge:open-assistant-conversation", openConversation);
  }, []);

  useEffect(() => {
    const askAboutFile = async (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string; fileName?: string }>).detail;
      if (!detail?.projectId || !detail.fileName) return;
      setOpen(true);
      setLoading(true);
      setError(null);
      try {
        const nextBootstrap = await fetchJson<AssistantBootstrap>("/api/assistant/conversations");
        if (!nextBootstrap.projects.some((project) => project.id === detail.projectId)) {
          throw new Error("This project is unavailable or you no longer have access.");
        }
        setBootstrap(nextBootstrap);
        setScopeId(detail.projectId);
        const latest = nextBootstrap.conversations.find(
          (conversation) => conversation.projectId === detail.projectId
        );
        if (latest) {
          setActive(
            await fetchJson<AssistantConversationDetail>(
              `/api/assistant/conversations/${latest.id}`
            )
          );
        } else {
          const conversation = await fetchJson<AssistantConversationSummary>(
            "/api/assistant/conversations",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectId: detail.projectId }),
            }
          );
          setBootstrap((current) =>
            current
              ? { ...current, conversations: [conversation, ...current.conversations] }
              : current
          );
          setActive({ conversation, messages: [] });
        }
        setDraftPrompt(`What does "${detail.fileName}" say?`);
        setDraftVersion((version) => version + 1);
        setRailOpen(false);
      } catch (openError) {
        setError(openError instanceof Error ? openError.message : "Could not open BuilderBridge AI.");
      } finally {
        setLoading(false);
      }
    };
    window.addEventListener("builderbridge:ask-project-file", askAboutFile);
    return () => window.removeEventListener("builderbridge:ask-project-file", askAboutFile);
  }, []);

  useEffect(() => {
    const raiseRfiFromFile = async (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string; fileName?: string }>).detail;
      if (!detail?.projectId || !detail.fileName) return;
      setOpen(true);
      setLoading(true);
      setError(null);
      try {
        const nextBootstrap = await fetchJson<AssistantBootstrap>("/api/assistant/conversations");
        if (!nextBootstrap.projects.some((project) => project.id === detail.projectId)) {
          throw new Error("This project is unavailable or you no longer have access.");
        }
        setBootstrap(nextBootstrap);
        setScopeId(detail.projectId);
        const latest = nextBootstrap.conversations.find(
          (conversation) => conversation.projectId === detail.projectId
        );
        if (latest) {
          setActive(
            await fetchJson<AssistantConversationDetail>(
              `/api/assistant/conversations/${latest.id}`
            )
          );
        } else {
          const conversation = await fetchJson<AssistantConversationSummary>(
            "/api/assistant/conversations",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectId: detail.projectId }),
            }
          );
          setBootstrap((current) =>
            current
              ? { ...current, conversations: [conversation, ...current.conversations] }
              : current
          );
          setActive({ conversation, messages: [] });
        }
        setDraftPrompt(`Raise an RFI from "${detail.fileName}": `);
        setDraftVersion((version) => version + 1);
        setRailOpen(false);
      } catch (openError) {
        setError(openError instanceof Error ? openError.message : "Could not open BuilderBridge AI.");
      } finally {
        setLoading(false);
      }
    };
    window.addEventListener("builderbridge:raise-rfi-from-file", raiseRfiFromFile);
    return () => window.removeEventListener("builderbridge:raise-rfi-from-file", raiseRfiFromFile);
  }, []);

  const visibleConversations = useMemo(() => {
    const query = conversationQuery.trim().toLowerCase();
    const conversations = bootstrap?.conversations ?? [];
    if (!query) return conversations;
    return conversations.filter((conversation) =>
      conversation.title.toLowerCase().includes(query)
    );
  }, [bootstrap?.conversations, conversationQuery]);
  const scopeGroups = useMemo(
    () => [
      { id: null as string | null, name: "Portfolio" },
      ...(bootstrap?.projects.map((project) => ({ id: project.id, name: project.name })) ?? []),
    ],
    [bootstrap?.projects]
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
      setDraftPrompt(null);
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
      setActive(null);
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

  const activeTitle =
    bootstrap?.conversations.find((conversation) => conversation.id === active?.conversation.id)?.title ??
    active?.conversation.title ??
    "New conversation";

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
      {open && (
        <div className="fixed inset-0 z-50 bg-[rgba(9,10,11,0.46)] backdrop-blur-[18px] backdrop-saturate-150">
          <aside
            role="dialog"
            aria-label="BuilderBridge AI"
            className="relative flex h-full w-full overflow-hidden bg-transparent before:pointer-events-none before:absolute before:left-0 before:top-0 before:z-0 before:h-4 before:w-4 before:bg-[rgba(41,34,34,0.68)] before:backdrop-blur-[38px] before:backdrop-saturate-150 before:content-[''] md:grid md:grid-cols-[280px_minmax(0,1fr)] md:before:left-[280px] lg:grid-cols-[296px_minmax(0,1fr)] lg:before:left-[296px]"
          >
            <div
              className={`${railOpen ? "flex" : "hidden"} absolute inset-y-0 left-0 z-30 w-[280px] shrink-0 flex-col bg-[rgba(41,34,34,0.68)] text-white shadow-[24px_0_60px_rgba(0,0,0,0.26)] backdrop-blur-[38px] backdrop-saturate-150 md:relative md:inset-auto md:z-10 md:flex md:w-full md:shadow-none`}
            >
              <div className="shrink-0 px-3 pb-1 pt-3">
                <div className="flex items-center gap-2">
                  <div className="grid h-9 min-w-0 flex-1 grid-cols-2 rounded-md border border-white/[0.07] bg-black/25 p-1 shadow-inner backdrop-blur-xl" aria-label="Workspace mode">
                    <button
                      type="button"
                      className="flex min-w-0 items-center justify-center gap-1.5 rounded-sm border border-white/[0.06] bg-white/[0.12] px-2 text-[11px] font-semibold text-white shadow-[0_2px_12px_rgba(0,0,0,0.18)] backdrop-blur-xl"
                      aria-pressed="true"
                    >
                      <Bot size={13} aria-hidden />
                      <span>AI Assist</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="flex min-w-0 items-center justify-center gap-1.5 rounded-sm px-2 text-[11px] font-medium text-white/45 transition-colors hover:bg-white/[0.07] hover:text-white"
                      aria-label="Return to dashboard"
                    >
                      <LayoutDashboard size={13} aria-hidden />
                      <span>Dashboard</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRailOpen(false)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white/45 hover:bg-white/[0.07] hover:text-white md:hidden"
                    aria-label="Close project navigation"
                  >
                    <X size={16} aria-hidden />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3 pt-3">
                <button
                  type="button"
                  onClick={() => void createConversation()}
                  aria-label="Start new conversation"
                  disabled={loading}
                  className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs font-medium text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white disabled:cursor-wait disabled:opacity-50"
                >
                  <Plus size={15} aria-hidden />
                  New chat
                </button>

                <label className="mt-0.5 flex h-9 items-center gap-2 rounded-md px-2.5 text-white/35 transition-colors focus-within:bg-white/[0.07] focus-within:text-white/65">
                  <Search size={14} className="shrink-0" aria-hidden />
                  <span className="sr-only">Search conversations</span>
                  <input
                    value={conversationQuery}
                    onChange={(event) => setConversationQuery(event.target.value)}
                    placeholder="Search chats"
                    className="min-w-0 flex-1 bg-transparent text-xs text-white/80 outline-none placeholder:text-white/30"
                  />
                </label>

                <p className="mb-3 mt-6 px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-white/28">Projects</p>
                <nav className="space-y-5" aria-label="Project chats">
                  {scopeGroups.map((group) => {
                    const projectConversations = visibleConversations.filter(
                      (conversation) => conversation.projectId === group.id
                    );
                    const conversationCount =
                      bootstrap?.conversations.filter(
                        (conversation) => conversation.projectId === group.id
                      ).length ?? 0;
                    const GroupIcon = group.id === null ? FolderKanban : Building2;

                    return (
                      <section key={group.id ?? "portfolio"} aria-label={`${group.name} chats`}>
                        <div className="group flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => selectScope(group.id)}
                            className={`flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-xs font-medium transition-colors ${scopeId === group.id ? "text-white" : "text-white/55 hover:bg-white/[0.05] hover:text-white/85"}`}
                          >
                            <GroupIcon size={14} className="shrink-0 text-white/35" aria-hidden />
                            <span className="truncate">{group.name}</span>
                          </button>
                          <span className="pr-2 text-[10px] tabular-nums text-white/22">
                            {conversationCount}
                          </span>
                        </div>

                        <div className="ml-3 mt-1 space-y-0.5 border-l border-white/[0.07] pl-2">
                          {projectConversations.map((conversation) => (
                            <div
                              key={conversation.id}
                              className={`group/chat flex items-center rounded-md border transition-colors ${active?.conversation.id === conversation.id ? "border-white/[0.08] bg-white/[0.1] shadow-[0_5px_18px_rgba(0,0,0,0.12)] backdrop-blur-xl" : "border-transparent hover:bg-white/[0.05]"}`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setScopeId(conversation.projectId);
                                  void loadConversation(conversation.id);
                                  setRailOpen(false);
                                }}
                                className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-[11px] text-white/48 transition-colors group-hover/chat:text-white/80"
                              >
                                <MessageSquare size={12} className="shrink-0 text-white/25" aria-hidden />
                                <span className="truncate">{conversation.title}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteConversation(conversation.id)}
                                className="mr-1 hidden rounded p-1.5 text-white/30 hover:bg-white/10 hover:text-white group-hover/chat:block focus:block"
                                aria-label={`Delete ${conversation.title}`}
                                title="Delete chat"
                              >
                                <Trash2 size={12} aria-hidden />
                              </button>
                            </div>
                          ))}
                          {!loading && !conversationQuery && conversationCount === 0 && scopeId === group.id && (
                            <p className="px-2 py-1.5 text-[11px] text-white/25">No chats yet</p>
                          )}
                        </div>
                      </section>
                    );
                  })}
                </nav>

                {!loading && conversationQuery && visibleConversations.length === 0 && (
                  <p className="mt-5 px-2 text-xs text-white/30">No matching chats.</p>
                )}
              </div>
            </div>

            <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden rounded-tl-2xl bg-[rgba(14,16,17,0.68)] backdrop-blur-[38px] backdrop-saturate-150 md:z-20">
              <header className="flex h-13 shrink-0 items-center gap-3 border-b border-white/[0.065] bg-white/[0.01] px-4 backdrop-blur-xl sm:px-5">
                <button
                  type="button"
                  onClick={() => setRailOpen(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-white/45 hover:bg-white/[0.07] hover:text-white md:hidden"
                  aria-label="Open project navigation"
                >
                  <PanelLeft size={18} aria-hidden />
                </button>
                <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white/88">
                  {activeTitle}
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-white/45 hover:bg-white/[0.07] hover:text-white md:hidden"
                  aria-label="Close BuilderBridge AI"
                  title="Return to dashboard"
                >
                  <LayoutDashboard size={18} aria-hidden />
                </button>
              </header>

              {error && !active ? (
                <div className="flex flex-1 items-center justify-center px-6 text-center">
                  <div>
                    <p className="text-sm text-error" role="alert">{error}</p>
                    <button type="button" onClick={() => void loadWorkspace()} className="mt-4 text-sm font-semibold text-white underline underline-offset-4">
                      Try again
                    </button>
                  </div>
                </div>
              ) : loading && !active ? (
                <div className="flex flex-1 items-center justify-center text-sm text-white/35">Loading conversations...</div>
              ) : active ? (
                <ChatWorkspace
                  key={`${active.conversation.id}:${active.conversation.messageCount}:${draftVersion}`}
                  detail={active}
                  projectScoped={scopeId !== null}
                  pendingPrompt={pendingPrompt}
                  onPromptConsumed={() => setPendingPrompt(null)}
                  draftPrompt={draftPrompt}
                  onSent={handleSent}
                  onUpdated={refreshSummaries}
                  onRecovered={setActive}
                />
              ) : (
                <div className="flex flex-1 items-center justify-center px-6">
                  <div className="max-w-sm text-center">
                    <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-md bg-white text-[#111211]">
                      <Sparkles size={19} aria-hidden />
                    </span>
                    <h3 className="mt-5 font-display text-xl text-white">Start with {scopeName}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/40">Create a conversation to explore the live project data in this scope.</p>
                    <button
                      type="button"
                      onClick={() => void createConversation()}
                      disabled={loading}
                      className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-[#111211] hover:bg-white/90"
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
