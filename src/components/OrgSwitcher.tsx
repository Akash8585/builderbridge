"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const CREATE_NEW_VALUE = "__create_new__";

export function OrgSwitcher() {
  const router = useRouter();
  const { data: organizations } = authClient.useListOrganizations();
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const { refetch: refetchSession } = authClient.useSession();

  if (!organizations || organizations.length === 0) return null;

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
