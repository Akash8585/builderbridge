import { NavBar } from "@/components/NavBar";
import { GlobalAssistant } from "@/components/GlobalAssistant";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <NavBar />
      <main>{children}</main>
      <GlobalAssistant />
    </div>
  );
}
