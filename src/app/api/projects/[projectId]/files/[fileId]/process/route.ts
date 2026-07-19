import { prisma } from "@/lib/prisma";
import { processProjectDocument } from "@/lib/document-extraction";
import { getProjectRole } from "@/lib/permissions";
import { requireActiveOrganization, requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; fileId: string }> }
) {
  const { projectId, fileId } = await params;
  const user = await requireUser();
  const { organizationId } = await requireActiveOrganization();
  const role = await getProjectRole(user.id, projectId);
  if (!role) {
    return Response.json({ error: "File not found or unavailable." }, { status: 404 });
  }
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
  if (document.uploadedById !== user.id && role !== "PROJECT_MANAGER") {
    return Response.json(
      { error: "Only the uploader or a Project Manager can reprocess this file." },
      { status: 403 }
    );
  }

  const processed = await processProjectDocument(document);
  return Response.json({
    id: processed.id,
    extractionStatus: processed.extractionStatus,
    extractionError: processed.extractionError,
  });
}
