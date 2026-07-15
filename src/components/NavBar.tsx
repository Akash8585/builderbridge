import Link from "next/link";
import { AppNavLinks } from "@/components/AppNavLinks";
import { OrgSwitcher } from "@/components/OrgSwitcher";
import { UserMenu } from "@/components/UserMenu";

export function NavBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/95 shadow-[0_1px_0_rgba(17,17,17,0.02)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-5 px-4 sm:px-6">
        <Link href="/projects" className="group flex shrink-0 items-center gap-2.5" aria-label="BuilderBridge projects">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink text-[11px] font-bold text-white transition-transform group-hover:scale-[1.04]">
            BB
          </span>
          <span className="font-display hidden text-base sm:inline">BuilderBridge</span>
        </Link>

        <AppNavLinks />

        <div className="min-w-0 flex-1" />
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <OrgSwitcher />
          <span className="hidden h-6 w-px bg-hairline lg:block" aria-hidden />
          <UserMenu />
        </div>
      </div>
      <div className="overflow-x-auto border-t border-hairline-soft py-1.5 md:hidden">
        <AppNavLinks mobile />
      </div>
    </header>
  );
}
