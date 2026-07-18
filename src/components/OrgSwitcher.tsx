"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const CREATE_NEW_VALUE = "__create_new__";

export function OrgSwitcher() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { data: organizations } = authClient.useListOrganizations();
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const { refetch: refetchSession } = authClient.useSession();

  // Better Auth's client hooks can already have cached data on the very first
  // client render, while the server always renders nothing for this — gate
  // on `mounted` so both the SSR pass and the first client pass agree (null),
  // avoiding a hydration mismatch on the <select>. This is the standard
  // mount-detection escape hatch, so intentionally set state directly here.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  if (!mounted || !organizations || organizations.length === 0) return null;

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    if (value === CREATE_NEW_VALUE) {
      router.push("/organizations/new");
      return;
    }
    await authClient.organization.setActive({ organizationId: value });
    await refetchSession();
    router.refresh();
  }

  return (
    <label className="relative block min-w-0">
      <span className="sr-only">Active organization</span>
      <select
        value={activeOrganization?.id ?? ""}
        onChange={handleChange}
        className="h-8 max-w-[132px] appearance-none truncate rounded-pill border border-hairline-soft bg-surface-soft pl-3 pr-8 text-xs font-semibold text-ink transition-colors hover:border-hairline focus:border-ink focus:outline-none sm:max-w-[190px]"
      >
        {organizations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
        <option value={CREATE_NEW_VALUE}>+ New organization...</option>
      </select>
      <svg
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
      >
        <path d="m7 10 5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}
