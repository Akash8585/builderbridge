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
  isBaselineActionRequest,
  isRoadblockActionRequest,
  isRfiActionRequest,
  isRfiCreateIntentWithoutQuestion,
  isRfiTaskListRequest,
  isScheduleActionRequest,
  isScheduleImpactActionRequest,
  isTaskActionRequest,
  isTaskProgressActionRequest,
  isSubmittalActionRequest,
  isWeeklyCommitmentActionRequest,
  parseDeterministicBaselineAction,
  parseDeterministicProjectControlAction,
  parseDeterministicScheduleWhatIf,
  parseDeterministicScheduleImpactAction,
  parseDeterministicTaskProgressAction,
  parseDeterministicWeeklyCommitmentAction,
  parseRfiQuestionFollowUp,
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

function assistantMessageIdFor(userMessageId: string) {
  return `assistant_${userMessageId}`;
}

function assistantTraceLog(
  event: "start" | "deterministic-tool" | "stream-start" | "finish" | "error" | "replay" | "in-flight",
  metadata: Record<string, unknown>
) {
  console.info("[assistant-chat]", {
    event,
    at: new Date().toISOString(),
    ...metadata,
  });
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
  const assistantMessageId = assistantMessageIdFor(latestMessage.id);

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

  const existingAssistantMessage = await prisma.assistantMessage.findUnique({
    where: { id: assistantMessageId },
  });
  if (existingAssistantMessage) {
    if (existingAssistantMessage.conversationId !== conversation.id) {
      return Response.json({ error: "Assistant response already belongs to another conversation." }, { status: 409 });
    }
    if (existingAssistantMessage.content.trim() || existingAssistantMessage.parts) {
      assistantTraceLog("replay", {
        conversationId: conversation.id,
        userMessageId: latestMessage.id,
        assistantMessageId,
        model: existingAssistantMessage.model,
      });
      return createPersistedTextResponse({
        text: existingAssistantMessage.content,
        originalMessages: validated.data,
        assistantMessageId,
        conversationId: conversation.id,
        model: existingAssistantMessage.model ?? "assistant-replay",
      });
    }
    if (Date.now() - existingAssistantMessage.createdAt.getTime() < 60_000) {
      assistantTraceLog("in-flight", {
        conversationId: conversation.id,
        userMessageId: latestMessage.id,
        assistantMessageId,
      });
      return Response.json({ error: "Assistant response is already in progress." }, { status: 409 });
    }
  } else {
    await prisma.assistantMessage.create({
      data: {
        id: assistantMessageId,
        conversationId: conversation.id,
        role: "ASSISTANT",
        content: "",
        model: "pending",
      },
    });
  }
  assistantTraceLog("start", {
    conversationId: conversation.id,
    userMessageId: latestMessage.id,
    assistantMessageId,
    organizationId,
    focusProjectId: conversation.projectId,
    attachmentCount: attachments.length,
  });

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
    where: { conversationId: conversation.id, id: { not: assistantMessageId } },
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
  const rfiQuestionFollowUp = parseRfiQuestionFollowUp(question, previousAssistantText);
  const wantsRfiTaskList = isRfiTaskListRequest(question, previousAssistantText);
  const forceRfiProposal =
    !forceRoadblockProposal &&
    !wantsRfiTaskList &&
    (isRfiActionRequest(question) ||
      Boolean(rfiQuestionFollowUp) ||
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
    !isTaskProgressActionRequest(question) &&
    !isWeeklyCommitmentActionRequest(question) &&
    !isScheduleImpactActionRequest(question) &&
    !isBaselineActionRequest(question) &&
    (isTaskActionRequest(question) ||
      (!pendingProposal && isMissingTaskProposalConfirmation(question, previousAssistantText)));
  const forceTaskProgressProposal =
    !forceRoadblockProposal &&
    !forceRfiProposal &&
    !forceSubmittalProposal &&
    !forceTaskProposal &&
    !isWeeklyCommitmentActionRequest(question) &&
    !isScheduleImpactActionRequest(question) &&
    !isBaselineActionRequest(question) &&
    isTaskProgressActionRequest(question);
  const forceWeeklyCommitmentProposal =
    !forceRoadblockProposal &&
    !forceRfiProposal &&
    !forceSubmittalProposal &&
    !forceTaskProposal &&
    !forceTaskProgressProposal &&
    !isScheduleImpactActionRequest(question) &&
    !isBaselineActionRequest(question) &&
    isWeeklyCommitmentActionRequest(question);
  const forceScheduleImpactProposal =
    !forceRoadblockProposal &&
    !forceRfiProposal &&
    !forceSubmittalProposal &&
    !forceTaskProposal &&
    !forceTaskProgressProposal &&
    !forceWeeklyCommitmentProposal &&
    isScheduleImpactActionRequest(question);
  const forceBaselineProposal =
    !forceRoadblockProposal &&
    !forceRfiProposal &&
    !forceSubmittalProposal &&
    !forceTaskProposal &&
    !forceTaskProgressProposal &&
    !forceWeeklyCommitmentProposal &&
    !forceScheduleImpactProposal &&
    isBaselineActionRequest(question);
  const forceScheduleProposal =
    !forceRoadblockProposal &&
    !forceRfiProposal &&
    !forceSubmittalProposal &&
    !forceTaskProgressProposal &&
    !forceWeeklyCommitmentProposal &&
    !forceScheduleImpactProposal &&
    !forceBaselineProposal &&
    (isScheduleActionRequest(question) ||
      (!pendingProposal && isMissingScheduleProposalConfirmation(question, previousAssistantText)));
  const forceDocumentSearch =
    !forceRoadblockProposal &&
    !forceRfiProposal &&
    !forceSubmittalProposal &&
    !forceTaskProposal &&
    !forceTaskProgressProposal &&
    !forceWeeklyCommitmentProposal &&
    !forceScheduleImpactProposal &&
    !forceBaselineProposal &&
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
            : forceTaskProgressProposal
              ? "proposeTaskProgressChange"
              : forceWeeklyCommitmentProposal
                ? "proposeWeeklyCommitmentChange"
                : forceScheduleImpactProposal
                  ? "proposeScheduleImpactChange"
                  : forceBaselineProposal
                    ? "proposeBaselineChange"
                    : forceDocumentSearch
                      ? "searchProjectDocuments"
                      : null;

  const deterministicWhatIf = forceScheduleProposal
    ? parseDeterministicScheduleWhatIf(question)
    : null;
  const deterministicProjectControl = forceRfiProposal || forceSubmittalProposal
    ? parseDeterministicProjectControlAction(question) ??
      (forceRfiProposal ? rfiQuestionFollowUp : null)
    : null;
  const deterministicTaskProgress = forceTaskProgressProposal
    ? parseDeterministicTaskProgressAction(question)
    : null;
  const deterministicWeeklyCommitment = forceWeeklyCommitmentProposal
    ? parseDeterministicWeeklyCommitmentAction(question)
    : null;
  const deterministicScheduleImpact = forceScheduleImpactProposal
    ? parseDeterministicScheduleImpactAction(question)
    : null;
  const deterministicBaseline = forceBaselineProposal
    ? parseDeterministicBaselineAction(question)
    : null;
  const deterministicAction = deterministicWhatIf
    ? { toolName: "proposeScheduleChange" as const, input: deterministicWhatIf }
    : deterministicProjectControl ??
      deterministicTaskProgress ??
      deterministicWeeklyCommitment ??
      deterministicScheduleImpact ??
      deterministicBaseline;

  if (wantsRfiTaskList) {
    const projectId = conversation.projectId;
    if (!projectId) {
      return createPersistedTextResponse({
        text: "Open a project conversation first, then I can list the tasks you can link to an RFI.",
        originalMessages: validated.data,
        assistantMessageId,
        conversationId: conversation.id,
        model: "local-rfi-helper",
      });
    }
    const tasks = await prisma.task.findMany({
      where: { projectId },
      select: { name: true },
      orderBy: [{ startDate: "asc" }, { sequenceOrder: "asc" }],
      take: 40,
    });
    const text =
      tasks.length === 0
        ? "This project has no tasks yet. You can still raise an RFI without a linked task: Raise an RFI asking <your question>."
        : [
            "Here are the project tasks you can link to an RFI:",
            ...tasks.map((task) => `- ${task.name}`),
            "",
            'Reply with: Raise an RFI asking <your question>',
            "If you want it linked, include the task name in the same message.",
          ].join("\n");
    return createPersistedTextResponse({
      text,
      originalMessages: validated.data,
      assistantMessageId,
      conversationId: conversation.id,
      model: "local-rfi-helper",
    });
  }

  if (
    forceRfiProposal &&
    !deterministicAction &&
    isRfiCreateIntentWithoutQuestion(question)
  ) {
    return createPersistedTextResponse({
      text:
        "What question should I put on the new RFI? Reply with the exact question text " +
        '(for example: Raise an RFI asking What happened to the parapet detail?). ' +
        "I will only show a proposal card after that.",
      originalMessages: validated.data,
      assistantMessageId,
      conversationId: conversation.id,
      model: "local-rfi-helper",
    });
  }

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
        assistantTraceLog("deterministic-tool", {
          conversationId: conversation.id,
          userMessageId: latestMessage.id,
          assistantMessageId,
          toolName: deterministicAction.toolName,
        });
        try {
          const toolOptions = { toolCallId, messages: [], context: {} };
          const output = deterministicAction.toolName === "proposeScheduleChange"
            ? await tools.proposeScheduleChange.execute!(deterministicAction.input, toolOptions)
            : deterministicAction.toolName === "proposeRfiChange"
              ? await tools.proposeRfiChange.execute!(deterministicAction.input, toolOptions)
              : deterministicAction.toolName === "proposeSubmittalChange"
                ? await tools.proposeSubmittalChange.execute!(deterministicAction.input, toolOptions)
                : deterministicAction.toolName === "proposeTaskProgressChange"
                  ? await tools.proposeTaskProgressChange.execute!(deterministicAction.input, toolOptions)
                  : deterministicAction.toolName === "proposeWeeklyCommitmentChange"
                    ? await tools.proposeWeeklyCommitmentChange.execute!(deterministicAction.input, toolOptions)
                    : deterministicAction.toolName === "proposeScheduleImpactChange"
                      ? await tools.proposeScheduleImpactChange.execute!(deterministicAction.input, toolOptions)
                      : await tools.proposeBaselineChange.execute!(deterministicAction.input, toolOptions);
          writer.write({ type: "tool-output-available", toolCallId, output });
          const text = deterministicOutputText(output);
          if (text) {
            writer.write({ type: "text-start", id: textId });
            writer.write({ type: "text-delta", id: textId, delta: text });
            writer.write({ type: "text-end", id: textId });
          }
          writer.write({ type: "finish", finishReason: "stop" });
        } catch (error) {
          assistantTraceLog("error", {
            conversationId: conversation.id,
            userMessageId: latestMessage.id,
            assistantMessageId,
            toolName: deterministicAction.toolName,
            errorName: error instanceof Error ? error.name : "UnknownError",
          });
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
        assistantTraceLog("finish", {
          conversationId: conversation.id,
          userMessageId: latestMessage.id,
          assistantMessageId,
          model: deterministicAction.toolName === "proposeScheduleChange"
            ? "local-schedule-parser"
            : deterministicAction.toolName === "proposeRfiChange" || deterministicAction.toolName === "proposeSubmittalChange"
              ? "local-project-controls-parser"
              : "local-field-action-parser",
          contentLength: content.length,
        });
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
                : deterministicAction.toolName === "proposeRfiChange" || deterministicAction.toolName === "proposeSubmittalChange"
                  ? "local-project-controls-parser"
                  : "local-field-action-parser",
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

  const context = await buildAssistantContext(organizationId, user.id, conversation.projectId ?? undefined);
  assistantTraceLog("stream-start", {
    conversationId: conversation.id,
    userMessageId: latestMessage.id,
    assistantMessageId,
    forcedTool,
    model: env.OPENROUTER_MODEL,
  });
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
      assistantTraceLog("finish", {
        conversationId: conversation.id,
        userMessageId: latestMessage.id,
        assistantMessageId,
        forcedTool,
        model: env.OPENROUTER_MODEL,
        contentLength: content.length,
      });
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
