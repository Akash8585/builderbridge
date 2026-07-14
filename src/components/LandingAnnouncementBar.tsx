import Link from "next/link";

export function LandingAnnouncementBar() {
  return (
    <Link
      href="#why"
      className="group flex h-9 w-full items-center justify-center gap-2 bg-badge-emerald/25 px-4 text-[13px] font-medium text-ink transition-colors hover:bg-badge-emerald/35"
    >
      <span className="truncate">
        New: AI-powered scheduling is here. Meet BuilderBridge AI.
      </span>
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-ink/15 transition-colors group-hover:border-ink/30">
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </Link>
  );
}
