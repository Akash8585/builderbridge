"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, LayoutDashboard } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function UserMenu() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [assistantOpen, setAssistantOpen] = useState(false);

  useEffect(() => {
    const syncAssistantState = (event: Event) => {
      const open = (event as CustomEvent<{ open?: boolean }>).detail?.open;
      if (typeof open === "boolean") setAssistantOpen(open);
    };
    window.addEventListener("builderbridge:assistant-state", syncAssistantState);
    return () => window.removeEventListener("builderbridge:assistant-state", syncAssistantState);
  }, []);

  if (!session?.user) return null;

  const initials = session.user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1.5">
      <Link
        href="/settings"
        className="group flex h-9 items-center gap-2 rounded-md px-1.5 pr-2 text-sm text-body transition-colors hover:bg-surface-soft hover:text-ink"
        title="Account settings"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-strong text-[10px] font-bold text-body group-hover:bg-ink group-hover:text-white">
          {initials}
        </span>
        <span className="hidden max-w-28 truncate lg:inline">{session.user.name}</span>
      </Link>
      <button
        type="button"
        onClick={handleSignOut}
        className="hidden h-9 rounded-md px-2 text-xs font-medium text-muted transition-colors hover:bg-surface-soft hover:text-ink sm:inline-flex sm:items-center"
      >
        Sign out
      </button>
      <button
        type="button"
        onClick={() => {
          const open = !assistantOpen;
          setAssistantOpen(open);
          window.dispatchEvent(
            new CustomEvent("builderbridge:toggle-assistant", { detail: { open } })
          );
        }}
        aria-pressed={assistantOpen}
        aria-label={assistantOpen ? "Close BuilderBridge AI" : "Open BuilderBridge AI"}
        title={assistantOpen ? "Return to dashboard" : "Open AI workspace"}
        className={`inline-flex h-9 items-center gap-2 rounded-md px-2.5 text-xs font-semibold transition-colors ${
          assistantOpen
            ? "bg-ink text-white hover:bg-primary-active"
            : "border border-hairline bg-canvas text-body hover:bg-surface-soft hover:text-ink"
        }`}
      >
        {assistantOpen ? <LayoutDashboard size={15} aria-hidden /> : <Bot size={15} aria-hidden />}
        <span className="hidden xl:inline">{assistantOpen ? "Dashboard" : "AI workspace"}</span>
      </button>
    </div>
  );
}
