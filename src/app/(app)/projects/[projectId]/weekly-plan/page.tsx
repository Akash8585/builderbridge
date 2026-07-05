import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getProjectPageContext } from "@/lib/project-context";
import { ProjectSubNav } from "@/components/ProjectSubNav";
import { WeeklyPlanBoard } from "@/components/WeeklyPlanBoard";
import { Card } from "@/components/ui/Card";
import { formatDate, getWeekStart, percentComplete } from "@/lib/utils";

export default async function ProjectWeeklyPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { projectId } = await params;
  const { week } = await searchParams;
  const { project, role, user } = await getProjectPageContext(projectId);

  const requestedWeek = week ? new Date(week) : new Date();
  const weekStart = getWeekStart(requestedWeek);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const prevWeek = new Date(weekStart);
  prevWeek.setDate(prevWeek.getDate() - 7);
  const nextWeek = new Date(weekStart);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const toParam = (d: Date) => d.toISOString().slice(0, 10);

  const [commitments, allTasks] = await Promise.all([
    prisma.weeklyCommitment.findMany({
      where: { weekStartDate: weekStart, task: { projectId } },
      include: {
        task: { select: { id: true, name: true } },
        committedBy: { include: { user: { select: { name: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.task.findMany({
      where: { projectId },
      select: { id: true, name: true, assignedTo: { select: { userId: true } } },
    }),
  ]);

  const alreadyCommittedTaskIds = new Set(commitments.map((c) => c.task.id));
  const canCommitAny = role === "PROJECT_MANAGER" || role === "SUPERINTENDENT";
  const committableTasks = allTasks
    .filter((t) => !alreadyCommittedTaskIds.has(t.id))
    .filter((t) => canCommitAny || t.assignedTo?.userId === user.id)
    .map((t) => ({ id: t.id, name: t.name }));

  const totalCommitments = commitments.length;
  const completedCommitments = commitments.filter((c) => c.status === "COMPLETED").length;
  const ppc = percentComplete(totalCommitments, completedCommitments);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl mb-1">{project.name}</h1>
      <p className="text-sm text-muted mb-6">Weekly Work Plan</p>

      <ProjectSubNav projectId={projectId} active="Weekly Plan" />

      <div className="mt-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/projects/${projectId}/weekly-plan?week=${toParam(prevWeek)}`}
              className="text-sm text-muted hover:text-ink"
            >
              ← Prev
            </Link>
            <p className="text-sm font-medium text-ink">
              {formatDate(weekStart)} – {formatDate(weekEnd)}
            </p>
            <Link
              href={`/projects/${projectId}/weekly-plan?week=${toParam(nextWeek)}`}
              className="text-sm text-muted hover:text-ink"
            >
              Next →
            </Link>
          </div>
          {totalCommitments > 0 && (
            <Card className="px-4 py-2">
              <span className="text-xs text-muted mr-2">PPC</span>
              <span className="font-display text-lg">{ppc}%</span>
            </Card>
          )}
        </div>

        <Card className="p-6">
          <WeeklyPlanBoard
            weekStartDate={weekStart.toISOString()}
            commitments={commitments}
            committableTasks={committableTasks}
          />
        </Card>
      </div>
    </div>
  );
}
