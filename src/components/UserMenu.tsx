"use client";

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
      <span className="text-sm text-body hidden sm:inline">{session.user.name}</span>
      <button
        onClick={handleSignOut}
        className="text-sm font-medium text-muted hover:text-ink transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}
