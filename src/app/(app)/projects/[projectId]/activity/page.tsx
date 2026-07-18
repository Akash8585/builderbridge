import Link from "next/link";
import { Download, Eye, History, ShieldAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getProjectPageContext } from "@/lib/project-context";
import { Card } from "@/components/ui/Card";
import { ProjectPageHeader } from "@/components/PageHeader";

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

  const [entries, fileAccessEntries] = await Promise.all([
    prisma.activityLogEntry.findMany({
      where: { projectId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.fileAccessAuditEntry.findMany({
      where: { projectId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);
  const activityItems = [
    ...entries.map((entry) => ({ kind: "PROJECT" as const, entry })),
    ...fileAccessEntries.map((entry) => ({ kind: "FILE" as const, entry })),
  ]
    .sort((left, right) => right.entry.createdAt.getTime() - left.entry.createdAt.getTime())
    .slice(0, 200);

  return (
    <div className="app-page">
      <ProjectPageHeader
        projectId={projectId}
        projectName={project.name}
        title="Activity Log"
        description="A chronological record of project changes, decisions, and file access."
      />

      <section aria-labelledby="recent-activity" className="mt-6">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 id="recent-activity" className="text-sm font-semibold text-ink">
              Recent activity
            </h2>
            <p className="mt-1 text-xs text-muted">
              Project changes, file views, downloads, and denied access in one timeline.
            </p>
          </div>
          <span className="text-xs tabular-nums text-muted-soft">
            {activityItems.length} recent {activityItems.length === 1 ? "event" : "events"}
          </span>
        </div>
        <Card className="p-0">
          {activityItems.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted">No activity recorded yet.</p>
          ) : (
            <ul className="divide-y divide-hairline-soft">
              {activityItems.map((item) => {
                if (item.kind === "PROJECT") {
                  const entry = item.entry;
                  return (
                    <li key={`project:${entry.id}`} className="flex items-start gap-3 px-5 py-4 sm:px-6">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-soft text-muted">
                        <History size={15} aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-body">
                          <span className="font-medium text-ink">{entry.user.name}</span>{" "}
                          {entry.detail ?? entry.action}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                          <span>{formatDateTime(entry.createdAt)}</span>
                          {entry.taskId && entry.taskName && (
                            <Link href={`/projects/${projectId}/tasks/${entry.taskId}`} className="font-medium hover:text-ink">
                              View task: {entry.taskName}
                            </Link>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                }

                const entry = item.entry;
                const actor = entry.userName ?? entry.user?.name ?? "Unauthenticated user";
                const denied = entry.outcome === "DENIED";
                const downloaded = entry.action === "DOWNLOAD";
                const Icon = denied ? ShieldAlert : downloaded ? Download : Eye;
                return (
                  <li key={`file:${entry.id}`} className="flex items-start gap-3 px-5 py-4 sm:px-6">
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${
                        denied
                          ? "border-error/20 bg-error/8 text-error"
                          : "border-hairline bg-surface-soft text-muted"
                      }`}
                    >
                      <Icon size={15} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-body">
                        <span className="font-medium text-ink">{actor}</span>{" "}
                        {denied ? "was denied access to" : downloaded ? "downloaded" : "viewed"}{" "}
                        <span className="font-medium text-ink">{entry.fileName}</span>
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {formatDateTime(entry.createdAt)}
                        {entry.rangeRequested ? " - ranged file request" : ""}
                        {denied && entry.denialReason ? ` - ${entry.denialReason}` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
