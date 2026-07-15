import { Card } from "@/components/ui/Card";

export function DashboardStats({
  totalTasks,
  percentComplete,
  openRoadblocks,
}: {
  totalTasks: number;
  percentComplete: number;
  openRoadblocks: number;
}) {
  if (totalTasks === 0) {
    return (
      <Card className="border-dashed p-10 text-center">
        <p className="text-sm font-semibold text-ink">Project analytics will appear here</p>
        <p className="mt-1 text-xs text-muted">Add schedule activities on the Tasks tab to begin measuring progress.</p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card className="relative overflow-hidden p-5">
        <span className="absolute inset-x-0 top-0 h-0.5 bg-ink" />
        <p className="app-kicker mb-3">Total tasks</p>
        <p className="font-display text-3xl">{totalTasks}</p>
      </Card>
      <Card className="relative overflow-hidden p-5">
        <span className="absolute inset-x-0 top-0 h-0.5 bg-brand-accent" />
        <p className="app-kicker mb-3">Schedule complete</p>
        <p className="font-display text-3xl">{percentComplete}%</p>
        <div className="app-progress mt-4">
          <span style={{ width: `${percentComplete}%` }} />
        </div>
      </Card>
      <Card className="relative overflow-hidden p-5">
        <span className={`absolute inset-x-0 top-0 h-0.5 ${openRoadblocks > 0 ? "bg-error" : "bg-success"}`} />
        <p className="app-kicker mb-3">Open roadblocks</p>
        <p className={`font-display text-3xl ${openRoadblocks > 0 ? "text-error" : "text-success"}`}>
          {openRoadblocks}
        </p>
      </Card>
    </div>
  );
}
