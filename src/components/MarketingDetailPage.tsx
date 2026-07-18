import Link from "next/link";
import { MarketingFooter } from "@/components/MarketingFooter";
import { LandingMegaNav } from "@/components/LandingMegaNav";
import {
  featurePages,
  solutionPages,
  type MarketingPageData,
  type MarketingVisual,
} from "@/lib/marketing-content";

export function MarketingDetailPage({ data, isSignedIn }: { data: MarketingPageData; isSignedIn: boolean }) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <LandingMegaNav isSignedIn={isSignedIn} />
      <main>
        <Hero data={data} isSignedIn={isSignedIn} />
        <Highlights data={data} />
        <Workflow data={data} />
        <Proof data={data} />
        <RelatedPages data={data} />
        <ClosingCta data={data} isSignedIn={isSignedIn} />
      </main>
      <MarketingFooter />
    </div>
  );
}

function Hero({ data, isSignedIn }: { data: MarketingPageData; isSignedIn: boolean }) {
  return (
    <section className="overflow-hidden bg-[#111111] text-white">
      <div className="mx-auto max-w-[1400px] px-6 pb-0 pt-44 sm:px-10 lg:px-12 lg:pt-52">
        <div className="grid items-center gap-14 lg:grid-cols-[0.88fr_1.12fr] lg:gap-20">
          <div className="pb-16 lg:pb-24">
            <div className="mb-7 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white/55">
              <Link href={data.section === "Features" ? "/#features" : "/#roles"} className="transition-colors hover:text-white">
                {data.section}
              </Link>
              <span className="h-px w-5 bg-[#f97316]" />
              <span>{data.group}</span>
            </div>
            <p className="mb-5 text-sm font-semibold text-[#ff9a55]">{data.title}</p>
            <h1 className="max-w-[11ch] text-5xl font-semibold leading-[0.98] tracking-[0] text-white sm:text-6xl lg:text-7xl">
              {data.headline}
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-white/68 sm:text-lg sm:leading-8">{data.description}</p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href={isSignedIn ? "/projects" : "/sign-up"}
                className="inline-flex h-12 items-center justify-center rounded-md bg-[#f97316] px-6 text-sm font-bold text-white transition-colors hover:bg-[#e5650f]"
              >
                {isSignedIn ? "Open BuilderBridge" : "Start building"}
                <ArrowIcon />
              </Link>
              <Link
                href="/#features"
                className="inline-flex h-12 items-center justify-center rounded-md border border-white/20 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Explore the platform
              </Link>
            </div>
          </div>

          <div className="relative self-end">
            <div className="absolute -left-4 top-10 hidden h-[76%] w-px bg-white/12 lg:block" aria-hidden />
            <div className="mb-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.1em] text-white/45">
              <span>{data.visualLabel}</span>
              <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live workspace</span>
            </div>
            <ProductVisual kind={data.visual} title={data.title} />
          </div>
        </div>

        <div className="grid border-t border-white/14 sm:grid-cols-3">
          {data.outcomes.map((outcome, index) => (
            <div key={outcome} className={`flex min-h-20 items-center gap-4 py-5 sm:px-6 ${index > 0 ? "border-t border-white/14 sm:border-l sm:border-t-0" : ""}`}>
              <span className="text-xs font-bold text-[#f97316]">0{index + 1}</span>
              <span className="text-sm font-medium text-white/78">{outcome}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Highlights({ data }: { data: MarketingPageData }) {
  return (
    <section className="border-b border-hairline bg-canvas">
      <div className="mx-auto max-w-[1400px] px-6 py-24 sm:px-10 lg:px-12 lg:py-32">
        <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-24">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#d85d0b]">Designed for production</p>
            <h2 className="mt-5 max-w-[12ch] text-4xl font-semibold leading-[1.05] tracking-[0] sm:text-5xl">
              Less administration. More control.
            </h2>
          </div>
          <div className="border-t border-hairline">
            {data.highlights.map((highlight, index) => (
              <article key={highlight.title} className="grid gap-4 border-b border-hairline py-8 sm:grid-cols-[52px_0.75fr_1.25fr] sm:items-start sm:gap-7">
                <span className="font-mono text-xs text-muted-soft">0{index + 1}</span>
                <h3 className="text-lg font-semibold text-ink">{highlight.title}</h3>
                <p className="text-sm leading-6 text-body">{highlight.body}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Workflow({ data }: { data: MarketingPageData }) {
  return (
    <section className="bg-[#171717] text-white">
      <div className="mx-auto max-w-[1400px] px-6 py-24 sm:px-10 lg:px-12 lg:py-32">
        <div className="flex flex-col gap-6 border-b border-white/14 pb-12 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#ff9a55]">How it works</p>
            <h2 className="mt-5 max-w-[14ch] text-4xl font-semibold leading-[1.05] tracking-[0] text-white sm:text-5xl">
              A workflow your team can repeat.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-white/58">
            Built around the operating rhythm of a construction project, with every step connected to the same live plan.
          </p>
        </div>

        <div className="grid lg:grid-cols-4">
          {data.workflow.map((step, index) => (
            <article key={step.title} className={`relative py-10 lg:min-h-72 lg:px-7 ${index > 0 ? "border-t border-white/14 lg:border-l lg:border-t-0" : ""}`}>
              <div className="mb-12 flex items-center justify-between">
                <span className="font-mono text-xs text-white/38">0{index + 1}</span>
                <span className={`h-2 w-2 rounded-full ${index === 3 ? "bg-emerald-400" : "bg-[#f97316]"}`} />
              </div>
              <h3 className="text-lg font-semibold text-white">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/58">{step.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Proof({ data }: { data: MarketingPageData }) {
  return (
    <section className="border-b border-hairline bg-[#f4f5f6]">
      <div className="mx-auto grid max-w-[1400px] gap-12 px-6 py-24 sm:px-10 lg:grid-cols-[0.65fr_1.35fr] lg:px-12 lg:py-28">
        <div className="border-l-2 border-[#f97316] pl-6">
          <p className="text-5xl font-semibold tracking-[0] text-ink sm:text-6xl">{data.proof.value}</p>
          <p className="mt-3 text-sm font-medium text-muted">{data.proof.label}</p>
        </div>
        <div>
          <h2 className="max-w-[21ch] text-3xl font-semibold leading-tight tracking-[0] text-ink sm:text-4xl">{data.proof.title}</h2>
          <p className="mt-6 max-w-2xl text-base leading-7 text-body">{data.proof.body}</p>
        </div>
      </div>
    </section>
  );
}

function RelatedPages({ data }: { data: MarketingPageData }) {
  const pages = Object.values(data.section === "Features" ? featurePages : solutionPages);
  const currentIndex = pages.findIndex((page) => page.slug === data.slug);
  const related = [pages[(currentIndex + 1) % pages.length], pages[(currentIndex + 2) % pages.length]];
  const base = data.section.toLowerCase();

  return (
    <section className="bg-canvas">
      <div className="mx-auto max-w-[1400px] px-6 py-24 sm:px-10 lg:px-12 lg:py-28">
        <div className="mb-10 flex items-end justify-between gap-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#d85d0b]">Keep exploring</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[0] text-ink">Connected by design.</h2>
          </div>
          <Link href="/#features" className="hidden text-sm font-semibold text-ink hover:underline sm:block">View platform overview</Link>
        </div>
        <div className="grid gap-px overflow-hidden rounded-lg border border-hairline bg-hairline md:grid-cols-2">
          {related.map((page, index) => (
            <Link key={page.slug} href={`/${base}/${page.slug}`} className="group bg-canvas p-7 transition-colors hover:bg-surface-soft sm:p-9">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-soft">{page.group}</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-md border border-hairline text-ink transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-white">
                  <ArrowIcon compact />
                </span>
              </div>
              <h3 className="mt-12 text-2xl font-semibold tracking-[0] text-ink">{page.title}</h3>
              <p className="mt-3 max-w-md text-sm leading-6 text-body">{page.description}</p>
              <span className="mt-8 block font-mono text-[10px] text-muted-soft">0{index + 1}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function ClosingCta({ data, isSignedIn }: { data: MarketingPageData; isSignedIn: boolean }) {
  return (
    <section className="bg-[#f97316] text-white">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-10 px-6 py-20 sm:px-10 lg:flex-row lg:items-center lg:justify-between lg:px-12 lg:py-24">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/68">Put {data.title} to work</p>
          <h2 className="mt-5 max-w-[17ch] text-4xl font-semibold leading-[1.05] tracking-[0] text-white sm:text-5xl">
            Connect the schedule to the people building it.
          </h2>
        </div>
        <Link
          href={isSignedIn ? "/projects" : "/sign-up"}
          className="inline-flex h-13 shrink-0 items-center justify-center self-start rounded-md bg-white px-7 text-sm font-bold text-ink transition-colors hover:bg-[#f2f2f2] lg:self-auto"
        >
          {isSignedIn ? "Open your projects" : "Get started free"}
          <ArrowIcon />
        </Link>
      </div>
    </section>
  );
}

function ProductVisual({ kind, title }: { kind: MarketingVisual; title: string }) {
  return (
    <div className="overflow-hidden rounded-t-lg border border-b-0 border-white/18 bg-[#f6f7f8] text-[#171717] shadow-[0_30px_80px_rgba(0,0,0,0.28)]">
      <div className="flex h-12 items-center gap-2 border-b border-[#dedfe1] bg-white px-4">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#10b981]" />
        <span className="ml-3 truncate text-xs font-semibold text-[#292929]">{title}</span>
        <span className="ml-auto rounded bg-[#f1f2f3] px-2 py-1 text-[9px] font-bold uppercase text-[#777]">Live</span>
      </div>
      <div className="min-h-[410px] p-4 sm:min-h-[470px] sm:p-6">
        {kind === "schedule" && <ScheduleVisual />}
        {kind === "impact" && <ImpactVisual />}
        {kind === "documents" && <DocumentsVisual />}
        {kind === "lookahead" && <LookaheadVisual />}
        {kind === "field" && <FieldVisual />}
        {kind === "weekly" && <WeeklyVisual />}
        {kind === "risk" && <RiskVisual />}
        {kind === "portfolio" && <PortfolioVisual />}
        {kind === "analytics" && <AnalyticsVisual />}
        {kind === "ai" && <AiVisual />}
        {kind === "role" && <RoleVisual />}
        {kind === "integration" && <IntegrationVisual title={title} />}
      </div>
    </div>
  );
}

function VisualHeading({ label, meta }: { label: string; meta: string }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div><p className="text-sm font-bold text-[#171717]">{label}</p><p className="mt-1 text-[10px] text-[#7a7a7a]">North Tower Expansion</p></div>
      <span className="rounded-md border border-[#dedfe1] bg-white px-2.5 py-1.5 text-[9px] font-semibold text-[#555]">{meta}</span>
    </div>
  );
}

const scheduleRows = [
  ["Structure complete", "100%", "left-[6%] w-[28%] bg-[#1f2937]"],
  ["Level 4 framing", "72%", "left-[29%] w-[33%] bg-[#f97316]"],
  ["MEP rough-in", "44%", "left-[47%] w-[29%] bg-[#3b82f6]"],
  ["Interior close-in", "12%", "left-[68%] w-[24%] bg-[#d1d5db]"],
] as const;

function ScheduleVisual() {
  return <><VisualHeading label="Master schedule" meta="Updated today" /><div className="grid grid-cols-[132px_1fr] overflow-hidden rounded-md border border-[#dedfe1] bg-white sm:grid-cols-[170px_1fr]"><div className="border-r border-[#e5e7eb]"><div className="h-9 border-b border-[#e5e7eb] px-3 py-2 text-[9px] font-bold uppercase text-[#8a8a8a]">Activity</div>{scheduleRows.map(([name, progress]) => <div key={name} className="h-16 border-b border-[#efefef] px-3 py-3 last:border-b-0"><p className="truncate text-[10px] font-semibold">{name}</p><p className="mt-1 text-[9px] text-[#888]">{progress} complete</p></div>)}</div><div className="min-w-0"><div className="grid h-9 grid-cols-4 border-b border-[#e5e7eb] text-center text-[8px] font-semibold text-[#888]"><span className="py-2.5">W18</span><span className="py-2.5">W19</span><span className="py-2.5">W20</span><span className="py-2.5">W21</span></div>{scheduleRows.map(([name, , bar]) => <div key={name} className="relative h-16 border-b border-[#efefef] last:border-b-0"><span className={`absolute top-6 h-3 rounded-sm ${bar}`} /></div>)}</div></div></>;
}

function ImpactVisual() {
  const rows = [["SIR-014", "Unforeseen duct conflict", "Review", "2d"], ["SIR-012", "South access restriction", "Open", "5d"], ["SIR-009", "Owner finish revision", "Approved", "0d"]];
  return <><VisualHeading label="Impact review" meta="3 active" /><div className="grid gap-3">{rows.map(([id, title, status, days], index) => <div key={id} className="rounded-md border border-[#dedfe1] bg-white p-4"><div className="flex items-center gap-3"><span className={`h-8 w-1 rounded-full ${index === 0 ? "bg-[#f97316]" : index === 1 ? "bg-[#f59e0b]" : "bg-[#10b981]"}`} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="font-mono text-[9px] text-[#777]">{id}</span><span className="rounded bg-[#f2f3f4] px-1.5 py-0.5 text-[8px] font-semibold">{status}</span></div><p className="mt-1 truncate text-[11px] font-semibold">{title}</p></div><div className="text-right"><p className="text-lg font-semibold">{days}</p><p className="text-[8px] text-[#888]">exposure</p></div></div></div>)}</div><div className="mt-4 rounded-md border border-dashed border-[#c9cbd0] p-3 text-center text-[9px] text-[#777]">Decision history and schedule evidence stay attached</div></>;
}

function DocumentsVisual() {
  const rows = [["08 44 13", "Curtain wall samples", "Due in 2d", "At risk"], ["23 05 93", "HVAC balancing plan", "Due in 8d", "In review"], ["26 05 00", "Lighting controls", "Due in 14d", "Submitted"], ["09 29 00", "Level 4 finish system", "Approved", "Closed"]];
  return <><VisualHeading label="Document control" meta="Linked to schedule" /><div className="overflow-hidden rounded-md border border-[#dedfe1] bg-white"><div className="grid grid-cols-[74px_1fr_70px] border-b border-[#e5e7eb] bg-[#fafafa] px-3 py-2 text-[8px] font-bold uppercase text-[#888]"><span>Spec</span><span>Item</span><span>Status</span></div>{rows.map(([spec, item, date, status], index) => <div key={item} className="grid grid-cols-[74px_1fr_70px] items-center border-b border-[#efefef] px-3 py-3 last:border-b-0"><span className="font-mono text-[8px] text-[#777]">{spec}</span><div className="min-w-0"><p className="truncate text-[10px] font-semibold">{item}</p><p className={`mt-1 text-[8px] ${index === 0 ? "text-[#dc4a18]" : "text-[#888]"}`}>{date}</p></div><span className="text-[8px] font-semibold text-[#555]">{status}</span></div>)}</div></>;
}

function LookaheadVisual() {
  const columns = [["This week", ["Deck embeds", "L4 framing"]], ["Week +2", ["MEP overhead", "Exterior framing"]], ["Week +3", ["Drywall layout", "Roof equipment"]]] as const;
  return <><VisualHeading label="Six-week lookahead" meta="17 activities" /><div className="grid grid-cols-3 gap-2">{columns.map(([week, tasks], columnIndex) => <div key={week} className="min-w-0 rounded-md border border-[#dedfe1] bg-[#eceef0] p-2"><div className="mb-3 flex items-center justify-between"><span className="text-[9px] font-bold">{week}</span><span className="text-[8px] text-[#888]">{tasks.length}</span></div>{tasks.map((task, index) => <div key={task} className="mb-2 rounded bg-white p-2.5 shadow-sm"><span className={`mb-2 block h-1 w-7 rounded ${columnIndex === 0 ? "bg-[#f97316]" : columnIndex === 1 ? "bg-[#3b82f6]" : "bg-[#10b981]"}`} /><p className="text-[9px] font-semibold leading-3">{task}</p><p className="mt-2 text-[7px] text-[#888]">{index === 0 ? "Ready" : "1 constraint"}</p></div>)}</div>)}</div><div className="mt-4 flex items-center gap-2 rounded-md border border-[#dedfe1] bg-white p-3"><span className="h-2 w-2 rounded-full bg-[#10b981]"/><p className="text-[9px]"><strong>14 of 17</strong> activities are ready to commit</p></div></>;
}

function FieldVisual() {
  return <><VisualHeading label="Today's field plan" meta="Mobile synced" /><div className="grid gap-4 sm:grid-cols-[0.8fr_1.2fr]"><div className="rounded-lg border-4 border-[#252525] bg-white p-3 shadow-lg"><div className="mx-auto mb-4 h-1 w-9 rounded-full bg-[#c8c8c8]"/><p className="text-[9px] font-bold">Tuesday, May 12</p><p className="mt-1 text-[8px] text-[#888]">4 assigned activities</p>{["Layout level 4 walls", "Set overhead hangers", "Inspect south riser"].map((task,index)=><div key={task} className="mt-3 rounded-md border border-[#e5e7eb] p-2"><div className="flex gap-2"><span className={`mt-0.5 h-3 w-3 rounded-full border ${index===0?"border-[#10b981] bg-[#10b981]":"border-[#bbb]"}`}/><div><p className="text-[8px] font-semibold leading-3">{task}</p><p className="mt-1 text-[7px] text-[#888]">Level 4</p></div></div></div>)}</div><div className="space-y-3"><div className="rounded-md border border-[#dedfe1] bg-white p-4"><p className="text-[9px] font-bold">Progress received</p><div className="mt-4 flex items-end gap-1">{[35,52,48,70,82,76,91].map((height,index)=><span key={index} className={`flex-1 rounded-t-sm ${index===6?"bg-[#f97316]":"bg-[#dfe2e5]"}`} style={{height}} />)}</div><div className="mt-2 flex justify-between text-[7px] text-[#999]"><span>Wed</span><span>Today</span></div></div><div className="rounded-md border border-[#dedfe1] bg-white p-4"><p className="text-[9px] font-bold">Latest site note</p><p className="mt-2 text-[8px] leading-4 text-[#777]">South riser complete. Photo and quantity attached to MEP rough-in.</p></div></div></div></>;
}

function WeeklyVisual() {
  const trades = [["Concrete", [1,1,1,0,0]], ["Electrical", [1,1,0,0,0]], ["Mechanical", [1,1,1,1,0]], ["Framing", [1,1,1,1,1]]] as const;
  return <><VisualHeading label="Weekly commitments" meta="PPC 84%" /><div className="overflow-hidden rounded-md border border-[#dedfe1] bg-white"><div className="grid grid-cols-[92px_repeat(5,1fr)] border-b border-[#e5e7eb] bg-[#fafafa] text-center text-[8px] font-bold text-[#888]"><span className="p-2 text-left">Trade</span>{["M","T","W","T","F"].map((day,index)=><span key={`${day}-${index}`} className="border-l border-[#eee] p-2">{day}</span>)}</div>{trades.map(([trade,days],tradeIndex)=><div key={trade} className="grid grid-cols-[92px_repeat(5,1fr)] border-b border-[#efefef] last:border-b-0"><span className="truncate p-3 text-[9px] font-semibold">{trade}</span>{days.map((done,index)=><span key={index} className="flex items-center justify-center border-l border-[#eee] p-2"><span className={`h-4 w-4 rounded-full ${done ? tradeIndex===3&&index===4?"bg-[#f97316]":"bg-[#10b981]" : "border border-[#d2d4d7]"}`}>{done ? <span className="flex h-full items-center justify-center text-[8px] text-white">{tradeIndex===3&&index===4?"!":"+"}</span>:null}</span></span>)}</div>)}</div><div className="mt-4 grid grid-cols-3 gap-2">{[["21","Promises"],["18","Complete"],["3","Variance"]].map(([value,label])=><div key={label} className="rounded-md border border-[#dedfe1] bg-white p-3"><p className="text-lg font-semibold">{value}</p><p className="text-[8px] text-[#888]">{label}</p></div>)}</div></>;
}

function RiskVisual() {
  const items = [["Steel embeds at east core", "Design", "May 14", "High"], ["Level 5 material hoist", "Access", "May 17", "Med"], ["Lighting control samples", "Submittal", "May 21", "Low"]];
  return <><VisualHeading label="Constraint register" meta="6 need action" /><div className="rounded-md border border-[#dedfe1] bg-white p-3"><div className="mb-3 grid grid-cols-[8px_1fr_64px] gap-3 px-2 text-[8px] font-bold uppercase text-[#999]"><span/><span>Roadblock</span><span>Need by</span></div>{items.map(([title,type,date,risk])=><div key={title} className="grid grid-cols-[8px_1fr_64px] items-center gap-3 border-t border-[#efefef] px-2 py-4"><span className={`h-8 w-1 rounded-full ${risk==="High"?"bg-[#ef4444]":risk==="Med"?"bg-[#f59e0b]":"bg-[#10b981]"}`}/><div className="min-w-0"><p className="truncate text-[9px] font-semibold">{title}</p><p className="mt-1 text-[8px] text-[#888]">{type} - Assigned</p></div><span className="text-[8px] font-semibold">{date}</span></div>)}</div><div className="mt-4 flex items-center justify-between rounded-md bg-[#202124] p-4 text-white"><div><p className="text-[9px] font-semibold">Make-ready score</p><p className="mt-1 text-[8px] text-white/55">Next 3 weeks</p></div><p className="text-2xl font-semibold">82%</p></div></>;
}

function PortfolioVisual() {
  const projects = [["North Tower", "On track", "86", "bg-[#10b981]"], ["Riverfront Labs", "Attention", "64", "bg-[#f59e0b]"], ["Civic Center", "At risk", "41", "bg-[#ef4444]"]];
  return <><VisualHeading label="Portfolio pulse" meta="12 projects" /><div className="grid grid-cols-3 gap-2">{[["94%","Milestones"],["81%","Plan reliability"],["23","Open risks"]].map(([value,label])=><div key={label} className="rounded-md border border-[#dedfe1] bg-white p-3"><p className="text-lg font-semibold">{value}</p><p className="mt-1 truncate text-[7px] text-[#888]">{label}</p></div>)}</div><div className="mt-4 overflow-hidden rounded-md border border-[#dedfe1] bg-white">{projects.map(([name,status,health,color])=><div key={name} className="grid grid-cols-[1fr_70px] items-center border-b border-[#efefef] p-4 last:border-b-0"><div><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${color}`}/><p className="text-[10px] font-semibold">{name}</p></div><p className="ml-4 mt-1 text-[8px] text-[#888]">{status}</p></div><div><div className="flex justify-between text-[8px]"><span>Health</span><strong>{health}</strong></div><div className="mt-2 h-1.5 overflow-hidden rounded bg-[#e7e7e7]"><span className={`block h-full ${color}`} style={{width:`${health}%`}}/></div></div></div>)}</div></>;
}

function AnalyticsVisual() {
  return <><VisualHeading label="Planning analytics" meta="Last 12 weeks" /><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-md border border-[#dedfe1] bg-white p-4"><div className="flex items-end justify-between"><div><p className="text-[8px] text-[#888]">Plan reliability</p><p className="mt-1 text-2xl font-semibold">84%</p></div><span className="text-[8px] font-semibold text-[#059669]">+12%</span></div><div className="mt-6 flex h-28 items-end gap-1.5">{[38,48,43,57,62,58,72,69,77,83,79,88].map((height,index)=><span key={index} className={`flex-1 rounded-t-sm ${index>8?"bg-[#f97316]":"bg-[#d8dadd]"}`} style={{height:`${height}%`}}/>)}</div></div><div className="rounded-md border border-[#dedfe1] bg-white p-4"><p className="text-[8px] text-[#888]">Reasons for variance</p>{[["Prerequisite work", "38%", "w-[38%]"], ["Design information", "27%", "w-[27%]"], ["Material", "19%", "w-[19%]"], ["Labor", "16%", "w-[16%]"]].map(([label,value,width])=><div key={label} className="mt-4"><div className="flex justify-between text-[8px]"><span>{label}</span><strong>{value}</strong></div><div className="mt-1.5 h-1.5 rounded bg-[#ececec]"><span className={`block h-full rounded bg-[#3b82f6] ${width}`}/></div></div>)}</div></div></>;
}

function AiVisual() {
  return <><VisualHeading label="Agent" meta="Project grounded" /><div className="rounded-md border border-[#dedfe1] bg-white p-4"><div className="ml-auto max-w-[85%] rounded-md bg-[#202124] p-3 text-[9px] leading-4 text-white">Which activities put the June 30 milestone at risk?</div><div className="mt-4 flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#f97316] text-[9px] font-bold text-white">AI</span><div><p className="text-[9px] leading-4 text-[#555]">Three activities currently affect the milestone. The highest exposure is <strong>Level 4 MEP rough-in</strong>, blocked by RFI-086 and two days behind its lookahead commitment.</p><div className="mt-3 grid gap-2">{[["Activity 129", "MEP rough-in", "2d late"], ["RFI-086", "Duct routing conflict", "Open"], ["Milestone", "Dry-in complete", "Jun 30"]].map(([type,label,status])=><div key={type} className="flex items-center rounded border border-[#e5e7eb] p-2"><span className="font-mono text-[7px] text-[#888]">{type}</span><span className="ml-3 flex-1 text-[8px] font-semibold">{label}</span><span className="text-[7px] text-[#dc4a18]">{status}</span></div>)}</div></div></div></div><div className="mt-3 flex items-center rounded-md border border-[#cfd1d4] bg-white px-3 py-2"><span className="text-[8px] text-[#999]">Ask about this project...</span><span className="ml-auto flex h-6 w-6 items-center justify-center rounded bg-[#171717] text-[10px] text-white">+</span></div></>;
}

function RoleVisual() {
  const items = [["Review milestone movement", "Schedule", "9:00"], ["Clear L4 constraints", "Make ready", "10:30"], ["Confirm trade commitments", "Weekly plan", "1:00"], ["Owner progress review", "Reporting", "3:30"]];
  return <><VisualHeading label="Today's control plan" meta="Tuesday" /><div className="grid gap-4 sm:grid-cols-[1.2fr_0.8fr]"><div className="overflow-hidden rounded-md border border-[#dedfe1] bg-white">{items.map(([task,type,time],index)=><div key={task} className="flex items-center gap-3 border-b border-[#efefef] p-3 last:border-b-0"><span className={`h-8 w-1 rounded ${index<2?"bg-[#f97316]":"bg-[#d6d8db]"}`}/><div className="min-w-0 flex-1"><p className="truncate text-[9px] font-semibold">{task}</p><p className="mt-1 text-[7px] text-[#888]">{type}</p></div><span className="font-mono text-[8px] text-[#777]">{time}</span></div>)}</div><div className="space-y-3">{[["4","Actions due"],["2","Risks escalated"],["86%","Weekly PPC"]].map(([value,label],index)=><div key={label} className={`rounded-md p-3 ${index===0?"bg-[#202124] text-white":"border border-[#dedfe1] bg-white"}`}><p className="text-xl font-semibold">{value}</p><p className={`mt-1 text-[8px] ${index===0?"text-white/55":"text-[#888]"}`}>{label}</p></div>)}</div></div></>;
}

function IntegrationVisual({ title }: { title: string }) {
  return <><VisualHeading label="Connected project systems" meta="Sync active" /><div className="flex min-h-52 items-center justify-center gap-3 rounded-md border border-[#dedfe1] bg-white p-4 sm:gap-6"><div className="flex h-24 w-24 flex-col items-center justify-center rounded-lg border border-[#d8dadd] bg-[#fafafa]"><span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#171717] text-sm font-bold text-white">B</span><span className="mt-2 text-[8px] font-semibold">BuilderBridge</span></div><div className="flex flex-1 items-center"><span className="h-px flex-1 bg-[#cfd1d4]"/><span className="mx-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#10b981] text-[10px] text-white">+</span><span className="h-px flex-1 bg-[#cfd1d4]"/></div><div className="flex h-24 w-24 flex-col items-center justify-center rounded-lg border border-[#d8dadd] bg-[#fafafa]"><span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#f97316] text-sm font-bold text-white">{title.charAt(0)}</span><span className="mt-2 text-center text-[8px] font-semibold">{title}</span></div></div><div className="mt-4 grid grid-cols-3 gap-2">{[["24","Records linked"],["6","Need attention"],["Now","Last sync"]].map(([value,label])=><div key={label} className="rounded-md border border-[#dedfe1] bg-white p-3"><p className="text-lg font-semibold">{value}</p><p className="mt-1 text-[7px] text-[#888]">{label}</p></div>)}</div></>;
}

function ArrowIcon({ compact = false }: { compact?: boolean }) {
  return <svg className={compact ? "" : "ml-2"} width={compact ? 15 : 16} height={compact ? 15 : 16} viewBox="0 0 16 16" fill="none" aria-hidden><path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
