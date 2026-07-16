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
import {
  assistantFileParts,
  buildAttachmentAcknowledgement,
  isAllowedAssistantAttachmentType,
  MAX_ASSISTANT_ATTACHMENTS,
} from "@/lib/assistant-attachments";
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
import { isProjectDocumentQuestion } from "@/lib/project-document-search";
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

function createPersistedTextResponse({
  text,
  originalMessages,
  assistantMessageId,
  conversationId,
  model,
}: {
  text: string;
  originalMessages: UIMessage[];
  assistantMessageId: string;
  conversationId: string;
  model: string;
}) {
  const textId = randomUUID();
  const stream = createUIMessageStream({
    originalMessages,
    execute: async ({ writer }) => {
      writer.write({ type: "start", messageId: assistantMessageId });
      writer.write({ type: "text-start", id: textId });
      writer.write({ type: "text-delta", id: textId, delta: text });
      writer.write({ type: "text-end", id: textId });
      writer.write({ type: "finish", finishReason: "stop" });
    },
    onEnd: async ({ responseMessage, isAborted }) => {
      if (isAborted) return;
      await prisma.$transaction([
        prisma.assistantMessage.upsert({
          where: { id: assistantMessageId },
          update: { content: text, parts: serializeParts(responseMessage.parts) },
          create: {
            id: assistantMessageId,
            conversationId,
            role: "ASSISTANT",
            content: text,
            parts: serializeParts(responseMessage.parts),
            model,
          },
        }),
        prisma.assistantConversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        }),
      ]);
    },
  });
  return createUIMessageStreamResponse({ stream });
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

  const fileParts = assistantFileParts(latestMessage);
  if (fileParts.length > MAX_ASSISTANT_ATTACHMENTS) {
    return Response.json({ error: "Attach no more than four files per message." }, { status: 400 });
  }
  if (fileParts.length > 0 && !conversation.projectId) {
    return Response.json({ error: "Attachments require a project conversation." }, { status: 400 });
  }
  const fileUrls = fileParts.map((part) => part.url);
  if (new Set(fileUrls).size !== fileUrls.length) {
    return Response.json({ error: "The same attachment was included more than once." }, { status: 400 });
  }
  const attachments = fileUrls.length
    ? await prisma.assistantAttachment.findMany({
        where: {
          conversationId: conversation.id,
          uploadedById: user.id,
          fileUrl: { in: fileUrls },
          OR: [{ messageId: null }, { messageId: latestMessage.id }],
        },
      })
    : [];
  const attachmentByUrl = new Map(attachments.map((attachment) => [attachment.fileUrl, attachment]));
  const invalidAttachment = fileParts.some((part) => {
    const attachment = attachmentByUrl.get(part.url);
    return (
      !attachment ||
      attachment.projectId !== conversation.projectId ||
      attachment.fileName !== part.filename ||
      attachment.mediaType !== part.mediaType ||
      !isAllowedAssistantAttachmentType(part.mediaType)
    );
  });
  if (invalidAttachment) {
    return Response.json({ error: "One or more attachments are invalid." }, { status: 400 });
  }

  if (existingMessage && existingMessage.conversationId !== conversation.id) {
    return Response.json({ error: "Message already belongs to another conversation." }, { status: 409 });
  }

  if (!existingMessage) {
    const attachmentSummary = attachments.length
      ? `\n\nAttached project files (stored securely): ${attachments
          .map((attachment) => `${attachment.fileName} [${attachment.extractionStatus}]`)
          .join(", ")}.`
      : "";
    await prisma.$transaction([
      prisma.assistantMessage.create({
        data: {
          id: latestMessage.id,
          conversationId: conversation.id,
          role: "USER",
          content: question + attachmentSummary,
          parts: serializeParts(latestMessage.parts),
        },
      }),
      prisma.assistantAttachment.updateMany({
        where: { id: { in: attachments.map((attachment) => attachment.id) }, messageId: null },
        data: { messageId: latestMessage.id },
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

  const assistantMessageId = randomUUID();
  const attachmentAcknowledgement = buildAttachmentAcknowledgement(
    question,
    attachments.map((attachment) => attachment.fileName),
    conversation.project?.name ?? "this project"
  );
  if (attachmentAcknowledgement) {
    return createPersistedTextResponse({
      text: attachmentAcknowledgement,
      originalMessages: validated.data,
      assistantMessageId,
      conversationId: conversation.id,
      model: "local-attachment-handler",
    });
  }

  const recentMessages = await prisma.assistantMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  recentMessages.reverse();

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
  const forceDocumentSearch =
    !forceRoadblockProposal &&
    !forceRfiProposal &&
    !forceSubmittalProposal &&
    !forceTaskProposal &&
    !forceScheduleProposal &&
    Boolean(conversation.projectId) &&
    isProjectDocumentQuestion(question);
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
            : forceDocumentSearch
              ? "searchProjectDocuments"
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
    system:
      ASSISTANT_TOOL_SYSTEM_PROMPT +
      "Attached project files are already uploaded, saved securely, and linked to the conversation. Never claim BuilderBridge cannot save or attach them. Use searchProjectDocuments before describing file contents, and ground the answer only in returned extracted snippets. If extraction is unavailable or no snippet matches, say that clearly.\n\n" +
      context,
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
