import { prisma } from "@/lib/prisma";
import { getProjectPageContext } from "@/lib/project-context";
import { ProjectSubNav } from "@/components/ProjectSubNav";
import { InviteLinkGenerator } from "@/components/InviteLinkGenerator";
import { ProjectMembersTable } from "@/components/ProjectMembersTable";
import { Card } from "@/components/ui/Card";

export default async function ProjectMembersPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { project, role } = await getProjectPageContext(projectId);

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  const canManage = role === "GC_OWNER";

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl mb-1">{project.name}</h1>
      <p className="text-sm text-muted mb-6">Members</p>

      <ProjectSubNav projectId={projectId} active="Members" />

      <div className="mt-8 space-y-6">
        {canManage && <InviteLinkGenerator projectId={projectId} />}

        <Card className="p-6">
          <ProjectMembersTable projectId={projectId} members={members} canManage={canManage} />
        </Card>
      </div>
    </div>
  );
}
