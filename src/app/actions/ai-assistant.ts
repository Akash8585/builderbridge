"use server";

import { z } from "zod";
import { requireUser } from "@/lib/session";
import { requireProjectMember } from "@/lib/permissions";
import { answerScheduleQuestion, AssistantNotConfiguredError } from "@/lib/ai-assistant";
import { ok, fail, type ActionResult } from "./schemas";

const askSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  question: z.string().min(1, "Please type a question").max(1000, "Keep the question under 1000 characters"),
});

export async function askScheduleAssistant(input: unknown): Promise<ActionResult<string>> {
  const parsed = askSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    // Any project member can ask — this is read-only, grounded Q&A.
    await requireProjectMember(user.id, parsed.data.projectId);

    const answer = await answerScheduleQuestion(parsed.data.projectId, parsed.data.question);
    return ok(answer);
  } catch (error) {
    if (error instanceof AssistantNotConfiguredError) {
      return { success: false, error: error.message };
    }
    return fail(error);
  }
}
