import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getProjectPageContext } from "@/lib/project-context";
import { canManageSchedule } from "@/lib/permissions";
import { ProjectSubNav } from "@/components/ProjectSubNav";
import { SubmittalList } from "@/components/SubmittalList";
import type { SubmittalStatus } from "@prisma/client";

export default async function ProjectSubmittalsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { projectId } = await params;
  const { status } = await searchParams;
  const { project, role } = await getProjectPageContext(projectId);

  const validStatuses: (SubmittalStatus | "ALL")[] = ["PENDING", "APPROVED", "REJECTED", "REVISE_RESUBMIT", "ALL"];
  const statusFilter = validStatuses.includes(status as never) ? (status as SubmittalStatus | "ALL") : "ALL";

  const [submittals, tasks] = await Promise.all([
    prisma.submittal.findMany({
      where: { projectId, ...(statusFilter === "ALL" ? {} : { status: statusFilter }) },
      include: {
        submittedBy: { include: { user: { select: { name: true } } } },
        task: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.task.findMany({ where: { projectId }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl mb-1">{project.name}</h1>
      <p className="text-sm text-muted mb-6">Submittals Log</p>

      <ProjectSubNav projectId={projectId} active="Submittals" />

      <div className="mt-8 space-y-4">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-pill bg-surface-soft p-1.5">
          {(["ALL", "PENDING", "APPROVED", "REJECTED", "REVISE_RESUBMIT"] as const).map((s) => (
            <Link
              key={s}
              href={`/projects/${projectId}/submittals?status=${s}`}
              className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusFilter === s ? "bg-canvas text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {s === "ALL" ? "All" : s === "REVISE_RESUBMIT" ? "Revise" : s.charAt(0) + s.slice(1).toLowerCase()}
            </Link>
          ))}
        </div>

        <SubmittalList projectId={projectId} submittals={submittals} tasks={tasks} canDecide={canManageSchedule(role)} />
      </div>
    </div>
  );
}
