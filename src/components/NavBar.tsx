import Link from "next/link";
import { OrgSwitcher } from "@/components/OrgSwitcher";
import { UserMenu } from "@/components/UserMenu";

export function NavBar() {
  return (
    <header className="h-16 border-b border-hairline bg-canvas flex items-center px-6">
      <Link href="/projects" className="font-display text-lg mr-6">
        BuilderBridge
      </Link>
      <Link href="/projects" className="text-sm text-muted hover:text-ink mr-4">
        Projects
      </Link>
      <Link href="/dashboard" className="text-sm text-muted hover:text-ink">
        Portfolio
      </Link>
      <div className="flex-1" />
      <div className="flex items-center gap-4">
        <OrgSwitcher />
        <UserMenu />
      </div>
    </header>
  );
}
