"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/ThemeToggle";

const subscribeToHydration = () => () => undefined;

export function UserMenu() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const mounted = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  useEffect(() => {
    const syncAssistantState = (event: Event) => {
      const open = (event as CustomEvent<{ open?: boolean }>).detail?.open;
      if (typeof open === "boolean") setAssistantOpen(open);
    };
    window.addEventListener("builderbridge:assistant-state", syncAssistantState);
    return () => window.removeEventListener("builderbridge:assistant-state", syncAssistantState);
  }, []);

  if (!mounted || !session?.user) return null;

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
        className="group flex h-8 items-center gap-2 rounded-pill px-1 pr-2 text-xs font-semibold text-body transition-colors hover:bg-surface-soft hover:text-ink"
        title="Account settings"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-strong text-[9px] font-bold text-body group-hover:bg-ink group-hover:text-canvas">
          {initials}
        </span>
        <span className="hidden max-w-28 truncate lg:inline">{session.user.name}</span>
      </Link>
      <button
        type="button"
        onClick={handleSignOut}
        className="hidden h-8 rounded-pill px-2.5 text-xs font-semibold text-muted transition-colors hover:bg-surface-soft hover:text-ink sm:inline-flex sm:items-center"
      >
        Sign out
      </button>
      <ThemeToggle />
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
        aria-label={assistantOpen ? "Close Agent" : "Open Agent"}
        title={assistantOpen ? "Return to dashboard" : "Open Agent"}
        className={`inline-flex h-8 items-center gap-2 rounded-pill px-2.5 text-xs font-semibold transition-colors ${
          assistantOpen
            ? "bg-ink text-canvas hover:bg-primary-active"
            : "border border-hairline-soft bg-canvas text-body hover:border-hairline hover:bg-surface-soft hover:text-ink"
        }`}
      >
        {assistantOpen && <LayoutDashboard size={15} aria-hidden />}
        <span>{assistantOpen ? "Dashboard" : "Agent"}</span>
      </button>
    </div>
  );
}
