import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrganizationMembership } from "@/lib/permissions";

export async function getCurrentSession() {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * Use in Server Components / Server Actions that require a signed-in user.
 * Redirects to /sign-in if there is no session.
 */
export async function requireUser() {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/sign-in");
  return session.user;
}

/**
 * Use on pages that require an active organization. Redirects to /sign-in if
 * unauthenticated, or /organizations/new if the user has no active organization.
 */
export async function requireActiveOrganization() {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/sign-in");

  const activeOrganizationId = session.session.activeOrganizationId;
  const activeMembership = activeOrganizationId
    ? await getOrganizationMembership(session.user.id, activeOrganizationId)
    : null;
  if (!activeMembership) {
    // Fall back to the user's first org membership (e.g. right after accepting
    // an invite) before sending them to create a brand new one.
    const firstMembership = await prisma.member.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
    });
    if (!firstMembership) redirect("/organizations/new");
    return { user: session.user, organizationId: firstMembership.organizationId };
  }

  return { user: session.user, organizationId: activeMembership.organizationId };
}
