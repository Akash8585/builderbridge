import { prisma } from "@/lib/prisma";
import { getProjectPageContext } from "@/lib/project-context";
import { isProjectManager, canManageSchedule } from "@/lib/permissions";
import { TaskTable } from "@/components/TaskTable";
import { TaskForm } from "@/components/TaskForm";
import { ArchiveProjectButton } from "@/components/ArchiveProjectButton";
import { formatDate } from "@/lib/utils";
import { ProjectPageHeader } from "@/components/PageHeader";

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

  const canManage = canManageSchedule(role);
  const memberOptions = members.map((m) => ({
    id: m.id,
    userId: m.userId,
    name: m.user.name,
    role: m.role,
  }));

  return (
    <div className="app-page">
      <ProjectPageHeader
        projectId={projectId}
        projectName={project.name}
        title="Master Schedule"
        description={`${formatDate(project.startDate)} - ${formatDate(project.endDate)} · Manage activities, ownership, dates, and live field status.`}
        actions={
          isProjectManager(role) ? (
            <ArchiveProjectButton projectId={project.id} isArchived={project.isArchived} />
          ) : undefined
        }
      />

      <div className="mt-6 space-y-4">
        {canManage && (
          <div className="app-toolbar">
            <div>
              <p className="app-section-title">Schedule activities</p>
              <p className="app-section-description">{tasks.length} tasks in the current master schedule</p>
            </div>
            <TaskForm projectId={projectId} members={memberOptions} />
          </div>
        )}

        <div className="overflow-x-auto">
          <TaskTable tasks={tasks} members={memberOptions} currentUserId={user.id} role={role} projectId={projectId} />
        </div>
      </div>
    </div>
  );
}
