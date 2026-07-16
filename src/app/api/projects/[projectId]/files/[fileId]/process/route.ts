import { prisma } from "@/lib/prisma";
import { processProjectDocument } from "@/lib/document-extraction";
import { requireActiveOrganization, requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; fileId: string }> }
) {
  const { projectId, fileId } = await params;
  const user = await requireUser();
  const { organizationId } = await requireActiveOrganization();
  const document = await prisma.assistantAttachment.findFirst({
    where: {
      id: fileId,
      projectId,
      project: {
        organizationId,
        members: { some: { userId: user.id } },
      },
    },
  });
  if (!document) {
    return Response.json({ error: "File not found or unavailable." }, { status: 404 });
  }

  const processed = await processProjectDocument(document);
  return Response.json({
    id: processed.id,
    extractionStatus: processed.extractionStatus,
    extractionError: processed.extractionError,
  });
}
