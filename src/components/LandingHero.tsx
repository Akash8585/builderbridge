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
    <section id="hero" className="relative min-h-screen w-full overflow-hidden">
      <div className="absolute inset-0" aria-hidden>
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-label="Active construction site with crews coordinating work"
        >
          <source src="/videos/construction-hero.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/78 via-black/35 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/52 via-transparent to-black/18" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 pb-24 pt-36 sm:pt-40 lg:pt-44">
        <div className="max-w-2xl">
          <p className="mb-5 inline-flex items-center rounded-pill border border-white/25 bg-white/[0.12] px-3 py-1 text-[13px] font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.12)_inset] backdrop-blur-md">
            Construction scheduling &amp; planning
          </p>
          <h1 className="font-display max-w-[11ch] text-4xl leading-[1.03] tracking-[-0.03em] text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.35)] sm:text-5xl lg:text-6xl xl:text-7xl">
            The bridge between your schedule and the field.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/[0.86] sm:text-xl">
            One connected platform for the master schedule, lookaheads, weekly commitments, and
            roadblocks — so office and field teams finally plan the same project.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={isSignedIn ? "/projects" : "/sign-up"}
              className="inline-flex h-11 items-center justify-center rounded-md bg-white px-6 text-sm font-semibold text-ink transition-colors hover:bg-white/90"
            >
              {isSignedIn ? "Open your projects" : "Get started free"}
            </Link>
            <a
              href="#features"
              className="inline-flex h-11 items-center justify-center rounded-md border border-white/35 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              See how it works
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
