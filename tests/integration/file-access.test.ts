import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { requireStoredFileAccess } from "@/lib/file-access";
import { PermissionError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { cleanupFixture, createFixture, type Fixture } from "./fixtures";

describe("private file authorization", () => {
  let fixture: Fixture;
  let outsiderId: string;

  beforeAll(async () => {
    fixture = await createFixture();
    const outsider = await prisma.user.create({
      data: {
        name: "Storage outsider",
        email: `storage-outsider-${Date.now()}@test.local`,
        emailVerified: true,
      },
    });
    outsiderId = outsider.id;
  });

  afterAll(async () => {
    await cleanupFixture(fixture);
    await prisma.user.delete({ where: { id: outsiderId } }).catch(() => {});
  });

  it("allows project members to read project and task objects", async () => {
    const task = await prisma.task.create({
      data: {
        projectId: fixture.project.id,
        name: "Storage authorization task",
        startDate: new Date("2026-08-01T12:00:00.000Z"),
        endDate: new Date("2026-08-02T12:00:00.000Z"),
      },
    });
    await expect(
      requireStoredFileAccess(
        fixture.trade.user.id,
        `drawings/${fixture.project.id}/plan.pdf`
      )
    ).resolves.toBeUndefined();
    await expect(
      requireStoredFileAccess(fixture.trade.user.id, `tasks/${task.id}/photo.jpg`)
    ).resolves.toBeUndefined();
  });

  it("denies users outside the project", async () => {
    await expect(
      requireStoredFileAccess(outsiderId, `documents/${fixture.project.id}/spec.pdf`)
    ).rejects.toBeInstanceOf(PermissionError);
  });
});
