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
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card className="p-6">
        <p className="text-sm text-muted mb-2">Total Tasks</p>
        <p className="font-display text-4xl">{totalTasks}</p>
      </Card>
      <Card className="p-6">
        <p className="text-sm text-muted mb-2">% Complete</p>
        <p className="font-display text-4xl">{percentComplete}%</p>
      </Card>
      <Card className="p-6">
        <p className="text-sm text-muted mb-2">Open Roadblocks</p>
        <p className={`font-display text-4xl ${openRoadblocks > 0 ? "text-error" : ""}`}>
          {openRoadblocks}
        </p>
      </Card>
    </div>
  );
}
