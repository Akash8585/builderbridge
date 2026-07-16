import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AssistantActionError,
  confirmAssistantAction,
  createTaskActionProposal,
} from "@/lib/assistant-actions";
import { createAssistantTools } from "@/lib/assistant-tools";
import { PermissionError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { cleanupFixture, createFixture, type Fixture } from "./fixtures";

describe("Assistant task action proposals", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    fixture = await createFixture();
  });

  afterAll(async () => {
    await cleanupFixture(fixture);
  });

  function createConversation(userId: string) {
    return prisma.assistantConversation.create({
      data: {
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
        createdById: userId,
        title: "Assistant task action test",
      },
    });
  }

  function createTask(name: string, assignedToId?: string) {
    return prisma.task.create({
      data: {
        projectId: fixture.project.id,
        name,
        assignedToId,
        startDate: new Date("2026-07-20T12:00:00.000Z"),
        endDate: new Date("2026-07-24T12:00:00.000Z"),
        status: "NOT_STARTED",
        progress: 0,
      },
    });
  }

  it("resolves natural task and assignee names into a renderable proposal", async () => {
    const conversation = await createConversation(fixture.pm.user.id);
    await createTask("Natural language schedule task");
    const tool = createAssistantTools({
      organizationId: fixture.organization.id,
      userId: fixture.pm.user.id,
      conversationId: conversation.id,
      focusProjectId: fixture.project.id,
    }).proposeTaskChange;

    const output = await tool.execute!(
      {
        operation: "UPDATE",
        taskName: "Natural language schedule task",
        assignedToName: fixture.superintendent.user.name,
        progress: 45,
      },
      { toolCallId: "natural-task-change", messages: [], context: {} }
    );

    expect(output).toMatchObject({
      kind: "action-proposal",
      proposal: {
        actionLabel: "Update task",
        status: "PENDING",
        taskName: "Natural language schedule task",
      },
    });
  });

  it("creates a task only after confirmation and confirms idempotently", async () => {
    const conversation = await createConversation(fixture.pm.user.id);
    const context = { organizationId: fixture.organization.id, userId: fixture.pm.user.id };
    const output = await createTaskActionProposal(
      {
        conversationId: conversation.id,
        projectId: fixture.project.id,
        operation: "CREATE",
        name: "Level 2 framing",
        assignedToId: fixture.superintendent.member.id,
        startDate: "2026-07-27",
        endDate: "2026-07-31",
        progress: 40,
        note: "Coordinate the north elevation first",
      },
      context
    );

    expect(output).toMatchObject({
      kind: "action-proposal",
      proposal: { actionLabel: "Create task", status: "PENDING", hrefLabel: "Open schedule" },
    });
    expect(await prisma.task.count({ where: { projectId: fixture.project.id, name: "Level 2 framing" } })).toBe(0);

    const confirmed = await confirmAssistantAction(output.proposal.id, context);
    expect(confirmed).toMatchObject({ status: "CONFIRMED", hrefLabel: "Open task" });
    const task = await prisma.task.findFirstOrThrow({
      where: { projectId: fixture.project.id, name: "Level 2 framing" },
      include: { updates: true },
    });
    expect(task).toMatchObject({
      assignedToId: fixture.superintendent.member.id,
      status: "IN_PROGRESS",
      progress: 40,
    });
    expect(task.updates).toHaveLength(1);
    expect(task.updates[0].note).toBe("Coordinate the north elevation first");

    await confirmAssistantAction(output.proposal.id, context);
    expect(await prisma.task.count({ where: { projectId: fixture.project.id, name: "Level 2 framing" } })).toBe(1);
    expect(await prisma.activityLogEntry.count({ where: { taskId: task.id, action: "assistant_task_created" } })).toBe(1);
  });

  it("applies dates, status, progress, assignment, and a note as one update", async () => {
    const conversation = await createConversation(fixture.pm.user.id);
    const task = await createTask("Consolidated task update");
    const context = { organizationId: fixture.organization.id, userId: fixture.pm.user.id };
    const output = await createTaskActionProposal(
      {
        conversationId: conversation.id,
        projectId: fixture.project.id,
        operation: "UPDATE",
        taskId: task.id,
        assignedToId: fixture.trade.member.id,
        startDate: "2026-07-22",
        endDate: "2026-07-29",
        status: "IN_PROGRESS",
        progress: 35,
        note: "Crew mobilized on the east side",
      },
      context
    );

    const before = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(before.progress).toBe(0);
    await confirmAssistantAction(output.proposal.id, context);
    const updated = await prisma.task.findUniqueOrThrow({
      where: { id: task.id },
      include: { updates: true },
    });
    expect(updated).toMatchObject({
      assignedToId: fixture.trade.member.id,
      status: "IN_PROGRESS",
      progress: 35,
    });
    expect(updated.startDate.toISOString()).toBe("2026-07-22T12:00:00.000Z");
    expect(updated.endDate.toISOString()).toBe("2026-07-29T12:00:00.000Z");
    expect(updated.updates.at(-1)?.note).toBe("Crew mobilized on the east side");
  });

  it("rejects a stale update proposal", async () => {
    const conversation = await createConversation(fixture.pm.user.id);
    const task = await createTask("Stale task update");
    const context = { organizationId: fixture.organization.id, userId: fixture.pm.user.id };
    const output = await createTaskActionProposal(
      {
        conversationId: conversation.id,
        projectId: fixture.project.id,
        operation: "UPDATE",
        taskId: task.id,
        progress: 60,
      },
      context
    );

    await prisma.task.update({ where: { id: task.id }, data: { status: "DELAYED" } });
    await expect(confirmAssistantAction(output.proposal.id, context)).rejects.toBeInstanceOf(
      AssistantActionError
    );
    const proposal = await prisma.assistantActionProposal.findUniqueOrThrow({
      where: { id: output.proposal.id },
    });
    expect(proposal.status).toBe("PENDING");
  });

  it("allows an assigned trade to report progress but not reschedule the task", async () => {
    const conversation = await createConversation(fixture.trade.user.id);
    const task = await createTask("Trade progress task", fixture.trade.member.id);
    const context = { organizationId: fixture.organization.id, userId: fixture.trade.user.id };

    const progressProposal = await createTaskActionProposal(
      {
        conversationId: conversation.id,
        projectId: fixture.project.id,
        operation: "UPDATE",
        taskId: task.id,
        progress: 25,
        note: "Layout is complete",
      },
      context
    );
    await confirmAssistantAction(progressProposal.proposal.id, context);
    expect(await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({
      status: "IN_PROGRESS",
      progress: 25,
    });

    await expect(
      createTaskActionProposal(
        {
          conversationId: conversation.id,
          projectId: fixture.project.id,
          operation: "UPDATE",
          taskId: task.id,
          endDate: "2026-08-03",
        },
        context
      )
    ).rejects.toBeInstanceOf(PermissionError);
  });
});
