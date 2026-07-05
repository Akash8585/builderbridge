import { prisma } from "@/lib/prisma";
import { getProjectPageContext } from "@/lib/project-context";
import { ProjectSubNav } from "@/components/ProjectSubNav";
import { DashboardStats } from "@/components/DashboardStats";
import { percentComplete } from "@/lib/utils";

export default async function ProjectDashboardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { project } = await getProjectPageContext(projectId);

  const [totalTasks, doneTasks, openRoadblocks] = await Promise.all([
    prisma.task.count({ where: { projectId } }),
    prisma.task.count({ where: { projectId, status: "DONE" } }),
    prisma.task.count({ where: { projectId, isRoadblock: true, roadblockStatus: "OPEN" } }),
  ]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl mb-1">{project.name}</h1>
      <p className="text-sm text-muted mb-6">Dashboard</p>

      <ProjectSubNav projectId={projectId} active="Dashboard" />

      <div className="mt-8">
        <DashboardStats
          totalTasks={totalTasks}
          percentComplete={percentComplete(totalTasks, doneTasks)}
          openRoadblocks={openRoadblocks}
        />
      </div>
    </div>
  );
}
