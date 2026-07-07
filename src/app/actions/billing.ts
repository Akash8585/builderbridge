"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { env } from "@/lib/env";
import { getStripe, priceIdForTier, isBillingConfigured } from "@/lib/billing";
import { ok, fail, type ActionResult } from "./schemas";

/** Only an organization owner (Better Auth org role) may manage billing. */
async function requireOrgOwner(userId: string, organizationId: string) {
  const membership = await prisma.member.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
  if (!membership || membership.role !== "owner") {
    throw new Error("Only the organization owner can manage billing");
  }
}

const checkoutSchema = z.object({
  organizationId: z.string().min(1),
  tier: z.enum(["CORE", "PRO"]),
});

export async function createCheckoutSession(input: unknown): Promise<ActionResult<string>> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    if (!isBillingConfigured()) throw new Error("Billing isn't configured on this server");
    const user = await requireUser();
    await requireOrgOwner(user.id, parsed.data.organizationId);

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: parsed.data.organizationId },
    });

    const baseUrl = env.BETTER_AUTH_URL.replace(/\/$/, "");
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceIdForTier(parsed.data.tier), quantity: 1 }],
      success_url: `${baseUrl}/billing?upgraded=1`,
      cancel_url: `${baseUrl}/billing`,
      ...(org.stripeCustomerId ? { customer: org.stripeCustomerId } : { customer_email: user.email }),
      metadata: { organizationId: org.id, tier: parsed.data.tier },
      subscription_data: { metadata: { organizationId: org.id } },
    });

    if (!session.url) throw new Error("Stripe didn't return a checkout URL");
    return ok(session.url);
  } catch (error) {
    return fail(error);
  }
}

const portalSchema = z.object({ organizationId: z.string().min(1) });

export async function createBillingPortalSession(input: unknown): Promise<ActionResult<string>> {
  const parsed = portalSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    if (!isBillingConfigured()) throw new Error("Billing isn't configured on this server");
    const user = await requireUser();
    await requireOrgOwner(user.id, parsed.data.organizationId);

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: parsed.data.organizationId },
    });
    if (!org.stripeCustomerId) throw new Error("No subscription yet — upgrade first");

    const baseUrl = env.BETTER_AUTH_URL.replace(/\/$/, "");
    const session = await getStripe().billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${baseUrl}/billing`,
    });
    return ok(session.url);
  } catch (error) {
    return fail(error);
  }
}
