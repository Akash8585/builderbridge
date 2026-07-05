import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getProjectRole } from "@/lib/permissions";

/**
 * Loads a project for the current page and verifies the signed-in user is a
 * member of it. Redirects to /sign-in if unauthenticated, 404s if the project
 * doesn't exist, and redirects to /projects if the user isn't a member.
 */
export async function getProjectPageContext(projectId: string) {
  const user = await requireUser();

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) notFound();

  const role = await getProjectRole(user.id, projectId);
  if (!role) redirect("/projects");

  return { user, project, role };
}
