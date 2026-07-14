"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { LandingAnnouncementBar } from "@/components/LandingAnnouncementBar";

type MegaItem = {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
};

type MegaColumn = {
  title: string;
  items: MegaItem[];
};

const FEATURE_COLUMNS: MegaColumn[] = [
  {
    title: "Scheduling",
    items: [
      {
        title: "Master Schedule",
        description: "Build and update your contract schedule with Gantt, dependencies, and critical path.",
        href: "#features",
        icon: <IconGantt />,
      },
      {
        title: "Schedule Impact Request",
        description: "Request changes when field conditions push work outside the plan.",
        href: "#features",
        icon: <IconImpact />,
      },
      {
        title: "Submittals",
        description: "Track submittal status and due dates linked to schedule activities.",
        href: "#features",
        icon: <IconSubmittal />,
      },
      {
        title: "RFIs",
        description: "Turn RFIs into trackable roadblocks before they delay the job.",
        href: "#features",
        icon: <IconRfi />,
      },
    ],
  },
  {
    title: "Field coordination",
    items: [
      {
        title: "Lookahead",
        description: "Plan ahead with a rolling window synced to the master schedule.",
        href: "#features",
        icon: <IconLookahead />,
      },
      {
        title: "Field Tracking",
        description: "Field teams log progress notes and photos without leaving the jobsite.",
        href: "#features",
        icon: <IconField />,
      },
      {
        title: "Weekly Work Plan",
        description: "Set weekly commitments and track Percent Plan Complete automatically.",
        href: "#features",
        icon: <IconWeekly />,
      },
      {
        title: "Roadblocks & Constraints",
        description: "Flag issues early so teams resolve them before work slips.",
        href: "#features",
        icon: <IconRoadblock />,
      },
    ],
  },
  {
    title: "Portfolio management",
    items: [
      {
        title: "Projects Timeline",
        description: "See every active project's schedule on one shared timeline.",
        href: "#features",
        icon: <IconTimeline />,
      },
      {
        title: "Executive Dashboard",
        description: "Know where each project stands — health, variance, and open risk.",
        href: "#features",
        icon: <IconDashboard />,
      },
      {
        title: "Analytics",
        description: "PPC trends, PRR, S-curves, and baselines that drive better performance.",
        href: "#features",
        icon: <IconAnalytics />,
      },
    ],
  },
  {
    title: "BuilderBridge AI",
    items: [
      {
        title: "AI Assistant",
        description: "Instant schedule answers grounded in your live project data.",
        href: "#why",
        icon: <IconAi />,
      },
      {
        title: "Portfolio Q&A",
        description: "Ask across all projects — roadblocks, commitments, and portfolio health.",
        href: "#why",
        icon: <IconPortfolioAi />,
      },
    ],
  },
];

const SOLUTION_COLUMNS: MegaColumn[] = [
  {
    title: "By role",
    items: [
      {
        title: "Project Managers",
        description: "Built for PMs to plan faster, track risks, and stay aligned.",
        href: "#roles",
        icon: <IconPm />,
      },
      {
        title: "Schedulers",
        description: "Less hassle, better scheduling, and more time back in your day.",
        href: "#roles",
        icon: <IconScheduler />,
      },
      {
        title: "Superintendents",
        description: "You run the site. BuilderBridge gives you the tools to do it right.",
        href: "#roles",
        icon: <IconSuperintendent />,
      },
      {
        title: "Trade Partners",
        description: "Enable trades to self-update and contribute to planning.",
        href: "#roles",
        icon: <IconTrade />,
      },
    ],
  },
  {
    title: "By size",
    items: [
      {
        title: "Mid-Market",
        description: "Roll out fast. Keep teams aligned with one schedule, one lookahead, one weekly plan.",
        href: "#roles",
        icon: <IconMidMarket />,
      },
      {
        title: "Enterprise",
        description: "Standardize scheduling across the portfolio with analytics, controls, and real-time risk visibility.",
        href: "#features",
        icon: <IconEnterprise />,
      },
    ],
  },
  {
    title: "Integration",
    items: [
      {
        title: "Autodesk",
        description: "Sync drawings from ACC into your BuilderBridge schedule and document log.",
        href: "/pricing",
        icon: <IconAutodesk />,
      },
      {
        title: "Procore",
        description: "Sync RFIs and submittals to the schedule. See risk early and keep teams aligned.",
        href: "/pricing",
        icon: <IconProcore />,
      },
    ],
  },
];

type MegaMenuId = "features" | "solutions";

function MegaMenuPanel({
  columns,
  panelId,
  layout,
  onClose,
  floating,
}: {
  columns: MegaColumn[];
  panelId: string;
  layout: "features" | "solutions";
  onClose: () => void;
  floating?: boolean;
}) {
  const gridClass =
    layout === "solutions"
      ? "grid grid-cols-1 md:grid-cols-3 gap-10 lg:grid-cols-[1.35fr_1fr_1fr]"
      : "grid grid-cols-2 md:grid-cols-4 gap-8";

  return (
    <div
      id={panelId}
      className={`hidden lg:block bg-canvas ${floating ? "" : "border-t border-hairline-soft shadow-[0_12px_40px_rgba(0,0,0,0.06)]"}`}
    >
      <div className={`mx-auto px-5 py-6 ${floating ? "max-w-none" : "max-w-6xl px-6 py-8"}`}>
        <div className={gridClass}>
          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-soft pb-3 mb-5 border-b border-hairline">
                {col.title}
              </p>
              <ul className="space-y-4">
                {col.items.map((item) => (
                  <li key={item.title}>
                    <a
                      href={item.href}
                      className="group flex gap-3 rounded-lg p-2 -mx-2 hover:bg-surface-soft transition-colors"
                      onClick={onClose}
                    >
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-hairline-soft bg-surface-soft text-muted group-hover:text-ink group-hover:border-hairline transition-colors">
                        {item.icon}
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-ink group-hover:underline">
                          {item.title}
                        </span>
                        <span className="block text-xs text-muted leading-snug mt-0.5">{item.description}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LandingMegaNav({ isSignedIn }: { isSignedIn: boolean }) {
  const [activeMenu, setActiveMenu] = useState<MegaMenuId | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const featuresPanelId = useId();
  const solutionsPanelId = useId();
  const navRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Scroll styling only after mount — keeps SSR and first client paint identical */
  const isFloating = mounted && scrolled;
  const showAnnouncement = !scrolled;

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setActiveMenu(null), 120);
  }, [clearCloseTimer]);

  const openMenu = useCallback(
    (menu: MegaMenuId) => {
      clearCloseTimer();
      setActiveMenu(menu);
    },
    [clearCloseTimer]
  );

  useEffect(() => {
    setMounted(true);
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!navRef.current?.contains(e.target as Node)) setActiveMenu(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setActiveMenu(null);
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      clearCloseTimer();
    };
  }, [clearCloseTimer]);

  const navLinkClass =
    "px-3 py-2 text-sm font-medium text-muted hover:text-ink transition-colors rounded-md";

  const navTriggerClass = (active: boolean) =>
    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      active ? "text-ink bg-surface-soft" : "text-muted hover:text-ink"
    }`;

  const announcementMotion =
    "transition-[height,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]";

  return (
    <>
      <div
        className={`shrink-0 ${announcementMotion} ${
          showAnnouncement ? "h-[100px]" : "h-16"
        }`}
        aria-hidden
      />

      <header className={`fixed top-0 left-0 right-0 z-50 ${isFloating ? "pt-3" : ""}`}>
        <div
          className={`overflow-hidden ${announcementMotion} ${
            showAnnouncement ? "h-9" : "h-0"
          }`}
        >
          <div
            className={`${announcementMotion} ${
              showAnnouncement ? "translate-y-0" : "-translate-y-full"
            }`}
          >
            <LandingAnnouncementBar />
          </div>
        </div>

        <div
          ref={navRef}
          onMouseLeave={scheduleClose}
          className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6"
        >
          <div
            className={`w-full transition-all duration-300 ease-out ${
              isFloating
                ? "rounded-2xl border border-hairline bg-canvas shadow-[0_4px_16px_rgba(0,0,0,0.06)]"
                : "border-b border-hairline-soft bg-canvas"
            }`}
          >
            <div className="flex h-16 items-center px-5 sm:px-6">
              <Link href="/" className="font-display shrink-0 text-lg tracking-[-0.02em]">
                BuilderBridge
              </Link>

              <nav className="ml-10 hidden items-center gap-1 lg:flex">
                <button
                  type="button"
                  className={navTriggerClass(activeMenu === "features")}
                  aria-expanded={activeMenu === "features"}
                  aria-controls={featuresPanelId}
                  onMouseEnter={() => openMenu("features")}
                  onClick={() => setActiveMenu((m) => (m === "features" ? null : "features"))}
                >
                  Features
                  <span className="ml-1 text-[10px] opacity-60" aria-hidden>
                    ▾
                  </span>
                </button>

                <button
                  type="button"
                  className={navTriggerClass(activeMenu === "solutions")}
                  aria-expanded={activeMenu === "solutions"}
                  aria-controls={solutionsPanelId}
                  onMouseEnter={() => openMenu("solutions")}
                  onClick={() => setActiveMenu((m) => (m === "solutions" ? null : "solutions"))}
                >
                  Solutions
                  <span className="ml-1 text-[10px] opacity-60" aria-hidden>
                    ▾
                  </span>
                </button>

                <a href="#why" className={navLinkClass}>
                  Why BuilderBridge
                </a>
                <Link href="/pricing" className={navLinkClass}>
                  Pricing
                </Link>
              </nav>

              <div className="flex-1" />

              <button
                type="button"
                className="mr-3 p-2 text-muted hover:text-ink lg:hidden"
                aria-expanded={mobileOpen}
                aria-label="Open menu"
                onClick={() => setMobileOpen((v) => !v)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
              </button>

              <div className="flex items-center gap-3">
                {isSignedIn ? (
                  <Link
                    href="/projects"
                    className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-on-primary hover:bg-primary-active transition-colors"
                  >
                    Open app
                  </Link>
                ) : (
                  <>
                    <Link href="/sign-in" className="hidden text-sm font-semibold text-ink hover:underline sm:inline">
                      Sign in
                    </Link>
                    <Link
                      href="/sign-up"
                      className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-on-primary hover:bg-primary-active transition-colors"
                    >
                      Get started
                    </Link>
                  </>
                )}
              </div>
            </div>

            {!isFloating && activeMenu === "features" && (
              <div onMouseEnter={clearCloseTimer}>
                <MegaMenuPanel
                  columns={FEATURE_COLUMNS}
                  panelId={featuresPanelId}
                  layout="features"
                  onClose={() => setActiveMenu(null)}
                />
              </div>
            )}

            {!isFloating && activeMenu === "solutions" && (
              <div onMouseEnter={clearCloseTimer}>
                <MegaMenuPanel
                  columns={SOLUTION_COLUMNS}
                  panelId={solutionsPanelId}
                  layout="solutions"
                  onClose={() => setActiveMenu(null)}
                />
              </div>
            )}

            {mobileOpen && (
              <div className="max-h-[70vh] overflow-y-auto border-t border-hairline-soft px-4 py-4 lg:hidden sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-soft mb-2">Features</p>
          {FEATURE_COLUMNS.map((col) => (
            <div key={col.title} className="mb-5">
              <p className="text-xs font-medium text-muted mb-1">{col.title}</p>
              <ul className="space-y-1">
                {col.items.map((item) => (
                  <li key={item.title}>
                    <a
                      href={item.href}
                      className="block py-1.5 text-sm font-medium text-ink"
                      onClick={() => setMobileOpen(false)}
                    >
                      {item.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-soft mb-2 pt-2 border-t border-hairline-soft">
            Solutions
          </p>
          {SOLUTION_COLUMNS.map((col) => (
            <div key={col.title} className="mb-6 last:mb-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-soft mb-2">{col.title}</p>
              <ul className="space-y-1">
                {col.items.map((item) => (
                  <li key={item.title}>
                    <a
                      href={item.href}
                      className="block py-2 text-sm font-medium text-ink"
                      onClick={() => setMobileOpen(false)}
                    >
                      {item.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="flex flex-col gap-2 pt-2 border-t border-hairline-soft">
            <a href="#why" className="py-2 text-sm font-medium text-muted" onClick={() => setMobileOpen(false)}>
              Why BuilderBridge
            </a>
            <Link href="/pricing" className="py-2 text-sm font-medium text-muted" onClick={() => setMobileOpen(false)}>
              Pricing
            </Link>
          </div>
            </div>
          )}
          </div>

          {isFloating && activeMenu === "features" && (
            <div
              className="hidden w-full overflow-hidden rounded-2xl border border-hairline bg-canvas shadow-[0_8px_30px_rgba(0,0,0,0.08)] lg:block"
              onMouseEnter={clearCloseTimer}
            >
              <MegaMenuPanel
                columns={FEATURE_COLUMNS}
                panelId={featuresPanelId}
                layout="features"
                floating
                onClose={() => setActiveMenu(null)}
              />
            </div>
          )}

          {isFloating && activeMenu === "solutions" && (
            <div
              className="hidden w-full overflow-hidden rounded-2xl border border-hairline bg-canvas shadow-[0_8px_30px_rgba(0,0,0,0.08)] lg:block"
              onMouseEnter={clearCloseTimer}
            >
              <MegaMenuPanel
                columns={SOLUTION_COLUMNS}
                panelId={solutionsPanelId}
                layout="solutions"
                floating
                onClose={() => setActiveMenu(null)}
              />
            </div>
          )}
        </div>
      </header>
    </>
  );
}

/* ---------- Simple line icons (Outbuild-style) ---------- */

function iconProps() {
  return { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, "aria-hidden": true as const };
}

function IconGantt() {
  const p = iconProps();
  return (
    <svg {...p}>
      <rect x="3" y="5" width="8" height="3" rx="1" />
      <rect x="8" y="11" width="10" height="3" rx="1" />
      <rect x="5" y="17" width="12" height="3" rx="1" />
    </svg>
  );
}

function IconImpact() {
  const p = iconProps();
  return (
    <svg {...p}>
      <path d="M12 3v18M5 8l7-5 7 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSubmittal() {
  const p = iconProps();
  return (
    <svg {...p}>
      <path d="M8 4h8l4 4v12H4V4h4z" strokeLinejoin="round" />
      <path d="M8 4v4h8M8 12h8M8 16h5" strokeLinecap="round" />
    </svg>
  );
}

function IconRfi() {
  const p = iconProps();
  return (
    <svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 015 1c0 2-2.5 2-2.5 4" strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconLookahead() {
  const p = iconProps();
  return (
    <svg {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 4v4M16 4v4" strokeLinecap="round" />
    </svg>
  );
}

function IconField() {
  const p = iconProps();
  return (
    <svg {...p}>
      <path d="M4 20l6-8 4 5 6-11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconWeekly() {
  const p = iconProps();
  return (
    <svg {...p}>
      <path d="M5 7h14M5 12h14M5 17h9" strokeLinecap="round" />
      <circle cx="18" cy="17" r="3" />
      <path d="M17 17l1 1 2-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconRoadblock() {
  const p = iconProps();
  return (
    <svg {...p}>
      <path d="M12 3l9 16H3L12 3z" strokeLinejoin="round" />
      <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
    </svg>
  );
}

function IconTimeline() {
  const p = iconProps();
  return (
    <svg {...p}>
      <path d="M4 6h16M4 12h10M4 18h14" strokeLinecap="round" />
      <circle cx="19" cy="12" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconDashboard() {
  const p = iconProps();
  return (
    <svg {...p}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="10" width="8" height="11" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}

function IconAnalytics() {
  const p = iconProps();
  return (
    <svg {...p}>
      <path d="M4 19V5M4 19h16" strokeLinecap="round" />
      <path d="M8 15v-4M12 15V8M16 15v-6" strokeLinecap="round" />
    </svg>
  );
}

function IconAi() {
  const p = iconProps();
  return (
    <svg {...p}>
      <path d="M12 3c4 0 7 2.5 7 6 0 2-.8 3.8-2.2 5L17 21l-5-2.5L7 21l.2-7C5.8 12.8 5 11 5 9c0-3.5 3-6 7-6z" strokeLinejoin="round" />
    </svg>
  );
}

function IconPortfolioAi() {
  const p = iconProps();
  return (
    <svg {...p}>
      <circle cx="8" cy="8" r="3" />
      <circle cx="16" cy="8" r="3" />
      <circle cx="12" cy="16" r="3" />
      <path d="M10 10l2 4M14 10l-2 4" strokeLinecap="round" />
    </svg>
  );
}

function IconPm() {
  const p = iconProps();
  return (
    <svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconScheduler() {
  return <IconGantt />;
}

function IconSuperintendent() {
  const p = iconProps();
  return (
    <svg {...p}>
      <path d="M12 3l2.2 6.8H21l-5.5 4 2.1 6.7L12 16.4 6.4 20.5l2.1-6.7L3 9.8h6.8L12 3z" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrade() {
  const p = iconProps();
  return (
    <svg {...p}>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M10 18h4" strokeLinecap="round" />
    </svg>
  );
}

function IconMidMarket() {
  const p = iconProps();
  return (
    <svg {...p}>
      <path d="M4 20V8l8-4 8 4v12" strokeLinejoin="round" />
      <path d="M9 20v-6h6v6" strokeLinejoin="round" />
    </svg>
  );
}

function IconEnterprise() {
  const p = iconProps();
  return (
    <svg {...p}>
      <rect x="4" y="4" width="6" height="18" rx="1" />
      <rect x="12" y="8" width="8" height="14" rx="1" />
      <path d="M6 8V6M7 8V5M14 12v-2M15 12v-3M16 12v-1" strokeLinecap="round" />
    </svg>
  );
}

function IconAutodesk() {
  const p = iconProps();
  return (
    <svg {...p}>
      <path d="M4 18L12 4l8 14H4z" strokeLinejoin="round" />
      <path d="M8 14h8" strokeLinecap="round" />
    </svg>
  );
}

function IconProcore() {
  const p = iconProps();
  return (
    <svg {...p}>
      <path d="M7 7h10v10H7z" strokeLinejoin="round" />
      <path d="M4 4h4v4M16 4h4v4M4 16h4v4M16 16h4v4" strokeLinecap="round" />
    </svg>
  );
}
