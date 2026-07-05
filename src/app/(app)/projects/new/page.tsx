import { requireActiveOrganization } from "@/lib/session";
import { ProjectForm } from "@/components/ProjectForm";
import { Card } from "@/components/ui/Card";

export default async function NewProjectPage() {
  const { organizationId } = await requireActiveOrganization();

  return (
    <div className="max-w-lg mx-auto px-6 py-10">
      <h1 className="font-display text-2xl mb-1">New project</h1>
      <p className="text-sm text-muted mb-6">You&apos;ll become the GC/Owner of this project.</p>
      <Card className="p-6">
        <ProjectForm organizationId={organizationId} />
      </Card>
    </div>
  );
}
