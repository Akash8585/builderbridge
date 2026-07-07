"use client";

import { useState, useTransition } from "react";
import { createCheckoutSession, createBillingPortalSession } from "@/app/actions/billing";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/ErrorText";
import type { PlanTier } from "@prisma/client";

export function BillingActions({
  organizationId,
  currentTier,
  hasSubscription,
  isOwner,
}: {
  organizationId: string;
  currentTier: PlanTier;
  hasSubscription: boolean;
  isOwner: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function upgrade(tier: "CORE" | "PRO") {
    setError(null);
    startTransition(async () => {
      const result = await createCheckoutSession({ organizationId, tier });
      if (!result.success) setError(result.error);
      else window.location.href = result.data;
    });
  }

  function openPortal() {
    setError(null);
    startTransition(async () => {
      const result = await createBillingPortalSession({ organizationId });
      if (!result.success) setError(result.error);
      else window.location.href = result.data;
    });
  }

  if (!isOwner) {
    return <p className="text-sm text-muted">Only the organization owner can change the plan.</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {currentTier !== "CORE" && (
          <Button variant={currentTier === "PRO" ? "secondary" : "primary"} onClick={() => upgrade("CORE")} disabled={pending}>
            {pending ? "Redirecting…" : currentTier === "PRO" ? "Switch to Core" : "Upgrade to Core"}
          </Button>
        )}
        {currentTier !== "PRO" && (
          <Button onClick={() => upgrade("PRO")} disabled={pending}>
            {pending ? "Redirecting…" : "Upgrade to Pro"}
          </Button>
        )}
        {hasSubscription && (
          <Button variant="secondary" onClick={openPortal} disabled={pending}>
            Manage subscription
          </Button>
        )}
      </div>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
