import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireActiveOrganization } from "@/lib/session";
import { OrgSubNav } from "@/components/OrgSubNav";
import { Card } from "@/components/ui/Card";
import { loadProjectSummary, healthColor } from "@/lib/project-summary";

export default async function ExecutiveDashboardPage() {
  const { organizationId } = await requireActiveOrganization();

  const projects = await prisma.project.findMany({
    where: { organizationId, isArchived: false },
    orderBy: { createdAt: "desc" },
  });

  const summaries = await Promise.all(
    projects.map(async (p) => ({ project: p, summary: await loadProjectSummary(p.id) }))
  );

  const orgTotals = summaries.reduce(
    (acc, { summary }) => ({
      totalTasks: acc.totalTasks + summary.totalTasks,
      openRoadblocks: acc.openRoadblocks + summary.openRoadblocks,
      healthScores: summary.healthScore !== null ? [...acc.healthScores, summary.healthScore] : acc.healthScores,
    }),
    { totalTasks: 0, openRoadblocks: 0, healthScores: [] as number[] }
  );
  const avgHealthScore =
    orgTotals.healthScores.length > 0
      ? Math.round(orgTotals.healthScores.reduce((a, b) => a + b, 0) / orgTotals.healthScores.length)
      : null;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl mb-1">Executive Dashboard</h1>
      <p className="text-sm text-muted mb-6">Portfolio-wide view across all active projects</p>

      <OrgSubNav active="Executive Dashboard" />

      <div className="mt-8 space-y-6">
        {projects.length === 0 ? (
          <Card className="p-14 text-center">
            <p className="text-sm text-muted">No active projects yet.</p>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <Card className="p-6">
                <p className="text-sm text-muted mb-2">Active Projects</p>
                <p className="font-display text-4xl">{projects.length}</p>
              </Card>
              <Card className="p-6">
                <p className="text-sm text-muted mb-2">Total Tasks</p>
                <p className="font-display text-4xl">{orgTotals.totalTasks}</p>
              </Card>
              <Card className="p-6">
                <p className="text-sm text-muted mb-2">Open Roadblocks</p>
                <p className={`font-display text-4xl ${orgTotals.openRoadblocks > 0 ? "text-error" : ""}`}>
                  {orgTotals.openRoadblocks}
                </p>
              </Card>
              <Card className="p-6">
                <p className="text-sm text-muted mb-2">Avg. Health Score</p>
                <p className={`font-display text-4xl ${healthColor(avgHealthScore)}`}>{avgHealthScore ?? "—"}</p>
              </Card>
            </div>

            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-muted-soft border-b border-hairline-soft bg-surface-soft">
                      <th className="px-4 py-2.5 font-medium">Project</th>
                      <th className="px-4 py-2.5 font-medium text-right">% Complete</th>
                      <th className="px-4 py-2.5 font-medium text-right">PPC</th>
                      <th className="px-4 py-2.5 font-medium text-right">PRR</th>
                      <th className="px-4 py-2.5 font-medium text-right">Variance</th>
                      <th className="px-4 py-2.5 font-medium text-right">Roadblocks</th>
                      <th className="px-4 py-2.5 font-medium text-right">Health Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaries.map(({ project, summary }) => (
                      <tr key={project.id} className="border-b border-hairline-soft last:border-b-0">
                        <td className="px-4 py-3">
                          <Link href={`/projects/${project.id}/dashboard`} className="font-medium text-ink hover:underline">
                            {project.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right text-muted">{summary.percentComplete}%</td>
                        <td className="px-4 py-3 text-right text-muted">{summary.ppc !== null ? `${summary.ppc}%` : "—"}</td>
                        <td className="px-4 py-3 text-right text-muted">{summary.prr !== null ? `${summary.prr}%` : "—"}</td>
                        <td className="px-4 py-3 text-right">
                          {summary.variance === null ? (
                            <span className="text-muted">—</span>
                          ) : summary.variance <= 0 ? (
                            <span className="text-success">{summary.variance === 0 ? "On track" : `${summary.variance}d ahead`}</span>
                          ) : (
                            <span className="text-error">+{summary.variance}d</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={summary.openRoadblocks > 0 ? "text-error font-medium" : "text-muted"}>
                            {summary.openRoadblocks}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${healthColor(summary.healthScore)}`}>
                            {summary.healthScore ?? "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
