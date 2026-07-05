import type { TaskStatus } from "@prisma/client";

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function daysBetween(start: Date, end: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

export function percentComplete(total: number, done: number): number {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
  DELAYED: "Delayed",
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  NOT_STARTED: "bg-surface-strong text-body",
  IN_PROGRESS: "bg-brand-accent/15 text-brand-accent",
  DONE: "bg-success/15 text-success",
  DELAYED: "bg-error/15 text-error",
};

export function generateInviteExpiry(days = 7): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}
