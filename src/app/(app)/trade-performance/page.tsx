import { prisma } from "@/lib/prisma";
import { requireActiveOrganization } from "@/lib/session";
import { OrgSubNav } from "@/components/OrgSubNav";
import { Card } from "@/components/ui/Card";
import { PROJECT_ROLE_LABELS } from "@/lib/utils";

export default async function TradePerformancePage() {
  const { organizationId } = await requireActiveOrganization();

  const commitments = await prisma.weeklyCommitment.findMany({
    where: { task: { project: { organizationId, isArchived: false } } },
    include: {
      committedBy: { include: { user: { select: { id: true, name: true } } } },
      task: { select: { projectId: true } },
    },
  });

  type Row = {
    userId: string;
    name: string;
    total: number;
    completed: number;
    notCompleted: number;
    projectIds: Set<string>;
    roles: Set<string>;
  };

  const byUser = new Map<string, Row>();
  for (const c of commitments) {
    const userId = c.committedBy.user.id;
    const row = byUser.get(userId) ?? {
      userId,
      name: c.committedBy.user.name,
      total: 0,
      completed: 0,
      notCompleted: 0,
      projectIds: new Set<string>(),
      roles: new Set<string>(),
    };
    row.total += 1;
    if (c.status === "COMPLETED") row.completed += 1;
    if (c.status === "NOT_COMPLETED") row.notCompleted += 1;
    row.projectIds.add(c.task.projectId);
    row.roles.add(c.committedBy.role);
    byUser.set(userId, row);
  }

  const rows = [...byUser.values()]
    .map((r) => ({
      ...r,
      prr: r.total === 0 ? 0 : Math.round((r.completed / r.total) * 100),
      projectCount: r.projectIds.size,
      roleLabel: [...r.roles].map((role) => PROJECT_ROLE_LABELS[role as keyof typeof PROJECT_ROLE_LABELS]).join(", "),
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl mb-1">Trade Performance</h1>
      <p className="text-sm text-muted mb-6">Commitment reliability per person, across all active projects</p>

      <OrgSubNav active="Trade Performance" />

      <div className="mt-8">
        {rows.length === 0 ? (
          <Card className="p-14 text-center">
            <p className="text-sm text-muted">
              No commitments recorded yet — this fills in once trades commit to tasks on each project&apos;s Weekly
              Plan.
            </p>
          </Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-soft border-b border-hairline-soft bg-surface-soft">
                  <th className="px-4 py-2.5 font-medium">Member</th>
                  <th className="px-4 py-2.5 font-medium">Role(s)</th>
                  <th className="px-4 py-2.5 font-medium text-right">Projects</th>
                  <th className="px-4 py-2.5 font-medium text-right">Commitments</th>
                  <th className="px-4 py-2.5 font-medium text-right">PRR</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.userId} className="border-b border-hairline-soft last:border-b-0">
                    <td className="px-4 py-3 font-medium text-ink">{row.name}</td>
                    <td className="px-4 py-3 text-muted">{row.roleLabel}</td>
                    <td className="px-4 py-3 text-right text-muted">{row.projectCount}</td>
                    <td className="px-4 py-3 text-right text-muted">
                      {row.completed}/{row.total}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={row.prr >= 80 ? "text-success" : row.prr >= 50 ? "text-ink" : "text-error"}>
                        {row.prr}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
