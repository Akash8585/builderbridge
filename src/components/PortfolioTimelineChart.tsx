import Link from "next/link";
import { daysBetween, formatDate } from "@/lib/utils";

export type PortfolioTimelineProject = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  percentComplete: number;
  healthScore: number | null;
};

function barColor(healthScore: number | null): string {
  if (healthScore === null) return "bg-surface-strong";
  if (healthScore >= 80) return "bg-success";
  if (healthScore >= 50) return "bg-brand-accent";
  return "bg-error";
}

export function PortfolioTimelineChart({ projects }: { projects: PortfolioTimelineProject[] }) {
  if (projects.length === 0) {
    return <p className="text-sm text-muted py-8 text-center">No active projects to display yet.</p>;
  }

  const rangeStart = new Date(Math.min(...projects.map((p) => p.startDate.getTime())));
  const rangeEnd = new Date(Math.max(...projects.map((p) => p.endDate.getTime())));
  const totalDays = Math.max(daysBetween(rangeStart, rangeEnd), 1);
  const today = new Date();
  const todayOffsetPct = Math.min(100, Math.max(0, (daysBetween(rangeStart, today) / totalDays) * 100));
  const showTodayMarker = today >= rangeStart && today <= rangeEnd;

  return (
    <div className="border border-hairline rounded-lg overflow-hidden">
      <div className="flex border-b border-hairline bg-surface-soft text-xs text-muted">
        <div className="w-56 shrink-0 px-3 py-2 font-medium">Project</div>
        <div className="flex-1 px-3 py-2 flex justify-between font-medium">
          <span>{formatDate(rangeStart)}</span>
          <span>{formatDate(rangeEnd)}</span>
        </div>
      </div>
      <div className="relative">
        {showTodayMarker && (
          <div
            className="absolute top-0 bottom-0 w-px bg-error/60 z-10"
            style={{ left: `calc(14rem + ${todayOffsetPct}% * (100% - 14rem) / 100)` }}
            title={`Today: ${formatDate(today)}`}
          />
        )}
        {projects.map((project) => {
          const offsetDays = Math.max(daysBetween(rangeStart, project.startDate), 0);
          const durationDays = Math.max(daysBetween(project.startDate, project.endDate), 1);
          const leftPct = (offsetDays / totalDays) * 100;
          const widthPct = Math.min((durationDays / totalDays) * 100, 100 - leftPct);

          return (
            <div key={project.id} className="flex items-center border-b border-hairline-soft last:border-b-0">
              <div className="w-56 shrink-0 px-3 py-3 text-sm">
                <Link href={`/projects/${project.id}/dashboard`} className="font-medium text-ink hover:underline truncate block">
                  {project.name}
                </Link>
                <div className="text-xs text-muted">{project.percentComplete}% complete</div>
              </div>
              <div className="flex-1 relative h-10 px-3">
                <div className="absolute inset-y-0 my-auto h-6" style={{ left: `${leftPct}%`, width: `${widthPct}%` }}>
                  <div
                    className={`h-full rounded-md ${barColor(project.healthScore)} flex items-center px-2 min-w-[2px]`}
                    title={`${formatDate(project.startDate)} – ${formatDate(project.endDate)}${
                      project.healthScore !== null ? ` · Health ${project.healthScore}` : ""
                    }`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 px-3 py-2 text-xs text-muted bg-surface-soft">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-success" /> Healthy
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-brand-accent" /> At risk
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-error" /> Struggling
        </span>
        {showTodayMarker && (
          <span className="flex items-center gap-1.5 ml-auto">
            <span className="inline-block h-2 w-0.5 bg-error/60" /> Today
          </span>
        )}
      </div>
    </div>
  );
}
