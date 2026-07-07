import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import type { PlanTier } from "@prisma/client";

/**
 * Stripe billing. Gracefully degrades: without STRIPE_SECRET_KEY every org
 * stays on FREE, the billing UI shows a "not configured" notice, and no
 * feature gate below FREE limits is ever hit accidentally in dev (the FREE
 * limits themselves still apply — that's product behavior, not billing infra).
 */

export function isBillingConfigured(): boolean {
  return !!(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_CORE && env.STRIPE_PRICE_PRO);
}

let stripeClient: Stripe | null = null;
export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) throw new Error("Billing isn't configured on this server");
  if (!stripeClient) stripeClient = new Stripe(env.STRIPE_SECRET_KEY);
  return stripeClient;
}

/** Product limits per tier. null = unlimited. */
export const PLAN_LIMITS: Record<PlanTier, { activeProjects: number | null; label: string }> = {
  FREE: { activeProjects: 2, label: "Free" },
  CORE: { activeProjects: null, label: "Core" },
  PRO: { activeProjects: null, label: "Pro" },
};

export function priceIdForTier(tier: "CORE" | "PRO"): string {
  const priceId = tier === "CORE" ? env.STRIPE_PRICE_CORE : env.STRIPE_PRICE_PRO;
  if (!priceId) throw new Error("Billing isn't configured on this server");
  return priceId;
}

export function tierForPriceId(priceId: string): PlanTier | null {
  if (priceId === env.STRIPE_PRICE_CORE) return "CORE";
  if (priceId === env.STRIPE_PRICE_PRO) return "PRO";
  return null;
}

/**
 * Pure limit check, separated for unit testing: can this org create another
 * active project on its tier?
 */
export function canCreateProject(tier: PlanTier, currentActiveProjects: number): boolean {
  const limit = PLAN_LIMITS[tier].activeProjects;
  return limit === null || currentActiveProjects < limit;
}

export async function assertCanCreateProject(organizationId: string): Promise<void> {
  const [org, activeCount] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { planTier: true },
    }),
    prisma.project.count({ where: { organizationId, isArchived: false } }),
  ]);

  if (!canCreateProject(org.planTier, activeCount)) {
    const limit = PLAN_LIMITS[org.planTier].activeProjects;
    throw new Error(
      `The ${PLAN_LIMITS[org.planTier].label} plan allows ${limit} active project${limit === 1 ? "" : "s"}. ` +
        `Archive a project or upgrade on the Billing page.`
    );
  }
}
