import Link from "next/link";

// Grouped so a 15-tab nav still scans cleanly as a single scrollable line.
const TAB_GROUPS = [
  {
    tabs: [
      { href: "", label: "Tasks" },
      { href: "/lookahead", label: "Lookahead" },
      { href: "/pull-planning", label: "Pull Planning" },
      { href: "/weekly-plan", label: "Weekly Plan" },
      { href: "/gantt", label: "Gantt" },
    ],
  },
  {
    tabs: [
      { href: "/roadblocks", label: "Roadblocks" },
      { href: "/impacts", label: "Impacts" },
      { href: "/submittals", label: "Submittals" },
      { href: "/rfis", label: "RFIs" },
      { href: "/drawings", label: "Drawings" },
    ],
  },
  {
    tabs: [
      { href: "/baselines", label: "Baselines" },
      { href: "/activity", label: "Activity" },
      { href: "/assistant", label: "Assistant" },
      { href: "/dashboard", label: "Dashboard" },
    ],
  },
  {
    tabs: [{ href: "/members", label: "Members" }],
  },
];

export function ProjectSubNav({ projectId, active }: { projectId: string; active: string }) {
  return (
    <div className="w-full overflow-x-auto rounded-pill bg-surface-soft">
      <div className="flex w-max min-w-full items-center gap-x-3 px-2 py-1.5">
        {TAB_GROUPS.map((group, groupIndex) => (
          <div key={groupIndex} className="flex shrink-0 items-center gap-1">
            {groupIndex > 0 && <span className="w-px self-stretch bg-hairline mr-2" aria-hidden />}
            {group.tabs.map((tab) => {
              const isActive = tab.label === active;
              return (
                <Link
                  key={tab.label}
                  href={`/projects/${projectId}${tab.href}`}
                  className={`shrink-0 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive ? "bg-canvas text-ink shadow-sm" : "text-muted hover:text-ink"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
