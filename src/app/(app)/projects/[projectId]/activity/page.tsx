import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getProjectPageContext } from "@/lib/project-context";
import { ProjectSubNav } from "@/components/ProjectSubNav";
import { Card } from "@/components/ui/Card";

function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function ProjectActivityPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { project } = await getProjectPageContext(projectId);

  const entries = await prisma.activityLogEntry.findMany({
    where: { projectId },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl mb-1">{project.name}</h1>
      <p className="text-sm text-muted mb-6">Activity Log</p>

      <ProjectSubNav projectId={projectId} active="Activity" />

      <div className="mt-8">
        <Card className="p-6">
          {entries.length === 0 ? (
            <p className="text-sm text-muted text-center py-6">No activity recorded yet.</p>
          ) : (
            <ul className="space-y-4">
              {entries.map((entry) => (
                <li key={entry.id} className="border-b border-hairline-soft pb-3 last:border-b-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-ink">{entry.user.name}</span>
                    <span className="text-xs text-muted-soft">{formatDateTime(entry.createdAt)}</span>
                  </div>
                  <p className="text-sm text-body">{entry.detail ?? entry.action}</p>
                  {entry.taskId && entry.taskName && (
                    <Link
                      href={`/projects/${projectId}/tasks/${entry.taskId}`}
                      className="text-xs text-muted hover:underline"
                    >
                      View task: {entry.taskName}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
