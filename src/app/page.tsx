import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";

export default async function RootPage() {
  const session = await getCurrentSession();

  if (!session?.user) redirect("/sign-in");
  redirect("/projects");
}
