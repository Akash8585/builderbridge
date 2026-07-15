"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function UserMenu() {
  const router = useRouter();
  const { data: session } = authClient.useSession();

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
    </div>
  );
}
