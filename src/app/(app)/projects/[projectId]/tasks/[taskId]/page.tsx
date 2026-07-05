import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectPageContext } from "@/lib/project-context";
import { StatusBadge } from "@/components/StatusBadge";
import { RoadblockBadge } from "@/components/RoadblockBadge";
import { TaskUpdateFeed } from "@/components/TaskUpdateFeed";
import { Card } from "@/components/ui/Card";
import { formatDate, SUBMITTAL_STATUS_LABELS, RFI_STATUS_LABELS } from "@/lib/utils";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; taskId: string }>;
}) {
  const { projectId, taskId } = await params;
  const { project } = await getProjectPageContext(projectId);

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignedTo: { include: { user: { select: { name: true } } } },
      updates: {
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!task || task.projectId !== projectId) notFound();

  const [submittals, rfis, drawings, sirs] = await Promise.all([
    prisma.submittal.findMany({ where: { taskId }, orderBy: { createdAt: "desc" } }),
    prisma.rFI.findMany({ where: { taskId }, orderBy: { createdAt: "desc" } }),
    prisma.drawing.findMany({ where: { taskId, isSuperseded: false }, orderBy: { createdAt: "desc" } }),
    prisma.scheduleImpactRequest.findMany({ where: { taskId }, orderBy: { createdAt: "desc" } }),
  ]);
  const hasRelatedItems = submittals.length > 0 || rfis.length > 0 || drawings.length > 0 || sirs.length > 0;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <Link href={`/projects/${projectId}`} className="text-sm text-muted hover:text-ink">
        ← Back to {project.name}
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="font-display text-2xl mb-2">{task.name}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <span>{task.assignedTo?.user.name ?? "Unassigned"}</span>
          <span>·</span>
          <span>
            {formatDate(task.startDate)} – {formatDate(task.endDate)}
          </span>
          <span>·</span>
          <StatusBadge status={task.status} />
          {task.isRoadblock && task.roadblockStatus && <RoadblockBadge status={task.roadblockStatus} />}
        </div>
        {task.isRoadblock && task.roadblockNote && (
          <p className="text-sm text-body mt-3 bg-surface-card rounded-md px-3 py-2">{task.roadblockNote}</p>
        )}
      </div>

      {hasRelatedItems && (
        <Card className="p-6 mb-6">
          <h2 className="text-sm font-semibold mb-4">Related Items</h2>
          <div className="space-y-4">
            {submittals.length > 0 && (
              <div>
                <p className="text-xs uppercase text-muted-soft mb-1.5">Submittals</p>
                <ul className="space-y-1">
                  {submittals.map((s) => {
                    const overdue = s.status === "PENDING" && s.dueDate && new Date(s.dueDate) < new Date();
                    return (
                      <li key={s.id} className="text-sm flex items-center gap-2">
                        <Link href={`/projects/${projectId}/submittals`} className="text-ink hover:underline">
                          {s.title}
                        </Link>
                        <span className={`text-xs ${overdue ? "text-error font-medium" : "text-muted"}`}>
                          {SUBMITTAL_STATUS_LABELS[s.status]}
                          {overdue ? " — overdue" : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {rfis.length > 0 && (
              <div>
                <p className="text-xs uppercase text-muted-soft mb-1.5">RFIs</p>
                <ul className="space-y-1">
                  {rfis.map((r) => {
                    const overdue = r.status === "OPEN" && r.dueDate && new Date(r.dueDate) < new Date();
                    return (
                      <li key={r.id} className="text-sm flex items-center gap-2">
                        <Link href={`/projects/${projectId}/rfis`} className="text-ink hover:underline">
                          {r.question}
                        </Link>
                        <span className={`text-xs ${overdue ? "text-error font-medium" : "text-muted"}`}>
                          {RFI_STATUS_LABELS[r.status]}
                          {overdue ? " — overdue" : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {drawings.length > 0 && (
              <div>
                <p className="text-xs uppercase text-muted-soft mb-1.5">Drawings</p>
                <ul className="space-y-1">
                  {drawings.map((d) => (
                    <li key={d.id} className="text-sm">
                      <Link href={`/projects/${projectId}/drawings`} className="text-ink hover:underline">
                        {d.title}
                      </Link>
                      <span className="text-xs text-muted"> rev {d.revision}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {sirs.length > 0 && (
              <div>
                <p className="text-xs uppercase text-muted-soft mb-1.5">Schedule Impact Requests</p>
                <ul className="space-y-1">
                  {sirs.map((sir) => (
                    <li key={sir.id} className="text-sm">
                      <Link href={`/projects/${projectId}/impacts`} className="text-ink hover:underline">
                        {sir.description}
                      </Link>
                      <span className="text-xs text-muted"> · {sir.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card className="p-6">
        <h2 className="text-sm font-semibold mb-4">Field Tracking</h2>
        <TaskUpdateFeed taskId={task.id} updates={task.updates} />
      </Card>
    </div>
  );
}
