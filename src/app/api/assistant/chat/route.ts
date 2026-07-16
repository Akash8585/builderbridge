import { randomUUID } from "node:crypto";
import { createUIMessageStreamResponse, safeValidateUIMessages, streamText, toUIMessageStream } from "ai";
import type { UIMessage } from "ai";
import { z } from "zod";
import { ASSISTANT_SYSTEM_PROMPT, buildAssistantContext } from "@/lib/ai-assistant";
import { makeConversationTitle, requireAssistantConversation } from "@/lib/assistant-conversations";
import { env } from "@/lib/env";
import { getOpenRouterModel } from "@/lib/openrouter";
import { prisma } from "@/lib/prisma";
import { requireActiveOrganization, requireUser } from "@/lib/session";

const requestSchema = z.object({
  conversationId: z.string().min(1),
  messages: z.array(z.unknown()).min(1).max(100),
});

function messageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is Extract<(typeof message.parts)[number], { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function streamErrorMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message.toLowerCase() : "";
  if (detail.includes("429") || detail.includes("rate limit")) {
    return "OpenRouter's free models are busy right now. Please wait a moment and try again.";
  }
  return "OpenRouter could not complete this response. Please try again.";
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid chat request." }, { status: 400 });
  }

  const validated = await safeValidateUIMessages({ messages: parsed.data.messages });
  if (!validated.success) {
    return Response.json({ error: "Invalid message format." }, { status: 400 });
  }

  const latestMessage = validated.data.at(-1);
  const question = latestMessage?.role === "user" ? messageText(latestMessage) : "";
  if (!latestMessage || !question || question.length > 4000) {
    return Response.json({ error: "Enter a message under 4,000 characters." }, { status: 400 });
  }

  const user = await requireUser();
  const { organizationId } = await requireActiveOrganization();
  const conversation = await requireAssistantConversation(parsed.data.conversationId, user.id, organizationId);
  const existingMessage = await prisma.assistantMessage.findUnique({ where: { id: latestMessage.id } });

  if (existingMessage && existingMessage.conversationId !== conversation.id) {
    return Response.json({ error: "Message already belongs to another conversation." }, { status: 409 });
  }

  if (!existingMessage) {
    await prisma.$transaction([
      prisma.assistantMessage.create({
        data: {
          id: latestMessage.id,
          conversationId: conversation.id,
          role: "USER",
          content: question,
        },
      }),
      prisma.assistantConversation.update({
        where: { id: conversation.id },
        data: {
          title: conversation._count.messages === 0 ? makeConversationTitle(question) : conversation.title,
          updatedAt: new Date(),
        },
      }),
    ]);
  }

  const recentMessages = await prisma.assistantMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  recentMessages.reverse();

  const context = await buildAssistantContext(organizationId, conversation.projectId ?? undefined);
  const assistantMessageId = randomUUID();
  const result = streamText({
    model: getOpenRouterModel(),
    system: ASSISTANT_SYSTEM_PROMPT + context,
    messages: recentMessages.map((message) => ({
      role: message.role === "USER" ? ("user" as const) : ("assistant" as const),
      content: message.content,
    })),
    temperature: 0.3,
    maxOutputTokens: 1000,
    abortSignal: request.signal,
  });

  const stream = toUIMessageStream({
    stream: result.stream,
    originalMessages: validated.data,
    generateMessageId: () => assistantMessageId,
    sendReasoning: false,
    onError: streamErrorMessage,
    onEnd: async ({ responseMessage, isAborted }) => {
      const content = messageText(responseMessage).trim();
      if (isAborted || !content) return;
      await prisma.$transaction([
        prisma.assistantMessage.upsert({
          where: { id: assistantMessageId },
          update: { content },
          create: {
            id: assistantMessageId,
            conversationId: conversation.id,
            role: "ASSISTANT",
            content,
            model: env.OPENROUTER_MODEL,
          },
        }),
        prisma.assistantConversation.update({
          where: { id: conversation.id },
          data: { updatedAt: new Date() },
        }),
      ]);
    },
  });

  return createUIMessageStreamResponse({ stream });
}
