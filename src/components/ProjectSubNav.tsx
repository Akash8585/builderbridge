import Link from "next/link";

// Grouped so a 15-tab nav still scans cleanly as a single scrollable line.
const TAB_GROUPS = [
  {
    label: "Plan",
    tabs: [
      { href: "", label: "Tasks" },
      { href: "/lookahead", label: "Lookahead" },
      { href: "/pull-planning", label: "Pull Planning" },
      { href: "/weekly-plan", label: "Weekly Plan" },
      { href: "/gantt", label: "Gantt" },
    ],
  },
  {
    label: "Control",
    tabs: [
      { href: "/roadblocks", label: "Roadblocks" },
      { href: "/impacts", label: "Impacts" },
      { href: "/submittals", label: "Submittals" },
      { href: "/rfis", label: "RFIs" },
      { href: "/drawings", label: "Drawings" },
    ],
  },
  {
    label: "Review",
    tabs: [
      { href: "/baselines", label: "Baselines" },
      { href: "/activity", label: "Activity" },
      { href: "/dashboard", label: "Dashboard" },
    ],
  },
  {
    label: "Team",
    tabs: [{ href: "/members", label: "Members" }],
  },
];

export function ProjectSubNav({ projectId, active }: { projectId: string; active: string }) {
  return (
    <nav
      aria-label="Project workspace"
      className="sticky top-16 z-20 w-full overflow-x-auto rounded-md border border-hairline bg-canvas/95 shadow-[0_1px_3px_rgba(17,17,17,0.04)] backdrop-blur-xl max-md:top-[104px]"
    >
      <div className="flex w-max min-w-full items-stretch px-2">
        {TAB_GROUPS.map((group, groupIndex) => (
          <div key={group.label} className="flex shrink-0 items-stretch">
            {groupIndex > 0 && <span className="my-2.5 w-px bg-hairline" aria-hidden />}
            <div className="px-2.5 py-2">
              <span className="mb-0.5 block px-2 text-[9px] font-bold uppercase tracking-[0.1em] text-muted-soft">
                {group.label}
              </span>
              <div className="flex items-center gap-0.5">
                {group.tabs.map((tab) => {
                  const isActive = tab.label === active;
                  return (
                    <Link
                      key={tab.label}
                      href={`/projects/${projectId}${tab.href}`}
                      aria-current={isActive ? "page" : undefined}
                      className={`shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                        isActive ? "bg-ink text-white" : "text-muted hover:bg-surface-soft hover:text-ink"
                      }`}
                    >
                      {tab.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
