import { prisma } from "@/lib/prisma";
import { getProjectPageContext } from "@/lib/project-context";
import { ProjectSubNav } from "@/components/ProjectSubNav";
import { DashboardStats } from "@/components/DashboardStats";
import { PpcTrendChart } from "@/components/PpcTrendChart";
import { PrrTable } from "@/components/PrrTable";
import { SCurveChart } from "@/components/SCurveChart";
import { Card } from "@/components/ui/Card";
import { percentComplete } from "@/lib/utils";
import { computePpcTrend, computePrrByMember, computeSCurve } from "@/lib/analytics";

export default async function ProjectDashboardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { project } = await getProjectPageContext(projectId);

  const [totalTasks, doneTasks, openRoadblocks, commitments, allTasks] = await Promise.all([
    prisma.task.count({ where: { projectId } }),
    prisma.task.count({ where: { projectId, status: "DONE" } }),
    prisma.task.count({ where: { projectId, isRoadblock: true, roadblockStatus: "OPEN" } }),
    prisma.weeklyCommitment.findMany({
      where: { task: { projectId } },
      include: { committedBy: { include: { user: { select: { name: true } } } } },
      orderBy: { weekStartDate: "asc" },
    }),
    prisma.task.findMany({
      where: { projectId },
      select: { endDate: true, status: true, updatedAt: true },
    }),
  ]);

  const ppcTrend = computePpcTrend(commitments);
  const prrByMember = computePrrByMember(
    commitments.map((c) => ({
      committedById: c.committedById,
      committedByName: c.committedBy.user.name,
      status: c.status,
    }))
  );
  const today = new Date();
  const sCurveRangeEnd = project.endDate > today ? project.endDate : today;
  const sCurve = computeSCurve(allTasks, project.startDate, sCurveRangeEnd);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl mb-1">{project.name}</h1>
      <p className="text-sm text-muted mb-6">Dashboard</p>

      <ProjectSubNav projectId={projectId} active="Dashboard" />

      <div className="mt-8 space-y-6">
        <DashboardStats
          totalTasks={totalTasks}
          percentComplete={percentComplete(totalTasks, doneTasks)}
          openRoadblocks={openRoadblocks}
        />

        {totalTasks > 0 && (
          <>
            <Card className="p-6">
              <h2 className="text-sm font-semibold mb-1">Schedule Progress (S-Curve)</h2>
              <p className="text-xs text-muted-soft mb-4">Planned vs. actual cumulative task completion</p>
              <SCurveChart sCurve={sCurve} />
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="p-6">
                <h2 className="text-sm font-semibold mb-1">PPC Trend</h2>
                <p className="text-xs text-muted-soft mb-4">Percent Plan Complete, by committed week</p>
                <PpcTrendChart ppcTrend={ppcTrend} />
              </Card>

              <Card className="p-6">
                <h2 className="text-sm font-semibold mb-1">Promise Reliability Rate (PRR)</h2>
                <p className="text-xs text-muted-soft mb-4">Commitment completion rate by trade/member</p>
                <PrrTable prrByMember={prrByMember} />
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
