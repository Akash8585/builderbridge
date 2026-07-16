import { prisma } from "@/lib/prisma";
import { deleteStoredFile } from "@/lib/storage";
import { requireActiveOrganization, requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  const { attachmentId } = await params;
  const user = await requireUser();
  const { organizationId } = await requireActiveOrganization();
  const attachment = await prisma.assistantAttachment.findFirst({
    where: {
      id: attachmentId,
      uploadedById: user.id,
      messageId: null,
      conversation: { organizationId, createdById: user.id },
    },
    select: { id: true, storageKey: true },
  });

  if (!attachment) {
    return Response.json({ error: "Attachment not found." }, { status: 404 });
  }

  await deleteStoredFile(attachment.storageKey).catch(() => undefined);
  await prisma.assistantAttachment.delete({ where: { id: attachment.id } });
  return new Response(null, { status: 204 });
}
