"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function UserMenu() {
  const router = useRouter();
  const { data: session } = authClient.useSession();

  if (!session?.user) return null;

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <Link href="/settings" className="text-sm text-body hidden sm:inline hover:underline" title="Settings">
        {session.user.name}
      </Link>
      <button
        onClick={handleSignOut}
        className="text-sm font-medium text-muted hover:text-ink transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}
