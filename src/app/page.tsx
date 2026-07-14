import Link from "next/link";
import { getCurrentSession } from "@/lib/session";
import { LandingHero } from "@/components/LandingHero";
import { LandingMegaNav } from "@/components/LandingMegaNav";

export default async function LandingPage() {
  const session = await getCurrentSession();
  const isSignedIn = !!session?.user;

  return (
    <div className="bg-canvas text-ink">
      <LandingMegaNav isSignedIn={isSignedIn} />
      <LandingHero isSignedIn={isSignedIn} />
      <RolesBand />
      <FeatureBands />
      <ValueBand />
      <CtaBand isSignedIn={isSignedIn} />
      <Footer />
    </div>
  );
}

/* ---------- Roles band (4-up feature-icon-cards, mirrors Outbuild's persona grid) ---------- */

const ROLES = [
  {
    title: "Project Managers",
    description: "Full visibility and control — schedules, members, documents, and health metrics for every project in one place.",
  },
  {
    title: "Schedulers",
    description: "Build the master schedule with dependencies and critical path, then keep it honest as the field reports back.",
  },
  {
    title: "Superintendents",
    description: "Run lookaheads and pull-planning sessions, own roadblocks, and keep weekly commitments on track.",
  },
  {
    title: "Trade Partners",
    description: "See your tasks, commit to your week, flag what's blocking you, and post progress straight from the field.",
  },
];

function RolesBand() {
  return (
    <section id="roles" className="bg-surface-soft border-y border-hairline-soft">
      <div className="max-w-6xl mx-auto px-6 py-24">
        <h2 className="font-display text-3xl sm:text-4xl tracking-[-0.02em] mb-3 text-center">
          One schedule, every stakeholder.
        </h2>
        <p className="text-body text-center mb-12 max-w-2xl mx-auto">
          Per-project roles mean everyone gets the right level of access — from the office to the jobsite.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {ROLES.map((role) => (
            <div key={role.title} className="rounded-lg border border-hairline bg-canvas p-6">
              <h3 className="text-base font-semibold mb-2">{role.title}</h3>
              <p className="text-sm text-body leading-relaxed">{role.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Feature bands (alternating rows, mirrors Outbuild's 4 product sections) ---------- */

function FeatureBands() {
  return (
    <section id="features" className="max-w-6xl mx-auto px-6 py-24 space-y-24">
      <FeatureRow
        eyebrow="Project scheduling"
        title="Scheduling projects made easy."
        body="Create tasks with dependencies and let the critical path surface itself on the Gantt. Every change is logged — who, when, and what it impacts."
        mockup={<GanttMockup />}
      />
      <FeatureRow
        flip
        eyebrow="Integrated lookahead"
        title="Lookaheads straight from the master schedule."
        body="A rolling 2-6 week window of upcoming work, always in sync. Run pull-planning sessions where trades add their own tasks and the field sequences the work."
        mockup={<LookaheadMockup />}
      />
      <FeatureRow
        eyebrow="Weekly work plan"
        title="Promote field team accountability."
        body="Trades commit to their week, track completion, and log reasons for variance. Percent Plan Complete is computed automatically — no spreadsheets."
        mockup={<WeeklyPlanMockup />}
      />
      <FeatureRow
        flip
        eyebrow="Analytics"
        title="Track the data points that matter."
        body="PPC trends, Promise Reliability Rate, S-Curves, baselines, and a portfolio-wide executive dashboard with a composite health score per project."
        mockup={<AnalyticsMockup />}
      />
    </section>
  );
}

function FeatureRow({
  eyebrow,
  title,
  body,
  mockup,
  flip,
}: {
  eyebrow: string;
  title: string;
  body: string;
  mockup: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <div className="grid lg:grid-cols-2 gap-12 items-center">
      <div className={flip ? "lg:order-2" : ""}>
        <p className="text-[13px] font-medium uppercase tracking-wide text-muted mb-3">{eyebrow}</p>
        <h2 className="font-display text-3xl tracking-[-0.02em] mb-4">{title}</h2>
        <p className="text-body leading-relaxed max-w-md">{body}</p>
      </div>
      <div className={flip ? "lg:order-1" : ""}>{mockup}</div>
    </div>
  );
}

/* ---------- CSS product mockups (product-mockup-card style) ---------- */

function MockupFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-hairline bg-canvas shadow-[0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-hairline-soft text-xs font-medium text-muted">{label}</div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function GanttMockup() {
  const bars = [
    { offset: 0, width: 25, color: "bg-success" },
    { offset: 20, width: 35, color: "bg-error" },
    { offset: 50, width: 30, color: "bg-error" },
    { offset: 45, width: 25, color: "bg-brand-accent" },
    { offset: 75, width: 20, color: "bg-surface-strong" },
  ];
  return (
    <MockupFrame label="Gantt — critical path highlighted">
      <div className="space-y-2.5">
        {bars.map((bar, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-2 w-16 rounded bg-surface-card" />
            <div className="relative flex-1 h-4">
              <div
                className={`absolute inset-y-0 my-auto h-3 rounded-md ${bar.color}`}
                style={{ left: `${bar.offset}%`, width: `${bar.width}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </MockupFrame>
  );
}

function LookaheadMockup() {
  const items = [
    { week: "This week", tasks: ["Pour slab — Sara P.", "Set anchor bolts — Tom E."] },
    { week: "Next week", tasks: ["Steel delivery", "Framing crew mobilize"] },
  ];
  return (
    <MockupFrame label="Lookahead — 4-week window">
      <div className="space-y-4">
        {items.map((group) => (
          <div key={group.week}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-soft mb-2">{group.week}</p>
            <div className="space-y-1.5">
              {group.tasks.map((t) => (
                <div key={t} className="flex items-center gap-2 rounded-md border border-hairline-soft px-3 py-2">
                  <span className="h-2 w-2 rounded-full bg-brand-accent shrink-0" />
                  <span className="text-xs text-body">{t}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </MockupFrame>
  );
}

function WeeklyPlanMockup() {
  const commitments = [
    { name: "Rough electrical — 2nd floor", done: true },
    { name: "Hang drywall — unit 4B", done: true },
    { name: "Plumbing inspection", done: false },
  ];
  return (
    <MockupFrame label="Weekly Work Plan">
      <div className="space-y-1.5 mb-4">
        {commitments.map((c) => (
          <div key={c.name} className="flex items-center gap-2.5 rounded-md border border-hairline-soft px-3 py-2">
            <span
              className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                c.done ? "bg-success text-on-primary" : "border border-hairline text-transparent"
              }`}
            >
              ✓
            </span>
            <span className={`text-xs ${c.done ? "text-muted line-through" : "text-body"}`}>{c.name}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-md bg-surface-card px-3 py-2">
        <span className="text-xs font-medium text-body">Percent Plan Complete</span>
        <span className="font-display text-lg">67%</span>
      </div>
    </MockupFrame>
  );
}

function AnalyticsMockup() {
  return (
    <MockupFrame label="Analytics — S-Curve">
      <svg viewBox="0 0 280 120" className="w-full h-auto" role="img" aria-label="Planned vs actual S-curve chart">
        <line x1="0" y1="100" x2="280" y2="100" stroke="var(--color-hairline)" strokeWidth="1" />
        <line x1="0" y1="60" x2="280" y2="60" stroke="var(--color-hairline-soft)" strokeWidth="1" />
        <line x1="0" y1="20" x2="280" y2="20" stroke="var(--color-hairline-soft)" strokeWidth="1" />
        <polyline
          points="0,98 40,92 80,78 120,58 160,38 200,24 240,16 280,12"
          fill="none"
          stroke="var(--color-muted-soft)"
          strokeWidth="2"
          strokeDasharray="4 3"
        />
        <polyline
          points="0,98 40,94 80,84 120,68 160,52"
          fill="none"
          stroke="var(--color-success)"
          strokeWidth="2.5"
        />
        <circle cx="160" cy="52" r="3.5" fill="var(--color-success)" />
      </svg>
      <div className="flex items-center gap-4 mt-2 text-[10px] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-muted-soft" /> Planned</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-success" /> Actual</span>
      </div>
    </MockupFrame>
  );
}

/* ---------- Value props band (feature-cards on surface-card, 4-up) ---------- */

const VALUES = [
  {
    title: "Centralize information",
    description: "Schedule, lookahead, weekly plan, roadblocks, submittals, RFIs, drawings, and analytics — one place, no silos.",
  },
  {
    title: "Improve collaboration",
    description: "Invite every project stakeholder with link-based invites and per-project roles. Everyone plans on the same page.",
  },
  {
    title: "Keep track of every change",
    description: "An append-only activity log records who changed what and when — full data traceability across the project.",
  },
  {
    title: "Ask your schedule anything",
    description: "A built-in AI assistant answers questions grounded in your project's own tasks, roadblocks, and commitments.",
  },
];

function ValueBand() {
  return (
    <section id="why" className="bg-surface-soft border-y border-hairline-soft">
      <div className="max-w-6xl mx-auto px-6 py-24">
        <h2 className="font-display text-3xl sm:text-4xl tracking-[-0.02em] mb-3 text-center">
          Built to empower the jobsite.
        </h2>
        <p className="text-body text-center mb-12 max-w-2xl mx-auto">
          Keep the field connected to the master schedule, prevent delays, and deliver more projects on time.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {VALUES.map((v) => (
            <div key={v.title} className="rounded-lg bg-surface-card p-8">
              <h3 className="text-base font-semibold mb-2">{v.title}</h3>
              <p className="text-sm text-body leading-relaxed">{v.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- CTA band (cta-band-light) ---------- */

function CtaBand({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <section className="max-w-6xl mx-auto px-6 py-24">
      <div className="rounded-lg bg-surface-card px-8 py-12 text-center">
        <h2 className="font-display text-3xl tracking-[-0.02em] mb-3">Ready to see BuilderBridge?</h2>
        <p className="text-body mb-8 max-w-xl mx-auto">
          Create a project, invite your team, and start planning in minutes — no training required.
        </p>
        <Link
          href={isSignedIn ? "/projects" : "/sign-up"}
          className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-semibold text-on-primary hover:bg-primary-active transition-colors"
        >
          {isSignedIn ? "Open your projects" : "Get started free"}
        </Link>
      </div>
    </section>
  );
}

/* ---------- Footer (the only dark surface — closes the page) ---------- */

function Footer() {
  return (
    <footer className="bg-surface-dark text-on-dark-soft">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid sm:grid-cols-3 gap-10 mb-12">
          <div>
            <p className="font-display text-lg text-on-dark mb-3">BuilderBridge</p>
            <p className="text-sm leading-relaxed max-w-xs">
              Construction scheduling and planning that keeps the office and the field on the same schedule.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-on-dark mb-3">Product</p>
            <ul className="space-y-2 text-sm">
              <li><a href="#features" className="hover:text-on-dark transition-colors">Scheduling</a></li>
              <li><a href="#features" className="hover:text-on-dark transition-colors">Lookahead</a></li>
              <li><a href="#features" className="hover:text-on-dark transition-colors">Weekly Work Plan</a></li>
              <li><a href="#features" className="hover:text-on-dark transition-colors">Analytics</a></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-on-dark mb-3">Account</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/sign-in" className="hover:text-on-dark transition-colors">Sign in</Link></li>
              <li><Link href="/sign-up" className="hover:text-on-dark transition-colors">Sign up</Link></li>
            </ul>
          </div>
        </div>
        <p className="text-xs text-on-dark-soft/70 border-t border-surface-dark-elevated pt-6">
          © {new Date().getFullYear()} BuilderBridge. Built for the jobsite.
        </p>
      </div>
    </footer>
  );
}
