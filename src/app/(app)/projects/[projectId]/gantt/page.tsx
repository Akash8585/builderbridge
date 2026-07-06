import { prisma } from "@/lib/prisma";
import { getProjectPageContext } from "@/lib/project-context";
import { canManageSchedule } from "@/lib/permissions";
import { computeCriticalPath } from "@/lib/critical-path";
import { ProjectSubNav } from "@/components/ProjectSubNav";
import { GanttChart } from "@/components/GanttChart";
import { TaskDependencyManager } from "@/components/TaskDependencyManager";

export default async function ProjectGanttPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { project, role } = await getProjectPageContext(projectId);

  const [tasks, dependencies] = await Promise.all([
    prisma.task.findMany({
      where: { projectId },
      include: { assignedTo: { include: { user: { select: { name: true } } } } },
      orderBy: { startDate: "asc" },
    }),
    prisma.taskDependency.findMany({
      where: { predecessor: { projectId } },
      select: { id: true, predecessorId: true, successorId: true },
    }),
  ]);

  const criticalTaskIds = computeCriticalPath(tasks, dependencies);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl mb-1">{project.name}</h1>
      <p className="text-sm text-muted mb-6">Gantt</p>

      <ProjectSubNav projectId={projectId} active="Gantt" />

      <div className="mt-8 space-y-6">
        <GanttChart
          tasks={tasks}
          rangeStart={project.startDate}
          rangeEnd={project.endDate}
          criticalTaskIds={[...criticalTaskIds]}
          dependencies={dependencies}
          canEdit={canManageSchedule(role)}
        />

        <TaskDependencyManager
          projectId={projectId}
          tasks={tasks.map((t) => ({ id: t.id, name: t.name }))}
          dependencies={dependencies}
          canManage={canManageSchedule(role)}
        />
      </div>
    </div>
  );
}
