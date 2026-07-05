import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getProjectPageContext } from "@/lib/project-context";
import { canManageSchedule } from "@/lib/permissions";
import { syncOverdueRfiFlags } from "@/app/actions/rfis";
import { ProjectSubNav } from "@/components/ProjectSubNav";
import { RfiList } from "@/components/RfiList";
import type { RfiStatus } from "@prisma/client";

export default async function ProjectRfisPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { projectId } = await params;
  const { status } = await searchParams;
  const { project, role } = await getProjectPageContext(projectId);

  await syncOverdueRfiFlags(projectId);

  const validStatuses: (RfiStatus | "ALL")[] = ["OPEN", "ANSWERED", "CLOSED", "ALL"];
  const statusFilter = validStatuses.includes(status as never) ? (status as RfiStatus | "ALL") : "OPEN";

  const [rfis, tasks] = await Promise.all([
    prisma.rFI.findMany({
      where: { projectId, ...(statusFilter === "ALL" ? {} : { status: statusFilter }) },
      include: {
        raisedBy: { include: { user: { select: { name: true } } } },
        task: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.task.findMany({ where: { projectId }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl mb-1">{project.name}</h1>
      <p className="text-sm text-muted mb-6">RFIs (Requests for Information)</p>

      <ProjectSubNav projectId={projectId} active="RFIs" />

      <div className="mt-8 space-y-4">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-pill bg-surface-soft p-1.5">
          {(["OPEN", "ANSWERED", "CLOSED", "ALL"] as const).map((s) => (
            <Link
              key={s}
              href={`/projects/${projectId}/rfis?status=${s}`}
              className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusFilter === s ? "bg-canvas text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </Link>
          ))}
        </div>

        <RfiList projectId={projectId} rfis={rfis} tasks={tasks} canAnswer={canManageSchedule(role)} />
      </div>
    </div>
  );
}
