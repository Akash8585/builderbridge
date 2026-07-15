import { NavBar } from "@/components/NavBar";
import { GlobalAssistant } from "@/components/GlobalAssistant";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <NavBar />
      <main className="app-main">{children}</main>
      <GlobalAssistant />
    </div>
  );
}
