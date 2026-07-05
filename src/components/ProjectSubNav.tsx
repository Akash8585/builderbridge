import Link from "next/link";

const TABS = [
  { href: "", label: "Tasks" },
  { href: "/lookahead", label: "Lookahead" },
  { href: "/pull-planning", label: "Pull Planning" },
  { href: "/weekly-plan", label: "Weekly Plan" },
  { href: "/gantt", label: "Gantt" },
  { href: "/roadblocks", label: "Roadblocks" },
  { href: "/impacts", label: "Impacts" },
  { href: "/submittals", label: "Submittals" },
  { href: "/rfis", label: "RFIs" },
  { href: "/drawings", label: "Drawings" },
  { href: "/baselines", label: "Baselines" },
  { href: "/activity", label: "Activity" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/members", label: "Members" },
];

export function ProjectSubNav({ projectId, active }: { projectId: string; active: string }) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-pill bg-surface-soft p-1.5">
      {TABS.map((tab) => {
        const isActive = tab.label === active;
        return (
          <Link
            key={tab.label}
            href={`/projects/${projectId}${tab.href}`}
            className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
              isActive ? "bg-canvas text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
