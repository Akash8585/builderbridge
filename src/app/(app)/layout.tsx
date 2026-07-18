import { NavBar } from "@/components/NavBar";
import { GlobalAssistant } from "@/components/GlobalAssistant";
import { ProjectRouteSubNav } from "@/components/ProjectSubNav";
import { DashboardPdfViewer } from "@/components/PdfViewer";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <NavBar />
      <ProjectRouteSubNav />
      <main className="app-main">{children}</main>
      <DashboardPdfViewer />
      <GlobalAssistant />
    </div>
  );
}
