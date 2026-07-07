import { describe, it, expect } from "vitest";
import { canCreateProject, PLAN_LIMITS } from "@/lib/billing";

describe("canCreateProject", () => {
  it("FREE allows up to its limit, then blocks", () => {
    const limit = PLAN_LIMITS.FREE.activeProjects!;
    expect(canCreateProject("FREE", 0)).toBe(true);
    expect(canCreateProject("FREE", limit - 1)).toBe(true);
    expect(canCreateProject("FREE", limit)).toBe(false);
    expect(canCreateProject("FREE", limit + 5)).toBe(false);
  });

  it("CORE and PRO are unlimited", () => {
    expect(canCreateProject("CORE", 999)).toBe(true);
    expect(canCreateProject("PRO", 999)).toBe(true);
  });
});
