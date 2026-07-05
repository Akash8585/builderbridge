import Link from "next/link";
import { OrgSwitcher } from "@/components/OrgSwitcher";
import { UserMenu } from "@/components/UserMenu";

export function NavBar() {
  return (
    <header className="h-16 border-b border-hairline bg-canvas flex items-center px-6">
      <Link href="/projects" className="font-display text-lg mr-6">
        BuildFlow
      </Link>
      <div className="flex-1" />
      <div className="flex items-center gap-4">
        <OrgSwitcher />
        <UserMenu />
      </div>
    </header>
  );
}
