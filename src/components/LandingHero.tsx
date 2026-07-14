"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

type LandingHeroProps = {
  isSignedIn: boolean;
};

const HERO_ANCHORS = [
  { label: "What it is", href: "#features" },
  { label: "Built for the field", href: "#roles" },
  { label: "Why BuilderBridge", href: "#why" },
  { label: "Pricing", href: "/pricing" },
];

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
        <div className="absolute inset-0 bg-black/25" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/30 to-black/45" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/20" />
      </div>

      <div className="relative mx-auto min-h-screen max-w-[1400px] px-6 pb-8 pt-32 sm:px-10 lg:px-12 lg:pb-10 lg:pt-40">
        <div className="relative min-h-[calc(100vh-10rem)] lg:min-h-[calc(100vh-12rem)]">
          <p className="mb-10 text-[13px] font-medium uppercase tracking-[0.14em] text-white/70 lg:absolute lg:left-0 lg:top-0 lg:mb-0">
            Construction scheduling &amp; planning
          </p>

          <h1 className="font-display max-w-[12ch] text-[2.75rem] leading-[1.02] tracking-[-0.03em] text-white sm:text-6xl lg:absolute lg:bottom-28 lg:left-0 lg:max-w-[11ch] lg:text-7xl xl:text-[5.25rem]">
            The bridge
            <br />
            between your
            <br />
            schedule and
            <br />
            the field.
          </h1>

          <div className="mt-10 max-w-md lg:absolute lg:right-0 lg:top-[46%] lg:mt-0 lg:-translate-y-1/2 lg:max-w-sm xl:max-w-md">
            <p className="text-base leading-relaxed text-white/82 sm:text-lg">
              One connected platform for the master schedule, lookaheads, weekly commitments, and
              roadblocks — so office and field teams finally plan the same project.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href={isSignedIn ? "/projects" : "/sign-up"}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#f97316] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#ea580c]"
              >
                {isSignedIn ? "Open your projects" : "Get started free"}
                <span aria-hidden>→</span>
              </Link>
              <a
                href="#features"
                className="inline-flex h-11 items-center justify-center rounded-md border border-white/35 px-5 text-sm font-semibold text-white/90 transition-colors hover:bg-white/10"
              >
                See how it works
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-white/35 pt-5 lg:absolute lg:bottom-8 lg:left-12 lg:right-12 lg:mt-0">
          <nav className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm font-medium text-white/75">
            {HERO_ANCHORS.map((item, index) => (
              <a
                key={item.label}
                href={item.href}
                className={`transition-colors hover:text-white ${
                  index === 0 ? "text-white underline underline-offset-8 decoration-white/80" : ""
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </section>
  );
}
