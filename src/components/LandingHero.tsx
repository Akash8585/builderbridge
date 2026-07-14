"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

type LandingHeroProps = {
  isSignedIn: boolean;
};

export function LandingHero({ isSignedIn }: LandingHeroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    void video.play().catch(() => {});
  }, []);

  return (
    <section id="hero" className="relative z-0 overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 pt-10 sm:pt-14 pb-16 sm:pb-24">
        <div className="max-w-3xl mx-auto text-center mb-10 sm:mb-14">
          <p className="inline-flex items-center rounded-pill bg-surface-card px-3 py-1 text-[13px] font-medium mb-6">
            Construction scheduling &amp; planning
          </p>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-[-0.03em] mb-6">
            The bridge between your schedule and the field.
          </h1>
          <p className="text-lg sm:text-xl text-body leading-relaxed mb-8 max-w-2xl mx-auto">
            One connected platform for the master schedule, lookaheads, weekly commitments, and
            roadblocks — so office and field teams finally plan the same project.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href={isSignedIn ? "/projects" : "/sign-up"}
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-on-primary hover:bg-primary-active transition-colors"
            >
              {isSignedIn ? "Open your projects" : "Get started free"}
            </Link>
            <a
              href="#features"
              className="inline-flex h-11 items-center justify-center rounded-md border border-hairline bg-canvas px-6 text-sm font-semibold text-ink hover:bg-surface-soft transition-colors"
            >
              See how it works
            </a>
          </div>
        </div>

        <div className="relative mx-auto rounded-2xl sm:rounded-3xl overflow-hidden border border-hairline shadow-[0_24px_64px_rgba(0,0,0,0.10)]">
          <div className="relative aspect-[16/9] sm:aspect-[21/9] bg-surface-dark">
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              aria-label="Active construction site with crews coordinating work"
            >
              <source src="/videos/construction-hero.mp4" type="video/mp4" />
            </video>
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent"
              aria-hidden
            />
          </div>
        </div>
      </div>
    </section>
  );
}
