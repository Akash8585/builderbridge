import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireActiveOrganization } from "@/lib/session";
import { Card } from "@/components/ui/Card";
import { formatDate, percentComplete } from "@/lib/utils";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const { organizationId } = await requireActiveOrganization();
  const { archived } = await searchParams;
  const showArchived = archived === "true";

  const projects = await prisma.project.findMany({
    where: { organizationId, isArchived: showArchived },
    include: { tasks: { select: { status: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl mb-1">Projects</h1>
          <p className="text-sm text-muted">
            {showArchived ? "Archived projects" : "Active projects in your organization"}
          </p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-on-primary hover:bg-primary-active transition-colors"
        >
          + New Project
        </Link>
      </div>

      <div className="inline-flex items-center gap-1 rounded-pill bg-surface-soft p-1.5 mb-6">
        <Link
          href="/projects"
          className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
            !showArchived ? "bg-canvas text-ink shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          Active
        </Link>
        <Link
          href="/projects?archived=true"
          className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
            showArchived ? "bg-canvas text-ink shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          Archived
        </Link>
      </div>

      {projects.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-muted">
            {showArchived ? "No archived projects." : "No projects yet. Create your first one."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((project) => {
            const total = project.tasks.length;
            const done = project.tasks.filter((t) => t.status === "DONE").length;
            return (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="p-5 hover:border-ink transition-colors h-full">
                  <h2 className="font-semibold text-ink mb-1">{project.name}</h2>
                  <p className="text-sm text-muted mb-3">
                    {formatDate(project.startDate)} – {formatDate(project.endDate)}
                  </p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">{total} tasks</span>
                    <span className="font-medium text-ink">{percentComplete(total, done)}% complete</span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
