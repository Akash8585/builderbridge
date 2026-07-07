import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireActiveOrganization } from "@/lib/session";
import { canUseIntegrations } from "@/lib/billing";
import { isProcoreConfigured } from "@/lib/procore";
import { fetchProcoreProjectsForOrg } from "@/app/actions/procore";
import { ProcoreIntegrationPanel } from "@/components/ProcoreIntegrationPanel";
import { Card } from "@/components/ui/Card";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { user, organizationId } = await requireActiveOrganization();
  const { connected, error } = await searchParams;

  const [org, membership, connection, projects] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
    prisma.member.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
    }),
    prisma.procoreConnection.findUnique({ where: { organizationId } }),
    prisma.project.findMany({
      where: { organizationId, isArchived: false },
      select: { id: true, name: true, procoreProjectId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const isOwner = membership?.role === "owner";
  const isProPlan = canUseIntegrations(org.planTier);
  const procoreProjects =
    connection && isOwner && isProPlan ? await fetchProcoreProjectsForOrg(organizationId) : [];

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl mb-1">Integrations</h1>
      <p className="text-sm text-muted mb-8">{org.name}</p>

      {connected && (
        <Card className="p-4 mb-6 border-success/40 bg-success/5">
          <p className="text-sm text-success font-medium">Procore connected successfully.</p>
        </Card>
      )}

      {error && (
        <Card className="p-4 mb-6 border-error/40 bg-error/5">
          <p className="text-sm text-error font-medium">{decodeURIComponent(error)}</p>
        </Card>
      )}

      <div className="space-y-6">
        <ProcoreIntegrationPanel
          isConfigured={isProcoreConfigured()}
          isProPlan={isProPlan}
          isOwner={isOwner}
          isConnected={!!connection}
          companyName={connection?.procoreCompanyName ?? null}
          projects={projects}
          procoreProjects={procoreProjects}
        />

        <Card className="p-6">
          <h2 className="text-sm font-semibold mb-2">Autodesk Construction Cloud</h2>
          <p className="text-sm text-muted">
            Drawing sync from ACC is coming in the next integration phase (5.3).{" "}
            <Link href="/pricing" className="underline hover:text-ink">
              Pro plan
            </Link>{" "}
            includes both Procore and Autodesk when available.
          </p>
        </Card>
      </div>
    </div>
  );
}
