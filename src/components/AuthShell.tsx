import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-6">
      {/* Full-bleed atmospheric backdrop from the same jobsite image */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <Image
          src="/auth/auth-panel.png"
          alt=""
          fill
          priority
          className="scale-110 object-cover blur-2xl brightness-[0.55] saturate-[0.85]"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_15%,rgba(251,191,36,0.22),transparent_42%),radial-gradient(ellipse_at_85%_80%,rgba(59,130,246,0.18),transparent_45%),linear-gradient(180deg,rgba(15,17,21,0.55),rgba(15,17,21,0.78))]" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse at center, black 20%, transparent 75%)",
          }}
        />
      </div>

      <div className="relative grid w-full max-w-245 overflow-hidden rounded-[28px] border border-white/15 bg-white shadow-[0_40px_100px_rgba(0,0,0,0.45)] lg:h-[680px] lg:grid-cols-[1.05fr_0.95fr]">
        <aside className="relative hidden lg:block">
          <Image
            src="/auth/auth-panel.png"
            alt="Construction team and excavator on a rainy jobsite"
            fill
            priority
            className="object-cover"
            sizes="(min-width: 1024px) 520px, 100vw"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/25 to-black/10" />
          <div className="absolute inset-x-0 bottom-0 p-8 text-white">
            <Link href="/" className="font-display text-lg tracking-[-0.02em]">
              BuilderBridge
            </Link>
            <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-white/85">
              One place for the schedule, weekly plan, and a project-aware Agent that proposes changes before anything is written.
            </p>
          </div>
        </aside>

        <section className="relative flex min-h-[640px] flex-col bg-[#f7f8fa] px-6 py-8 sm:px-10 sm:py-10 lg:min-h-0">
          <Link
            href="/"
            className="absolute right-5 top-5 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-black/5 hover:text-ink"
            aria-label="Close and return home"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </Link>

          <div className="mb-8 lg:hidden">
            <Link href="/" className="font-display text-lg tracking-[-0.02em] text-ink">
              BuilderBridge
            </Link>
          </div>

          <div className="mx-auto flex w-full max-w-90 flex-1 flex-col justify-center">
            <div className="mb-7 text-center">
              <h1 className="font-display text-[1.75rem] tracking-[-0.03em] text-ink">{title}</h1>
              <p className="mt-2 min-h-10 text-sm leading-relaxed text-muted">{description}</p>
            </div>

            <div className="flex flex-1 flex-col justify-center">{children}</div>

            <div className="mt-7 text-center text-sm text-muted">{footer}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
