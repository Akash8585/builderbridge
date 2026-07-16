import { prisma } from "@/lib/prisma";
import {
  isAllowedAssistantAttachmentType,
  MAX_ASSISTANT_ATTACHMENT_BYTES,
  MAX_ASSISTANT_ATTACHMENTS,
} from "@/lib/assistant-attachments";
import { requireAssistantConversation } from "@/lib/assistant-conversations";
import { processProjectDocument } from "@/lib/document-extraction";
import { buildStorageKey, deleteStoredFile, uploadFile } from "@/lib/storage";
import { requireActiveOrganization, requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const conversationId = formData?.get("conversationId");
  const file = formData?.get("file");

  if (typeof conversationId !== "string" || !(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Choose a file to attach." }, { status: 400 });
  }
  if (file.size > MAX_ASSISTANT_ATTACHMENT_BYTES) {
    return Response.json({ error: "Attachments must be under 20 MB." }, { status: 413 });
  }
  if (!isAllowedAssistantAttachmentType(file.type)) {
    return Response.json(
      { error: "Only PDF, PNG, JPEG, and WebP attachments are supported." },
      { status: 415 }
    );
  }

  const user = await requireUser();
  const { organizationId } = await requireActiveOrganization();
  const conversation = await requireAssistantConversation(conversationId, user.id, organizationId);
  if (!conversation.projectId) {
    return Response.json(
      { error: "Choose a project conversation before attaching files." },
      { status: 400 }
    );
  }

  const pendingCount = await prisma.assistantAttachment.count({
    where: { conversationId, uploadedById: user.id, messageId: null },
  });
  if (pendingCount >= MAX_ASSISTANT_ATTACHMENTS * 2) {
    return Response.json(
      { error: "Remove an unused attachment before uploading another." },
      { status: 409 }
    );
  }

  const fileName = file.name.trim().slice(0, 255) || "attachment";
  const storageKey = buildStorageKey(
    `documents/${conversation.projectId}/assistant/${conversation.id}`,
    fileName
  );

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const fileUrl = await uploadFile(storageKey, bytes, file.type);
    try {
      const attachment = await prisma.assistantAttachment.create({
        data: {
          conversationId: conversation.id,
          projectId: conversation.projectId,
          uploadedById: user.id,
          fileName,
          mediaType: file.type,
          sizeBytes: file.size,
          storageKey,
          fileUrl,
        },
      });
      const processed = await processProjectDocument(attachment, bytes);
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
    return Response.json({ error: "The attachment could not be uploaded." }, { status: 500 });
  }
}
