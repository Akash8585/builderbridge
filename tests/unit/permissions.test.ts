import { describe, it, expect } from "vitest";
import { isProjectManager, canManageSchedule, canResolveRoadblocks } from "@/lib/permissions";
import type { ProjectRole } from "@prisma/client";

const ALL_ROLES: ProjectRole[] = ["PROJECT_MANAGER", "SCHEDULER", "SUPERINTENDENT", "TRADE"];

describe("isProjectManager", () => {
  it("is true only for PROJECT_MANAGER", () => {
    for (const role of ALL_ROLES) {
      expect(isProjectManager(role)).toBe(role === "PROJECT_MANAGER");
    }
  });
});

describe("canManageSchedule", () => {
  it("is true for GC-side roles (PM, Scheduler, Superintendent), false for Trade", () => {
    expect(canManageSchedule("PROJECT_MANAGER")).toBe(true);
    expect(canManageSchedule("SCHEDULER")).toBe(true);
    expect(canManageSchedule("SUPERINTENDENT")).toBe(true);
    expect(canManageSchedule("TRADE")).toBe(false);
  });
});

describe("canResolveRoadblocks", () => {
  it("is true only for PM and Superintendent — matches the approved capability matrix", () => {
    expect(canResolveRoadblocks("PROJECT_MANAGER")).toBe(true);
    expect(canResolveRoadblocks("SUPERINTENDENT")).toBe(true);
    expect(canResolveRoadblocks("SCHEDULER")).toBe(false);
    expect(canResolveRoadblocks("TRADE")).toBe(false);
  });
});
