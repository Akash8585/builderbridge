import { NavBar } from "@/components/NavBar";
import { GlobalAssistant } from "@/components/GlobalAssistant";
import { ProjectRouteSubNav } from "@/components/ProjectSubNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <NavBar />
      <ProjectRouteSubNav />
      <main className="app-main">{children}</main>
      <GlobalAssistant />
    </div>
  );
}
