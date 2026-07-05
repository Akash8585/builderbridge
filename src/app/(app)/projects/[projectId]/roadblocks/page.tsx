import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getProjectPageContext } from "@/lib/project-context";
import { canManageSchedule } from "@/lib/permissions";
import { syncOverdueRfiFlags } from "@/app/actions/rfis";
import { ProjectSubNav } from "@/components/ProjectSubNav";
import { RoadblockLogTable } from "@/components/RoadblockLogTable";
import type { RoadblockStatus } from "@prisma/client";

export default async function ProjectRoadblocksPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { projectId } = await params;
  const { status } = await searchParams;
  const { project, role, user } = await getProjectPageContext(projectId);

  await syncOverdueRfiFlags(projectId);

  const statusFilter: RoadblockStatus | "ALL" =
    status === "RESOLVED" || status === "ALL" ? (status as RoadblockStatus | "ALL") : "OPEN";

  const [tasks, members] = await Promise.all([
    prisma.task.findMany({
      where: {
        projectId,
        isRoadblock: true,
        ...(statusFilter === "ALL" ? {} : { roadblockStatus: statusFilter }),
      },
      include: { assignedTo: { select: { userId: true } } },
      orderBy: { roadblockDueDate: "asc" },
    }),
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { name: true } } },
    }),
  ]);

  const memberNameByUserId = new Map(members.map((m) => [m.userId, m.user.name]));
  const roadblocks = tasks.map((t) => ({
    id: t.id,
    name: t.name,
    roadblockNote: t.roadblockNote,
    roadblockStatus: t.roadblockStatus,
    roadblockType: t.roadblockType,
    roadblockOwnerId: t.roadblockOwnerId,
    roadblockDueDate: t.roadblockDueDate,
    raisedByName: (t.roadblockRaisedBy && memberNameByUserId.get(t.roadblockRaisedBy)) || "Unknown",
    assignedToUserId: t.assignedTo?.userId ?? null,
  }));

  const memberOptions = members.map((m) => ({ id: m.id, name: m.user.name }));

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl mb-1">{project.name}</h1>
      <p className="text-sm text-muted mb-6">Roadblocks</p>

      <ProjectSubNav projectId={projectId} active="Roadblocks" />

      <div className="mt-8 space-y-4">
        <div className="inline-flex items-center gap-1 rounded-pill bg-surface-soft p-1.5">
          {(["OPEN", "RESOLVED", "ALL"] as const).map((s) => (
            <Link
              key={s}
              href={`/projects/${projectId}/roadblocks?status=${s}`}
              className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusFilter === s ? "bg-canvas text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {s === "OPEN" ? "Open" : s === "RESOLVED" ? "Resolved" : "All"}
            </Link>
          ))}
        </div>

        <div className="overflow-x-auto">
          <RoadblockLogTable
            roadblocks={roadblocks}
            members={memberOptions}
            canManage={canManageSchedule(role)}
            currentUserId={user.id}
          />
        </div>
      </div>
    </div>
  );
}
