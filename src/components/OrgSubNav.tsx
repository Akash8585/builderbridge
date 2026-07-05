import Link from "next/link";

const TABS = [
  { href: "/dashboard", label: "Executive Dashboard" },
  { href: "/timeline", label: "Timeline" },
  { href: "/trade-performance", label: "Trade Performance" },
];

export function OrgSubNav({ active }: { active: string }) {
  return (
    <div className="w-full overflow-x-auto rounded-pill bg-surface-soft">
      <div className="flex w-max min-w-full items-center gap-1 p-1.5">
        {TABS.map((tab) => {
          const isActive = tab.label === active;
          return (
            <Link
              key={tab.label}
              href={tab.href}
              className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive ? "bg-canvas text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
