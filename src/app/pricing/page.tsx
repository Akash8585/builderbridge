import Link from "next/link";

const TIERS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "For trying BuilderBridge on a real project.",
    features: ["Up to 2 active projects", "Unlimited members per project", "Scheduling, Lookahead & Weekly Plan", "Roadblocks, Submittals, RFIs & Drawings", "Analytics & Activity Log"],
    cta: "Get started",
    href: "/sign-up",
    featured: false,
  },
  {
    name: "Core",
    price: "$49",
    period: "per org / month",
    description: "For teams running their projects on BuilderBridge.",
    features: ["Everything in Free", "Unlimited active projects", "Portfolio & Executive Dashboard", "AI Schedule Assistant", "Email notifications"],
    cta: "Upgrade to Core",
    href: "/billing",
    featured: false,
  },
  {
    name: "Pro",
    price: "$99",
    period: "per org / month",
    description: "For companies standardizing on one platform.",
    features: ["Everything in Core", "Procore & Autodesk integrations (coming soon)", "Priority support", "Early access to new features"],
    cta: "Upgrade to Pro",
    href: "/billing",
    featured: true,
  },
];

export default function PricingPage() {
  return (
    <div className="bg-canvas min-h-screen">
      <header className="h-16 border-b border-hairline-soft flex items-center px-6">
        <Link href="/" className="font-display text-lg">
          BuilderBridge
        </Link>
        <div className="flex-1" />
        <Link href="/sign-in" className="text-sm font-semibold text-ink hover:underline">
          Sign in
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-20">
        <h1 className="font-display text-4xl tracking-[-0.02em] text-center mb-3">Simple pricing, per organization.</h1>
        <p className="text-body text-center mb-14 max-w-xl mx-auto">
          Every plan includes unlimited project members — inviting your trades never costs extra.
        </p>

        <div className="grid md:grid-cols-3 gap-6 items-start">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-lg p-8 ${
                tier.featured
                  ? "bg-surface-dark text-on-dark"
                  : "bg-canvas border border-hairline"
              }`}
            >
              <h2 className={`text-lg font-semibold mb-1 ${tier.featured ? "text-on-dark" : "text-ink"}`}>{tier.name}</h2>
              <p className={`font-display text-3xl mb-1 ${tier.featured ? "text-on-dark" : "text-ink"}`}>{tier.price}</p>
              <p className={`text-xs mb-4 ${tier.featured ? "text-on-dark-soft" : "text-muted-soft"}`}>{tier.period}</p>
              <p className={`text-sm mb-6 ${tier.featured ? "text-on-dark-soft" : "text-body"}`}>{tier.description}</p>
              <ul className="space-y-2.5 mb-8">
                {tier.features.map((f) => (
                  <li key={f} className={`flex items-start gap-2 text-sm ${tier.featured ? "text-on-dark-soft" : "text-body"}`}>
                    <span className={tier.featured ? "text-on-dark" : "text-success"}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={tier.href}
                className={`inline-flex w-full h-10 items-center justify-center rounded-md text-sm font-semibold transition-colors ${
                  tier.featured
                    ? "bg-canvas text-ink hover:bg-surface-soft"
                    : "bg-primary text-on-primary hover:bg-primary-active"
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-soft text-center mt-10">
          Prices are placeholders while billing runs in Stripe test mode — no real charges.
        </p>
      </main>
    </div>
  );
}
