"use client";

import { useState, useTransition } from "react";
import { removeMember } from "@/app/actions/members";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/ErrorText";

type MemberRow = {
  id: string;
  role: "GC_OWNER" | "TRADE";
  user: { id: string; name: string; email: string };
};

const ROLE_LABELS = { GC_OWNER: "GC / Owner", TRADE: "Trade Partner" } as const;

export function ProjectMembersTable({
  projectId,
  members,
  canManage,
}: {
  projectId: string;
  members: MemberRow[];
  canManage: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);

  function handleRemove(memberId: string) {
    setError(null);
    setRemovingId(memberId);
    startTransition(async () => {
      const result = await removeMember({ projectId, memberId });
      if (!result.success) setError(result.error);
      setRemovingId(null);
    });
  }

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-hairline text-left text-muted">
            <th className="py-2 font-medium">Name</th>
            <th className="py-2 font-medium">Email</th>
            <th className="py-2 font-medium">Role</th>
            {canManage && <th className="py-2 font-medium text-right">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id} className="border-b border-hairline-soft">
              <td className="py-3">{member.user.name}</td>
              <td className="py-3 text-muted">{member.user.email}</td>
              <td className="py-3">{ROLE_LABELS[member.role]}</td>
              {canManage && (
                <td className="py-3 text-right">
                  <Button
                    variant="text"
                    className="text-error"
                    disabled={pending && removingId === member.id}
                    onClick={() => handleRemove(member.id)}
                  >
                    {pending && removingId === member.id ? "Removing…" : "Remove"}
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
