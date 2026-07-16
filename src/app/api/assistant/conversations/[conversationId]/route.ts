import { prisma } from "@/lib/prisma";
import { requireAssistantConversation } from "@/lib/assistant-conversations";
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
      parts: [{ type: "text", text: message.content }],
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
  await prisma.assistantConversation.delete({ where: { id: conversationId } });
  return new Response(null, { status: 204 });
}
