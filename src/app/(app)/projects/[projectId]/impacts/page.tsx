import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getProjectPageContext } from "@/lib/project-context";
import { canResolveRoadblocks } from "@/lib/permissions";
import { ProjectSubNav } from "@/components/ProjectSubNav";
import { ScheduleImpactList } from "@/components/ScheduleImpactList";
import type { SirStatus } from "@prisma/client";

export default async function ProjectImpactsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { projectId } = await params;
  const { status } = await searchParams;
  const { project, role } = await getProjectPageContext(projectId);

  const statusFilter: SirStatus | "ALL" =
    status === "APPROVED" || status === "REJECTED" || status === "ALL" ? (status as SirStatus | "ALL") : "PENDING";

  const [sirs, tasks] = await Promise.all([
    prisma.scheduleImpactRequest.findMany({
      where: { projectId, ...(statusFilter === "ALL" ? {} : { status: statusFilter }) },
      include: {
        submittedBy: { include: { user: { select: { name: true } } } },
        reviewedBy: { include: { user: { select: { name: true } } } },
        task: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.task.findMany({ where: { projectId }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl mb-1">{project.name}</h1>
      <p className="text-sm text-muted mb-6">Schedule Impact Requests</p>

      <ProjectSubNav projectId={projectId} active="Impacts" />

      <div className="mt-8 space-y-4">
        <div className="inline-flex items-center gap-1 rounded-pill bg-surface-soft p-1.5">
          {(["PENDING", "APPROVED", "REJECTED", "ALL"] as const).map((s) => (
            <Link
              key={s}
              href={`/projects/${projectId}/impacts?status=${s}`}
              className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusFilter === s ? "bg-canvas text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {s === "PENDING" ? "Pending" : s === "APPROVED" ? "Approved" : s === "REJECTED" ? "Rejected" : "All"}
            </Link>
          ))}
        </div>

        <ScheduleImpactList projectId={projectId} sirs={sirs} tasks={tasks} canReview={canResolveRoadblocks(role)} />
      </div>
    </div>
  );
}
