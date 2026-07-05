import { prisma } from "@/lib/prisma";
import { getProjectPageContext } from "@/lib/project-context";
import { ProjectSubNav } from "@/components/ProjectSubNav";
import { GanttChart } from "@/components/GanttChart";

export default async function ProjectGanttPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { project } = await getProjectPageContext(projectId);

  const tasks = await prisma.task.findMany({
    where: { projectId },
    include: { assignedTo: { include: { user: { select: { name: true } } } } },
    orderBy: { startDate: "asc" },
  });

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl mb-1">{project.name}</h1>
      <p className="text-sm text-muted mb-6">Gantt</p>

      <ProjectSubNav projectId={projectId} active="Gantt" />

      <div className="mt-8">
        <GanttChart tasks={tasks} rangeStart={project.startDate} rangeEnd={project.endDate} />
      </div>
    </div>
  );
}
