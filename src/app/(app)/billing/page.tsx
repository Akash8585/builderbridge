import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireActiveOrganization } from "@/lib/session";
import { isBillingConfigured, PLAN_LIMITS } from "@/lib/billing";
import { BillingActions } from "@/components/BillingActions";
import { Card } from "@/components/ui/Card";
import { AppPageHeader } from "@/components/PageHeader";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const { user, organizationId } = await requireActiveOrganization();
  const { upgraded } = await searchParams;

  const [org, membership, activeProjects] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
    prisma.member.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
    }),
    prisma.project.count({ where: { organizationId, isArchived: false } }),
  ]);

  const limits = PLAN_LIMITS[org.planTier];

  return (
    <div className="app-page app-page-narrow">
      <AppPageHeader eyebrow="Organization" title="Billing" description={`${org.name} plan and project usage.`} />

      {upgraded && (
        <Card className="p-4 mb-6 border-success/40 bg-success/5">
          <p className="text-sm text-success font-medium">
            Upgrade complete — your plan updates within a few seconds once Stripe confirms the payment.
          </p>
        </Card>
      )}

      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="app-metric-label">Current plan</p>
            <p className="app-metric-value text-2xl">{limits.label}</p>
          </div>
          <div className="text-right">
            <p className="app-metric-label">Active projects</p>
            <p className="app-metric-value text-2xl">
              {activeProjects}
              <span className="text-sm text-muted-soft font-normal">
                {" "}/ {limits.activeProjects ?? "∞"}
              </span>
            </p>
          </div>
        </div>
        {org.subscriptionStatus && (
          <p className="text-xs text-muted-soft">Subscription status: {org.subscriptionStatus}</p>
        )}
      </Card>

      {isBillingConfigured() ? (
        <Card className="p-6">
          <h2 className="app-section-title mb-4">Change plan</h2>
          <BillingActions
            organizationId={organizationId}
            currentTier={org.planTier}
            hasSubscription={!!org.stripeCustomerId}
            isOwner={membership?.role === "owner"}
          />
          <p className="text-xs text-muted-soft mt-4">
            See what each plan includes on the{" "}
            <Link href="/pricing" className="underline hover:text-ink">
              pricing page
            </Link>
            .
          </p>
        </Card>
      ) : (
        <Card className="p-6">
          <h2 className="app-section-title mb-2">Change plan</h2>
          <p className="text-sm text-muted">
            Billing isn&apos;t configured on this server yet (no Stripe keys). Every organization runs on the{" "}
            <strong>Free</strong> plan — see the{" "}
            <Link href="/pricing" className="underline hover:text-ink">
              pricing page
            </Link>{" "}
            for what paid tiers will include.
          </p>
        </Card>
      )}
    </div>
  );
}
