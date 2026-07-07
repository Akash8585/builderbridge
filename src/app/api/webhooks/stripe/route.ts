import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { getStripe, tierForPriceId } from "@/lib/billing";

/**
 * Stripe subscription lifecycle webhook. Configure the endpoint in the Stripe
 * dashboard (or `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
 * in dev) and set STRIPE_WEBHOOK_SECRET.
 */
export async function POST(request: Request) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Billing not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = await getStripe().webhooks.constructEventAsync(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const organizationId = session.metadata?.organizationId;
        const tier = session.metadata?.tier;
        if (organizationId && (tier === "CORE" || tier === "PRO")) {
          await prisma.organization.update({
            where: { id: organizationId },
            data: {
              planTier: tier,
              stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
              stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : null,
              subscriptionStatus: "active",
            },
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const organizationId = subscription.metadata?.organizationId;
        if (!organizationId) break;

        const priceId = subscription.items.data[0]?.price?.id;
        const tier = priceId ? tierForPriceId(priceId) : null;
        const isActive = subscription.status === "active" || subscription.status === "trialing";
        await prisma.organization.update({
          where: { id: organizationId },
          data: {
            subscriptionStatus: subscription.status,
            // Downgrade to FREE when the subscription stops being usable
            // (canceled/unpaid); keep/set the paid tier while it's active.
            planTier: isActive && tier ? tier : isActive ? undefined : "FREE",
            stripeSubscriptionId: subscription.id,
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const organizationId = subscription.metadata?.organizationId;
        if (!organizationId) break;
        await prisma.organization.update({
          where: { id: organizationId },
          data: { planTier: "FREE", subscriptionStatus: "canceled", stripeSubscriptionId: null },
        });
        break;
      }
    }
  } catch {
    // Return 500 so Stripe retries — e.g. transient DB failure.
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
