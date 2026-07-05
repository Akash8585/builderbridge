import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getProjectPageContext } from "@/lib/project-context";
import { ProjectSubNav } from "@/components/ProjectSubNav";
import { TaskTable } from "@/components/TaskTable";
import { formatDate } from "@/lib/utils";

const WINDOW_OPTIONS = [2, 4, 6] as const;
const DEFAULT_WINDOW_WEEKS = 4;

export default async function ProjectLookaheadPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ weeks?: string }>;
}) {
  const { projectId } = await params;
  const { weeks } = await searchParams;
  const { project, role, user } = await getProjectPageContext(projectId);

  const windowWeeks = WINDOW_OPTIONS.includes(Number(weeks) as (typeof WINDOW_OPTIONS)[number])
    ? Number(weeks)
    : DEFAULT_WINDOW_WEEKS;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const windowEnd = new Date(today);
  windowEnd.setDate(windowEnd.getDate() + windowWeeks * 7);

  const [tasks, members] = await Promise.all([
    prisma.task.findMany({
      where: {
        projectId,
        startDate: { lte: windowEnd },
        endDate: { gte: today },
      },
      include: { assignedTo: { include: { user: { select: { name: true } } } } },
      orderBy: { startDate: "asc" },
    }),
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { name: true } } },
    }),
  ]);

  const memberOptions = members.map((m) => ({
    id: m.id,
    userId: m.userId,
    name: m.user.name,
    role: m.role,
  }));

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl mb-1">{project.name}</h1>
      <p className="text-sm text-muted mb-6">Lookahead</p>

      <ProjectSubNav projectId={projectId} active="Lookahead" />

      <div className="mt-8 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">
            {formatDate(today)} – {formatDate(windowEnd)}
          </p>
          <div className="inline-flex items-center gap-1 rounded-pill bg-surface-soft p-1.5">
            {WINDOW_OPTIONS.map((w) => (
              <Link
                key={w}
                href={`/projects/${projectId}/lookahead?weeks=${w}`}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  w === windowWeeks ? "bg-canvas text-ink shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                {w}-week
              </Link>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <TaskTable tasks={tasks} members={memberOptions} currentUserId={user.id} role={role} projectId={projectId} />
        </div>
      </div>
    </div>
  );
}
