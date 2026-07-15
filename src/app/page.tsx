import Link from "next/link";
import { LandingHero } from "@/components/LandingHero";
import { LandingMegaNav } from "@/components/LandingMegaNav";
import { MarketingFooter } from "@/components/MarketingFooter";
import { LandingProductShowcase } from "@/components/LandingProductShowcase";
import { getCurrentSession } from "@/lib/session";

export default async function LandingPage() {
  const session = await getCurrentSession();
  const isSignedIn = !!session?.user;

  return (
    <div className="bg-canvas text-ink">
      <LandingMegaNav isSignedIn={isSignedIn} />
      <LandingHero isSignedIn={isSignedIn} />
      <ProductSystemBand />
      <OperatingLoopBand />
      <RiskControlBand />
      <RolesBand />
      <AiBand />
      <CtaBand isSignedIn={isSignedIn} />
      <MarketingFooter />
    </div>
  );
}

function ProductSystemBand() {
  return (
    <section id="features" className="scroll-mt-24 border-b border-hairline bg-canvas">
      <div className="mx-auto max-w-[1400px] px-6 py-24 sm:px-10 lg:px-12 lg:py-32">
        <div className="grid items-end gap-10 lg:grid-cols-[1.35fr_0.65fr]">
          <div>
            <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#d85d0b]">
              The connected project system
            </p>
            <h2 className="max-w-[16ch] text-4xl font-semibold leading-[1.05] tracking-[0] text-ink sm:text-5xl lg:text-6xl">
              One plan from baseline to field execution.
            </h2>
          </div>
          <div className="border-l-2 border-[#f97316] pl-5">
            <p className="text-base leading-7 text-body">
              BuilderBridge links schedule logic, short-interval planning, weekly commitments, project controls, and
              portfolio visibility. Every team works from the same live project truth.
            </p>
          </div>
        </div>

        <div className="mt-14 lg:mt-20">
          <LandingProductShowcase />
        </div>

        <div className="mt-10 grid border-y border-hairline sm:grid-cols-3">
          {[
            ["01", "Schedule logic stays connected", "Dependencies, dates, critical path, and field updates move together."],
            ["02", "Commitments become measurable", "Weekly promises produce PPC and variance signals automatically."],
            ["03", "Risk reaches the right level", "Project constraints roll into portfolio health without report chasing."],
          ].map(([number, title, detail], index) => (
            <div
              key={title}
              className={`py-7 sm:px-7 ${index > 0 ? "border-t border-hairline sm:border-l sm:border-t-0" : ""}`}
            >
              <p className="text-[10px] font-bold text-[#d85d0b]">{number}</p>
              <h3 className="mt-3 text-sm font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-xs leading-5 text-muted">{detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const LOOP_STEPS = [
  {
    number: "01",
    title: "Build the master plan",
    body: "Create activities, connect dependencies, protect milestones, and expose the critical path.",
    signal: "Contract schedule",
    color: "bg-[#f97316]",
  },
  {
    number: "02",
    title: "Make it field-ready",
    body: "Pull upcoming work into a rolling lookahead and sequence it with the people doing the work.",
    signal: "2-6 week lookahead",
    color: "bg-brand-accent",
  },
  {
    number: "03",
    title: "Run the week",
    body: "Capture trade commitments, completion, and reasons for variance while they are still actionable.",
    signal: "Weekly commitments",
    color: "bg-success",
  },
  {
    number: "04",
    title: "Learn and adjust",
    body: "Feed actual progress, roadblocks, PPC, and schedule impact back into the next planning cycle.",
    signal: "Performance intelligence",
    color: "bg-warning",
  },
];

function OperatingLoopBand() {
  return (
    <section id="why" className="scroll-mt-24 bg-[#171717] text-white">
      <div className="mx-auto max-w-[1400px] px-6 py-24 sm:px-10 lg:px-12 lg:py-32">
        <div className="grid gap-10 border-b border-white/15 pb-14 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#fb923c]">
              The operating rhythm
            </p>
            <h2 className="max-w-[12ch] text-4xl font-semibold leading-[1.06] tracking-[0] sm:text-5xl">
              The schedule becomes how the project runs.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-white/62 lg:justify-self-end">
            The master schedule should not disappear between updates. BuilderBridge turns it into a continuous loop
            between the office, the field, and the next decision.
          </p>
        </div>

        <div className="grid lg:grid-cols-4">
          {LOOP_STEPS.map((step, index) => (
            <article
              key={step.number}
              className={`relative min-h-80 border-white/15 py-10 lg:px-7 ${
                index > 0 ? "border-t lg:border-l lg:border-t-0" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white/38">{step.number}</span>
                <span className={`h-2 w-2 rounded-full ${step.color}`} />
              </div>
              <h3 className="mt-16 max-w-[14ch] text-xl font-semibold tracking-[0]">{step.title}</h3>
              <p className="mt-4 max-w-[30ch] text-sm leading-6 text-white/58">{step.body}</p>
              <p className="absolute bottom-10 left-0 text-[10px] font-bold uppercase tracking-[0.1em] text-white/36 lg:left-7">
                {step.signal}
              </p>
            </article>
          ))}
        </div>

        <div className="grid border border-white/15 bg-white/[0.04] md:grid-cols-[0.75fr_1.25fr]">
          <div className="border-b border-white/15 p-6 md:border-b-0 md:border-r lg:p-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/38">Live project pulse</p>
            <div className="mt-7 flex items-end gap-4">
              <span className="text-5xl font-semibold">82</span>
              <span className="mb-1 text-xs font-semibold text-success">Healthy</span>
            </div>
            <p className="mt-3 text-xs text-white/48">Composite health across schedule, PPC, variance, and roadblocks.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4">
            {[["68%", "Complete"], ["75%", "PPC"], ["1", "Open risk"], ["-2d", "Variance"]].map(([value, label]) => (
              <div key={label} className="border-b border-r border-white/10 p-5 last:border-r-0 sm:border-b-0 lg:p-7">
                <p className="text-2xl font-semibold">{value}</p>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/38">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function RiskControlBand() {
  return (
    <section className="border-b border-hairline bg-[#f3f4f5]">
      <div className="mx-auto grid max-w-[1400px] gap-14 px-6 py-24 sm:px-10 lg:grid-cols-[0.7fr_1.3fr] lg:items-center lg:px-12 lg:py-32">
        <div>
          <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.12em] text-error">Risk control</p>
          <h2 className="max-w-[12ch] text-4xl font-semibold leading-[1.06] tracking-[0] sm:text-5xl">
            See the delay while it can still be prevented.
          </h2>
          <p className="mt-6 max-w-md text-base leading-7 text-body">
            Roadblocks, RFIs, submittals, and schedule impact requests stay attached to the work they affect. Owners,
            due dates, and decisions are visible before risk becomes history.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-hairline pt-6">
            {[["One owner", "for every constraint"], ["One due date", "for every decision"], ["One activity", "linked to every risk"], ["One history", "of every change"]].map(([title, detail]) => (
              <div key={title}>
                <p className="text-sm font-semibold text-ink">{title}</p>
                <p className="mt-1 text-xs text-muted">{detail}</p>
              </div>
            ))}
          </div>
        </div>

        <RiskRegister />
      </div>
    </section>
  );
}

function RiskRegister() {
  const risks = [
    {
      type: "Roadblock",
      title: "City permit approval",
      activity: "Rough plumbing install",
      owner: "Sara Plumbing",
      due: "Today",
      status: "Open",
      tone: "text-error",
      dot: "bg-error",
    },
    {
      type: "RFI-024",
      title: "Panel clearance confirmation",
      activity: "Electrical panel inspection",
      owner: "Design team",
      due: "Jul 18",
      status: "Answered",
      tone: "text-success",
      dot: "bg-success",
    },
    {
      type: "Submittal",
      title: "Level 2 light fixtures",
      activity: "Rough electrical wiring",
      owner: "Tom Electric",
      due: "Jul 20",
      status: "Pending",
      tone: "text-warning",
      dot: "bg-warning",
    },
    {
      type: "Impact",
      title: "Inspection shifted by 2 days",
      activity: "Close interior walls",
      owner: "Jane GC",
      due: "Review",
      status: "Decision",
      tone: "text-brand-accent",
      dot: "bg-brand-accent",
    },
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-black/15 bg-canvas shadow-[0_22px_55px_rgba(17,17,17,0.1)]">
      <div className="flex min-h-16 items-center justify-between gap-4 bg-[#171717] px-5 text-white">
        <div>
          <p className="text-sm font-semibold">Project Controls</p>
          <p className="mt-0.5 text-[10px] text-white/48">Linked risk register</p>
        </div>
        <span className="text-[10px] font-semibold text-white/55">4 items need attention</span>
      </div>
      <div className="grid grid-cols-3 border-b border-hairline bg-canvas">
        {[["1", "Overdue"], ["2", "Due this week"], ["1", "Awaiting decision"]].map(([value, label], index) => (
          <div key={label} className="border-r border-hairline p-4 last:border-r-0">
            <p className={`text-xl font-semibold ${index === 0 ? "text-error" : "text-ink"}`}>{value}</p>
            <p className="mt-1 text-[9px] font-semibold uppercase text-muted-soft">{label}</p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[0.8fr_1.5fr_0.85fr_0.6fr] border-b border-hairline bg-surface-soft px-5 py-2.5 text-[9px] font-bold uppercase text-muted-soft">
            <span>Type / status</span><span>Issue / linked activity</span><span>Owner</span><span>Due</span>
          </div>
          {risks.map((risk) => (
            <div key={risk.title} className="grid min-h-[82px] grid-cols-[0.8fr_1.5fr_0.85fr_0.6fr] items-center border-b border-hairline-soft px-5 last:border-b-0">
              <div>
                <p className="text-[10px] font-semibold text-muted">{risk.type}</p>
                <p className={`mt-1 flex items-center gap-2 text-[10px] font-semibold ${risk.tone}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${risk.dot}`} />{risk.status}
                </p>
              </div>
              <div className="pr-4">
                <p className="text-xs font-semibold text-ink">{risk.title}</p>
                <p className="mt-1 text-[10px] text-muted">{risk.activity}</p>
              </div>
              <p className="text-[10px] text-body">{risk.owner}</p>
              <p className={`text-[10px] font-semibold ${risk.due === "Today" ? "text-error" : "text-body"}`}>{risk.due}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const ROLES = [
  {
    number: "01",
    title: "Project Managers",
    lead: "Control the whole project without building another report.",
    details: ["Schedule health", "Risk ownership", "Project controls"],
    accent: "bg-[#f97316]",
  },
  {
    number: "02",
    title: "Schedulers",
    lead: "Protect schedule logic while the project moves in real time.",
    details: ["Critical path", "Dependencies", "Baselines + variance"],
    accent: "bg-brand-accent",
  },
  {
    number: "03",
    title: "Superintendents",
    lead: "Turn the contract plan into executable work for the field.",
    details: ["Lookaheads", "Pull planning", "Constraint removal"],
    accent: "bg-success",
  },
  {
    number: "04",
    title: "Trade Partners",
    lead: "Commit, update, and raise issues without learning scheduling software.",
    details: ["My work", "Weekly promises", "Field updates"],
    accent: "bg-warning",
  },
];

function RolesBand() {
  return (
    <section id="roles" className="scroll-mt-24 bg-canvas">
      <div className="mx-auto max-w-[1400px] px-6 py-24 sm:px-10 lg:px-12 lg:py-32">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#d85d0b]">Built around the team</p>
            <h2 className="max-w-[13ch] text-4xl font-semibold leading-[1.06] tracking-[0] sm:text-5xl">
              The right view for every person on the project.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-body lg:justify-self-end">
            BuilderBridge keeps one connected data model underneath purpose-built workflows. Everyone sees what they
            need, and the project keeps one version of the truth.
          </p>
        </div>

        <div className="mt-16 grid border-y border-hairline md:grid-cols-2 xl:grid-cols-4">
          {ROLES.map((role, index) => (
            <article
              key={role.title}
              className={`relative min-h-[390px] px-0 py-8 md:px-7 xl:min-h-[430px] ${
                index > 0 ? "border-t border-hairline md:border-l md:border-t-0" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-soft">{role.number}</span>
                <span className={`h-2 w-2 rounded-full ${role.accent}`} />
              </div>
              <h3 className="mt-16 text-xl font-semibold tracking-[0] text-ink">{role.title}</h3>
              <p className="mt-4 max-w-[28ch] text-sm leading-6 text-body">{role.lead}</p>
              <ul className="absolute bottom-8 left-0 space-y-2.5 md:left-7">
                {role.details.map((detail) => (
                  <li key={detail} className="flex items-center gap-2.5 text-xs font-medium text-muted">
                    <span className="h-px w-4 bg-muted-soft" />{detail}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function AiBand() {
  return (
    <section className="border-y border-[#cad9e0] bg-[#e7f0f4]">
      <div className="mx-auto grid max-w-[1400px] gap-14 px-6 py-24 sm:px-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:px-12 lg:py-32">
        <div>
          <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#245c75]">BuilderBridge AI</p>
          <h2 className="max-w-[12ch] text-4xl font-semibold leading-[1.06] tracking-[0] sm:text-5xl">
            Ask the project. Get an answer grounded in the work.
          </h2>
          <p className="mt-6 max-w-md text-base leading-7 text-[#40545d]">
            The assistant reads live tasks, roadblocks, commitments, and portfolio health. It brings the signal to you
            without sending the team hunting through reports.
          </p>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-[#40545d]">
            <span>Project-aware</span><span>Portfolio-aware</span><span>Plain-language answers</span>
          </div>
        </div>

        <AiAssistantPreview />
      </div>
    </section>
  );
}

function AiAssistantPreview() {
  return (
    <div className="overflow-hidden rounded-lg border border-[#b9cbd3] bg-canvas shadow-[0_24px_60px_rgba(36,92,117,0.14)]">
      <div className="flex min-h-14 items-center justify-between bg-[#18313d] px-5 text-white">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-[10px] font-bold">AI</span>
          <div><p className="text-xs font-semibold">Project Assistant</p><p className="text-[9px] text-white/50">Riverside Apartments context</p></div>
        </div>
        <span className="flex items-center gap-2 text-[9px] text-white/48"><span className="h-1.5 w-1.5 rounded-full bg-success" />Live data</span>
      </div>
      <div className="space-y-5 bg-[#f8fbfc] p-4 sm:p-6">
        <div className="ml-auto max-w-[78%] rounded-lg bg-[#18313d] px-4 py-3 text-xs leading-5 text-white">
          What is most likely to delay the project this week?
        </div>
        <div className="max-w-[92%] rounded-lg border border-[#d3e0e5] bg-canvas p-4 sm:p-5">
          <p className="text-xs font-semibold text-ink">The plumbing permit is the clearest near-term schedule risk.</p>
          <p className="mt-3 text-xs leading-5 text-body">
            It is blocking Rough plumbing install, which sits on the current critical path and is due to finish Jul 26.
            The owner is Sara Plumbing and the constraint is due today.
          </p>
          <div className="mt-4 grid grid-cols-3 border-y border-hairline">
            {[["1", "Critical risk"], ["2d", "Potential slip"], ["Today", "Due"]].map(([value, label]) => (
              <div key={label} className="border-r border-hairline py-3 last:border-r-0">
                <p className="text-sm font-semibold text-ink">{value}</p>
                <p className="mt-1 text-[9px] text-muted">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-[9px] font-semibold text-[#245c75]">
            <span className="rounded-md border border-[#c7dbe3] px-2 py-1">Roadblock log</span>
            <span className="rounded-md border border-[#c7dbe3] px-2 py-1">Critical path</span>
            <span className="rounded-md border border-[#c7dbe3] px-2 py-1">4-week lookahead</span>
          </div>
        </div>
        <div className="flex min-h-11 items-center justify-between rounded-md border border-[#cbdbe2] bg-canvas px-4 text-xs text-muted">
          <span>Ask anything about this project...</span>
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#18313d] text-white" aria-hidden>↑</span>
        </div>
      </div>
    </div>
  );
}

function CtaBand({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <section className="bg-[#edf1e9]">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-6 py-24 sm:px-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:px-12 lg:py-28">
        <div>
          <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#52624c]">Start with the next project</p>
          <h2 className="max-w-[16ch] text-4xl font-semibold leading-[1.06] tracking-[0] sm:text-5xl">
            Put the schedule where the work actually happens.
          </h2>
        </div>
        <div className="lg:justify-self-end">
          <p className="max-w-md text-base leading-7 text-[#4c5748]">
            Create a connected project workspace, bring in the team, and turn the next schedule update into a shared operating plan.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={isSignedIn ? "/projects" : "/sign-up"}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#171717] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#2b2b2b]"
            >
              {isSignedIn ? "Open your projects" : "Create your workspace"}<span aria-hidden>→</span>
            </Link>
            <a
              href="#features"
              className="inline-flex h-11 items-center justify-center rounded-md border border-[#aeb9aa] px-5 text-sm font-semibold text-ink transition-colors hover:bg-white/60"
            >
              Explore the product
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
