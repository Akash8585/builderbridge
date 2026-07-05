import { prisma } from "@/lib/prisma";
import { getProjectPageContext } from "@/lib/project-context";
import { canManageSchedule } from "@/lib/permissions";
import { ProjectSubNav } from "@/components/ProjectSubNav";
import { DrawingList } from "@/components/DrawingList";

export default async function ProjectDrawingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { project, role } = await getProjectPageContext(projectId);

  const [drawings, tasks] = await Promise.all([
    prisma.drawing.findMany({
      where: { projectId },
      include: {
        uploadedBy: { include: { user: { select: { name: true } } } },
        task: { select: { id: true, name: true } },
      },
      orderBy: [{ title: "asc" }, { revision: "desc" }],
    }),
    prisma.task.findMany({ where: { projectId }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl mb-1">{project.name}</h1>
      <p className="text-sm text-muted mb-6">Drawings</p>

      <ProjectSubNav projectId={projectId} active="Drawings" />

      <div className="mt-8">
        <DrawingList projectId={projectId} drawings={drawings} tasks={tasks} canUpload={canManageSchedule(role)} />
      </div>
    </div>
  );
}
