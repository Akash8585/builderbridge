import { z } from "zod";

export type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function fail<T>(error: unknown): ActionResult<T> {
  if (error instanceof z.ZodError) {
    return { success: false, error: error.issues.map((i) => i.message).join(", ") };
  }
  if (error instanceof Error) {
    return { success: false, error: error.message };
  }
  return { success: false, error: "Something went wrong" };
}

export const projectRoleSchema = z.enum(["GC_OWNER", "TRADE"]);

export const taskStatusSchema = z.enum(["NOT_STARTED", "IN_PROGRESS", "DONE", "DELAYED"]);
