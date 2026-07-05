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
    <select
      value={activeOrganization?.id ?? ""}
      onChange={handleChange}
      className="h-9 rounded-md border border-hairline bg-canvas px-2.5 text-sm text-ink focus:outline-none focus:border-ink"
    >
      {organizations.map((org) => (
        <option key={org.id} value={org.id}>
          {org.name}
        </option>
      ))}
      <option value={CREATE_NEW_VALUE}>+ New organization…</option>
    </select>
  );
}
