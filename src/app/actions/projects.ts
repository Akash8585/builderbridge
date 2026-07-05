"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { requireProjectOwner } from "@/lib/permissions";
import { ok, fail, type ActionResult } from "./schemas";
import type { Project } from "@prisma/client";

const createProjectSchema = z
  .object({
    organizationId: z.string().min(1),
    name: z.string().min(1, "Project name is required").max(200),
    startDate: z.coerce.date({ message: "A valid start date is required" }),
    endDate: z.coerce.date({ message: "A valid end date is required" }),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

export async function createProject(input: unknown): Promise<ActionResult<Project>> {
  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();

    const project = await prisma.project.create({
      data: {
        organizationId: parsed.data.organizationId,
        name: parsed.data.name,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        members: {
          create: { userId: user.id, role: "GC_OWNER" },
        },
      },
    });

    revalidatePath("/projects");
    return ok(project);
  } catch (error) {
    return fail(error);
  }
}

const projectIdSchema = z.object({ projectId: z.string().min(1, "projectId is required") });

export async function archiveProject(input: unknown): Promise<ActionResult<Project>> {
  const parsed = projectIdSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    await requireProjectOwner(user.id, parsed.data.projectId);

    const project = await prisma.project.update({
      where: { id: parsed.data.projectId },
      data: { isArchived: true, archivedAt: new Date() },
    });

    revalidatePath("/projects");
    return ok(project);
  } catch (error) {
    return fail(error);
  }
}

export async function unarchiveProject(input: unknown): Promise<ActionResult<Project>> {
  const parsed = projectIdSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    await requireProjectOwner(user.id, parsed.data.projectId);

    const project = await prisma.project.update({
      where: { id: parsed.data.projectId },
      data: { isArchived: false, archivedAt: null },
    });

    revalidatePath("/projects");
    return ok(project);
  } catch (error) {
    return fail(error);
  }
}
