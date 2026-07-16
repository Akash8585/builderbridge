import { prisma } from "@/lib/prisma";
import {
  getAssistantProposalId,
  hydrateAssistantActionPart,
  loadAssistantProposalStates,
} from "@/lib/assistant-actions";
import { requireAssistantConversation } from "@/lib/assistant-conversations";
import { deleteStoredFile } from "@/lib/storage";
import { requireActiveOrganization, requireUser } from "@/lib/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  const user = await requireUser();
  const { organizationId } = await requireActiveOrganization();
  const conversation = await requireAssistantConversation(conversationId, user.id, organizationId);
  const messages = await prisma.assistantMessage.findMany({
    where: { conversationId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const proposalIds = messages.flatMap((message) =>
    Array.isArray(message.parts)
      ? message.parts.map(getAssistantProposalId).filter((id): id is string => id !== null)
      : []
  );
  const proposalStates = await loadAssistantProposalStates(proposalIds, conversationId);

  return Response.json({
    conversation: {
      id: conversation.id,
      title: conversation.title,
      projectId: conversation.projectId,
      updatedAt: conversation.updatedAt.toISOString(),
      messageCount: conversation._count.messages,
    },
    messages: messages.map((message) => ({
      id: message.id,
      role: message.role === "USER" ? "user" : "assistant",
      parts: Array.isArray(message.parts)
        ? message.parts.map((part) => hydrateAssistantActionPart(part, proposalStates))
        : [{ type: "text", text: message.content }],
    })),
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  const user = await requireUser();
  const { organizationId } = await requireActiveOrganization();
  await requireAssistantConversation(conversationId, user.id, organizationId);
  const pendingAttachments = await prisma.assistantAttachment.findMany({
    where: { conversationId, messageId: null },
    select: { storageKey: true },
  });
  await prisma.assistantAttachment.deleteMany({
    where: { conversationId, messageId: null },
  });
  await prisma.assistantConversation.delete({ where: { id: conversationId } });
  await Promise.allSettled(
    pendingAttachments.map((attachment) => deleteStoredFile(attachment.storageKey))
  );
  return new Response(null, { status: 204 });
}
