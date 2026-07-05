import { prisma } from "@/lib/prisma";
import { getProjectPageContext } from "@/lib/project-context";
import { ProjectSubNav } from "@/components/ProjectSubNav";
import { TaskTable } from "@/components/TaskTable";
import { TaskForm } from "@/components/TaskForm";
import { ArchiveProjectButton } from "@/components/ArchiveProjectButton";
import { formatDate } from "@/lib/utils";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { project, role, user } = await getProjectPageContext(projectId);

  const [tasks, members] = await Promise.all([
    prisma.task.findMany({
      where: { projectId },
      include: { assignedTo: { include: { user: { select: { name: true } } } } },
      orderBy: { startDate: "asc" },
    }),
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { name: true } } },
    }),
  ]);

  const isOwner = role === "GC_OWNER";
  const memberOptions = members.map((m) => ({
    id: m.id,
    userId: m.userId,
    name: m.user.name,
    role: m.role,
  }));

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-start justify-between mb-1">
        <h1 className="font-display text-2xl">{project.name}</h1>
        {isOwner && <ArchiveProjectButton projectId={project.id} isArchived={project.isArchived} />}
      </div>
      <p className="text-sm text-muted mb-6">
        {formatDate(project.startDate)} – {formatDate(project.endDate)}
      </p>

      <ProjectSubNav projectId={projectId} active="Tasks" />

      <div className="mt-8 space-y-6">
        {isOwner && <TaskForm projectId={projectId} members={memberOptions} />}

        <div className="overflow-x-auto">
          <TaskTable tasks={tasks} members={memberOptions} currentUserId={user.id} isOwner={isOwner} />
        </div>
      </div>
    </div>
  );
}
