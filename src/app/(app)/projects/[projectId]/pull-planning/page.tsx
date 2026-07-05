import { prisma } from "@/lib/prisma";
import { getProjectPageContext } from "@/lib/project-context";
import { canManageSchedule } from "@/lib/permissions";
import { ProjectSubNav } from "@/components/ProjectSubNav";
import { PullPlanningBoard } from "@/components/PullPlanningBoard";
import { formatDate } from "@/lib/utils";

const WINDOW_WEEKS = 3;

export default async function ProjectPullPlanningPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { project, role } = await getProjectPageContext(projectId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const windowEnd = new Date(today);
  windowEnd.setDate(windowEnd.getDate() + WINDOW_WEEKS * 7);

  const tasks = await prisma.task.findMany({
    where: { projectId, startDate: { lte: windowEnd }, endDate: { gte: today } },
    include: { assignedTo: { include: { user: { select: { name: true } } } } },
    orderBy: [{ sequenceOrder: "asc" }, { startDate: "asc" }],
  });

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl mb-1">{project.name}</h1>
      <p className="text-sm text-muted mb-6">Pull Planning</p>

      <ProjectSubNav projectId={projectId} active="Pull Planning" />

      <div className="mt-8 space-y-4">
        <p className="text-sm text-muted">
          Sequencing board for the next {WINDOW_WEEKS} weeks ({formatDate(today)} – {formatDate(windowEnd)}). Trade
          partners add their own tasks; a Project Manager, Scheduler, or Superintendent sequences the order of work.
        </p>
        <PullPlanningBoard
          key={tasks.map((t) => t.id).join(",")}
          projectId={projectId}
          initialTasks={tasks}
          canSequence={canManageSchedule(role)}
        />
      </div>
    </div>
  );
}
