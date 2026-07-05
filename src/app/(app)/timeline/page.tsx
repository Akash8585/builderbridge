import { prisma } from "@/lib/prisma";
import { requireActiveOrganization } from "@/lib/session";
import { OrgSubNav } from "@/components/OrgSubNav";
import { PortfolioTimelineChart } from "@/components/PortfolioTimelineChart";
import { loadProjectSummary } from "@/lib/project-summary";

export default async function PortfolioTimelinePage() {
  const { organizationId } = await requireActiveOrganization();

  const projects = await prisma.project.findMany({
    where: { organizationId, isArchived: false },
    orderBy: { startDate: "asc" },
  });

  const timelineProjects = await Promise.all(
    projects.map(async (p) => {
      const summary = await loadProjectSummary(p.id);
      return {
        id: p.id,
        name: p.name,
        startDate: p.startDate,
        endDate: p.endDate,
        percentComplete: summary.percentComplete,
        healthScore: summary.healthScore,
      };
    })
  );

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl mb-1">Project Timeline</h1>
      <p className="text-sm text-muted mb-6">All active projects on one combined timeline</p>

      <OrgSubNav active="Timeline" />

      <div className="mt-8">
        <PortfolioTimelineChart projects={timelineProjects} />
      </div>
    </div>
  );
}
