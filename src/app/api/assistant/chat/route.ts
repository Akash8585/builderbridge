import { randomUUID } from "node:crypto";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  safeValidateUIMessages,
  stepCountIs,
  streamText,
  toUIMessageStream,
} from "ai";
import type { UIMessage } from "ai";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { ASSISTANT_TOOL_SYSTEM_PROMPT, buildAssistantContext } from "@/lib/ai-assistant";
import { makeConversationTitle, requireAssistantConversation } from "@/lib/assistant-conversations";
import {
  isMissingRoadblockProposalConfirmation,
  isMissingProjectControlProposalConfirmation,
  isMissingScheduleProposalConfirmation,
  isMissingTaskProposalConfirmation,
  isRoadblockActionRequest,
  isRfiActionRequest,
  isScheduleActionRequest,
  isTaskActionRequest,
  isSubmittalActionRequest,
  parseDeterministicProjectControlAction,
  parseDeterministicScheduleWhatIf,
} from "@/lib/assistant-intent";
import { AssistantActionError } from "@/lib/assistant-actions";
import { env } from "@/lib/env";
import { createAssistantTools } from "@/lib/assistant-tools";
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

function serializeParts(parts: UIMessage["parts"]): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(parts)) as Prisma.InputJsonValue;
}

function streamErrorMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message.toLowerCase() : "";
  if (detail.includes("429") || detail.includes("rate limit")) {
    return "OpenRouter's free models are busy right now. Please wait a moment and try again.";
  }
  return "OpenRouter could not complete this response. Please try again.";
}

function deterministicOutputText(output: unknown): string {
  if (!output || typeof output !== "object" || !("kind" in output)) return "";
  if (output.kind === "action-proposal") {
    const proposal = "proposal" in output && output.proposal && typeof output.proposal === "object"
      ? output.proposal
      : null;
    const actionLabel = proposal && "actionLabel" in proposal && typeof proposal.actionLabel === "string"
      ? proposal.actionLabel.toLowerCase()
      : "change";
    return `I prepared the ${actionLabel} proposal. Review the proposal card before applying it.`;
  }
  if (output.kind === "action-clarification" && "message" in output && typeof output.message === "string") {
    return output.message;
  }
  return "";
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
          parts: serializeParts(latestMessage.parts),
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

  const assistantMessageId = randomUUID();
  const tools = createAssistantTools({
    organizationId,
    userId: user.id,
    conversationId: conversation.id,
    focusProjectId: conversation.projectId ?? undefined,
  });
  const previousAssistantText = [...recentMessages]
    .reverse()
    .find((message) => message.role === "ASSISTANT")?.content ?? "";
  const pendingProposal = await prisma.assistantActionProposal.findFirst({
    where: {
      conversationId: conversation.id,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  const forceRoadblockProposal =
    isRoadblockActionRequest(question) ||
    (!pendingProposal && isMissingRoadblockProposalConfirmation(question, previousAssistantText));
  const forceRfiProposal =
    !forceRoadblockProposal &&
    (isRfiActionRequest(question) ||
      (!pendingProposal &&
        /\bRFI\b/i.test(previousAssistantText) &&
        isMissingProjectControlProposalConfirmation(question, previousAssistantText)));
  const forceSubmittalProposal =
    !forceRoadblockProposal &&
    !forceRfiProposal &&
    (isSubmittalActionRequest(question) ||
      (!pendingProposal &&
        /\bsubmittal\b/i.test(previousAssistantText) &&
        isMissingProjectControlProposalConfirmation(question, previousAssistantText)));
  const forceTaskProposal =
    !forceRoadblockProposal &&
    !forceRfiProposal &&
    !forceSubmittalProposal &&
    !isScheduleActionRequest(question) &&
    (isTaskActionRequest(question) ||
      (!pendingProposal && isMissingTaskProposalConfirmation(question, previousAssistantText)));
  const forceScheduleProposal =
    !forceRoadblockProposal &&
    !forceRfiProposal &&
    !forceSubmittalProposal &&
    (isScheduleActionRequest(question) ||
      (!pendingProposal && isMissingScheduleProposalConfirmation(question, previousAssistantText)));
  const forcedTool = forceRoadblockProposal
    ? "proposeRoadblockChange"
    : forceRfiProposal
      ? "proposeRfiChange"
      : forceSubmittalProposal
        ? "proposeSubmittalChange"
        : forceScheduleProposal
          ? "proposeScheduleChange"
          : forceTaskProposal
            ? "proposeTaskChange"
            : null;

  const deterministicWhatIf = forceScheduleProposal
    ? parseDeterministicScheduleWhatIf(question)
    : null;
  const deterministicProjectControl = forceRfiProposal || forceSubmittalProposal
    ? parseDeterministicProjectControlAction(question)
    : null;
  const deterministicAction = deterministicWhatIf
    ? { toolName: "proposeScheduleChange" as const, input: deterministicWhatIf }
    : deterministicProjectControl;
  if (deterministicAction) {
    const toolCallId = randomUUID();
    const textId = randomUUID();
    const directStream = createUIMessageStream({
      originalMessages: validated.data,
      execute: async ({ writer }) => {
        writer.write({ type: "start", messageId: assistantMessageId });
        writer.write({
          type: "tool-input-available",
          toolCallId,
          toolName: deterministicAction.toolName,
          input: deterministicAction.input,
        });
        try {
          const toolOptions = { toolCallId, messages: [], context: {} };
          const output = deterministicAction.toolName === "proposeScheduleChange"
            ? await tools.proposeScheduleChange.execute!(deterministicAction.input, toolOptions)
            : deterministicAction.toolName === "proposeRfiChange"
              ? await tools.proposeRfiChange.execute!(deterministicAction.input, toolOptions)
              : await tools.proposeSubmittalChange.execute!(deterministicAction.input, toolOptions);
          writer.write({ type: "tool-output-available", toolCallId, output });
          const text = deterministicOutputText(output);
          if (text) {
            writer.write({ type: "text-start", id: textId });
            writer.write({ type: "text-delta", id: textId, delta: text });
            writer.write({ type: "text-end", id: textId });
          }
          writer.write({ type: "finish", finishReason: "stop" });
        } catch (error) {
          const errorText =
            error instanceof AssistantActionError
              ? error.message
              : "The proposal could not be prepared. Please try again.";
          writer.write({ type: "tool-output-error", toolCallId, errorText });
          writer.write({ type: "finish", finishReason: "error" });
        }
      },
      onEnd: async ({ responseMessage, isAborted }) => {
        if (isAborted) return;
        const content = messageText(responseMessage).trim();
        await prisma.$transaction([
          prisma.assistantMessage.upsert({
            where: { id: assistantMessageId },
            update: { content, parts: serializeParts(responseMessage.parts) },
            create: {
              id: assistantMessageId,
              conversationId: conversation.id,
              role: "ASSISTANT",
              content,
              parts: serializeParts(responseMessage.parts),
              model: deterministicAction.toolName === "proposeScheduleChange"
                ? "local-schedule-parser"
                : "local-project-controls-parser",
            },
          }),
          prisma.assistantConversation.update({
            where: { id: conversation.id },
            data: { updatedAt: new Date() },
          }),
        ]);
      },
    });
    return createUIMessageStreamResponse({ stream: directStream });
  }

  const context = await buildAssistantContext(organizationId, conversation.projectId ?? undefined);
  const result = streamText({
    model: getOpenRouterModel(),
    system: ASSISTANT_TOOL_SYSTEM_PROMPT + context,
    messages: recentMessages.map((message) => ({
      role: message.role === "USER" ? ("user" as const) : ("assistant" as const),
      content: message.content,
    })),
    tools,
    toolChoice: "auto",
    prepareStep: ({ stepNumber }) =>
      stepNumber === 0 && forcedTool
        ? {
            activeTools: [forcedTool],
            toolChoice: { type: "tool", toolName: forcedTool },
          }
        : { toolChoice: "auto" },
    stopWhen: stepCountIs(6),
    temperature: 0.3,
    maxOutputTokens: 1000,
    abortSignal: request.signal,
  });

  const stream = toUIMessageStream({
    stream: result.stream,
    tools,
    originalMessages: validated.data,
    generateMessageId: () => assistantMessageId,
    sendReasoning: false,
    onError: streamErrorMessage,
    onEnd: async ({ responseMessage, isAborted }) => {
      const content = messageText(responseMessage).trim();
      if (isAborted) return;
      await prisma.$transaction([
        prisma.assistantMessage.upsert({
          where: { id: assistantMessageId },
          update: { content, parts: serializeParts(responseMessage.parts) },
          create: {
            id: assistantMessageId,
            conversationId: conversation.id,
            role: "ASSISTANT",
            content,
            parts: serializeParts(responseMessage.parts),
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
