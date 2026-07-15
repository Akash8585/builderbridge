"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/projects", label: "Projects", match: (path: string) => path.startsWith("/projects") },
  {
    href: "/dashboard",
    label: "Portfolio",
    match: (path: string) => path === "/dashboard" || path === "/timeline" || path === "/trade-performance",
  },
  { href: "/integrations", label: "Integrations", match: (path: string) => path === "/integrations" },
  { href: "/billing", label: "Billing", match: (path: string) => path === "/billing" },
];

export function AppNavLinks({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={mobile ? "Mobile navigation" : "Primary navigation"}
      className={mobile ? "flex min-w-max items-center gap-1 px-3" : "hidden items-center gap-1 md:flex"}
    >
      {LINKS.map((link) => {
        const active = link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex h-9 items-center rounded-md px-3 text-sm font-medium transition-colors ${
              active ? "bg-ink text-white" : "text-muted hover:bg-surface-soft hover:text-ink"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
