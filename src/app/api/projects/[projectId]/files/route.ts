import { prisma } from "@/lib/prisma";
import {
  isAllowedAssistantAttachmentType,
  MAX_ASSISTANT_ATTACHMENT_BYTES,
} from "@/lib/assistant-attachments";
import { processProjectDocument } from "@/lib/document-extraction";
import { buildStorageKey, deleteStoredFile, uploadFile } from "@/lib/storage";
import { requireActiveOrganization, requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Choose a file to upload." }, { status: 400 });
  }
  if (file.size > MAX_ASSISTANT_ATTACHMENT_BYTES) {
    return Response.json({ error: "Project files must be under 20 MB." }, { status: 413 });
  }
  if (!isAllowedAssistantAttachmentType(file.type)) {
    return Response.json(
      { error: "Only PDF, PNG, JPEG, and WebP files are supported." },
      { status: 415 }
    );
  }

  const user = await requireUser();
  const { organizationId } = await requireActiveOrganization();
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      organizationId,
      members: { some: { userId: user.id } },
    },
    select: { id: true },
  });
  if (!project) {
    return Response.json({ error: "Project not found or unavailable." }, { status: 404 });
  }

  const fileName = file.name.trim().slice(0, 255) || "project-file";
  const storageKey = buildStorageKey(`documents/${projectId}/files`, fileName);
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const fileUrl = await uploadFile(storageKey, bytes, file.type);
    try {
      const document = await prisma.assistantAttachment.create({
        data: {
          projectId,
          uploadedById: user.id,
          fileName,
          mediaType: file.type,
          sizeBytes: file.size,
          storageKey,
          fileUrl,
          source: "DIRECT_UPLOAD",
          extractionStatus: "PENDING",
        },
      });
      const processed = await processProjectDocument(document, bytes);
      return Response.json(
        {
          id: processed.id,
          fileName: processed.fileName,
          mediaType: processed.mediaType,
          sizeBytes: processed.sizeBytes,
          url: processed.fileUrl,
          extractionStatus: processed.extractionStatus,
          extractionError: processed.extractionError,
        },
        { status: 201 }
      );
    } catch (error) {
      await deleteStoredFile(storageKey).catch(() => undefined);
      throw error;
    }
  } catch {
    return Response.json({ error: "The project file could not be uploaded." }, { status: 500 });
  }
}
