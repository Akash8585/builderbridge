import { getProjectPageContext } from "@/lib/project-context";
import { env } from "@/lib/env";
import { ProjectSubNav } from "@/components/ProjectSubNav";
import { ScheduleAssistantPanel } from "@/components/ScheduleAssistantPanel";
import { Card } from "@/components/ui/Card";

export default async function ProjectAssistantPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { project } = await getProjectPageContext(projectId);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl mb-1">{project.name}</h1>
      <p className="text-sm text-muted mb-6">Schedule Assistant</p>

      <ProjectSubNav projectId={projectId} active="Assistant" />

      <div className="mt-8">
        {env.OPENROUTER_API_KEY ? (
          <Card className="p-6">
            <ScheduleAssistantPanel projectId={projectId} />
          </Card>
        ) : (
          <Card className="p-10 text-center">
            <p className="text-sm text-muted">
              The Schedule Assistant isn&apos;t configured yet. Add an <code>OPENROUTER_API_KEY</code> to the
              environment to enable it.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
