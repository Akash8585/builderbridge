"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { requireProjectManager } from "@/lib/permissions";
import { auth } from "@/lib/auth";
import { generateInviteExpiry } from "@/lib/utils";
import { ok, fail, projectRoleSchema, type ActionResult } from "./schemas";
import type { ProjectInvite, ProjectMember } from "@prisma/client";

const createInviteSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  role: projectRoleSchema,
});

export async function createInvite(input: unknown): Promise<ActionResult<ProjectInvite>> {
  const parsed = createInviteSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    await requireProjectManager(user.id, parsed.data.projectId);

    const invite = await prisma.projectInvite.create({
      data: {
        projectId: parsed.data.projectId,
        role: parsed.data.role,
        expiresAt: generateInviteExpiry(),
      },
    });

    revalidatePath(`/projects/${parsed.data.projectId}/members`);
    return ok(invite);
  } catch (error) {
    return fail(error);
  }
}

const acceptInviteSchema = z.object({
  token: z.string().min(1, "A valid invite token is required"),
});

export async function acceptInvite(input: unknown): Promise<ActionResult<ProjectMember>> {
  const parsed = acceptInviteSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();

    const invite = await prisma.projectInvite.findUnique({
      where: { token: parsed.data.token },
      include: { project: true },
    });

    if (!invite) throw new Error("This invite link is invalid");
    if (invite.usedAt) throw new Error("This invite link has already been used");
    if (invite.expiresAt < new Date()) throw new Error("This invite link has expired");

    const [member] = await prisma.$transaction(async (tx) => {
      await tx.member.upsert({
        where: {
          organizationId_userId: {
            organizationId: invite.project.organizationId,
            userId: user.id,
          },
        },
        create: {
          organizationId: invite.project.organizationId,
          userId: user.id,
          role: "member",
        },
        update: {},
      });

      const projectMember = await tx.projectMember.upsert({
        where: { projectId_userId: { projectId: invite.projectId, userId: user.id } },
        create: { projectId: invite.projectId, userId: user.id, role: invite.role },
        update: { role: invite.role },
      });

      await tx.projectInvite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      });

      return [projectMember];
    });

    // Make the invited project's org the user's active organization so they land
    // straight in the right context after accepting.
    await auth.api
      .setActiveOrganization({
        headers: await headers(),
        body: { organizationId: invite.project.organizationId },
      })
      .catch(() => {
        // Non-fatal: the org switcher lets them pick it manually if this fails.
      });

    revalidatePath(`/projects/${invite.projectId}`);
    return ok(member);
  } catch (error) {
    return fail(error);
  }
}

const removeMemberSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  memberId: z.string().min(1, "memberId is required"),
});

export async function removeMember(input: unknown): Promise<ActionResult<null>> {
  const parsed = removeMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    await requireProjectManager(user.id, parsed.data.projectId);

    // onDelete: SetNull on Task.assignedToId automatically unassigns their tasks.
    const { count } = await prisma.projectMember.deleteMany({
      where: { id: parsed.data.memberId, projectId: parsed.data.projectId },
    });
    if (count === 0) throw new Error("Member not found on this project");

    revalidatePath(`/projects/${parsed.data.projectId}/members`);
    revalidatePath(`/projects/${parsed.data.projectId}`);
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}
