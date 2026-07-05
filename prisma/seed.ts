import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "password123";

async function createUser(email: string, name: string) {
  const password = await hashPassword(DEMO_PASSWORD);
  return prisma.user.create({
    data: {
      email,
      name,
      emailVerified: true,
      accounts: {
        create: {
          providerId: "credential",
          accountId: email,
          password,
        },
      },
    },
  });
}

async function main() {
  console.log("Seeding demo data...");

  const gc = await createUser("jane@buildflow.dev", "Jane GC");
  const electrician = await createUser("tom@buildflow.dev", "Tom Electric");
  const plumber = await createUser("sara@buildflow.dev", "Sara Plumbing");

  const organization = await prisma.organization.create({
    data: {
      name: "Acme Construction Co.",
      slug: "acme-construction",
      members: {
        create: [
          { userId: gc.id, role: "owner" },
          { userId: electrician.id, role: "member" },
          { userId: plumber.id, role: "member" },
        ],
      },
    },
  });

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 60);

  const project = await prisma.project.create({
    data: {
      organizationId: organization.id,
      name: "Riverside Apartments — Phase 1",
      startDate,
      endDate,
      members: {
        create: [
          { userId: gc.id, role: "GC_OWNER" },
          { userId: electrician.id, role: "TRADE" },
          { userId: plumber.id, role: "TRADE" },
        ],
      },
    },
    include: { members: true },
  });

  const gcMember = project.members.find((m) => m.userId === gc.id)!;
  const electricianMember = project.members.find((m) => m.userId === electrician.id)!;
  const plumberMember = project.members.find((m) => m.userId === plumber.id)!;

  function daysFromStart(days: number) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + days);
    return d;
  }

  await prisma.task.createMany({
    data: [
      {
        projectId: project.id,
        name: "Site prep & excavation",
        assignedToId: gcMember.id,
        startDate: daysFromStart(0),
        endDate: daysFromStart(5),
        status: "DONE",
      },
      {
        projectId: project.id,
        name: "Rough electrical wiring",
        assignedToId: electricianMember.id,
        startDate: daysFromStart(6),
        endDate: daysFromStart(14),
        status: "IN_PROGRESS",
      },
      {
        projectId: project.id,
        name: "Rough plumbing install",
        assignedToId: plumberMember.id,
        startDate: daysFromStart(6),
        endDate: daysFromStart(16),
        status: "IN_PROGRESS",
        isRoadblock: true,
        roadblockStatus: "OPEN",
        roadblockNote: "Waiting on permit approval from city inspector before we can continue.",
        roadblockRaisedBy: plumber.id,
      },
      {
        projectId: project.id,
        name: "Drywall installation",
        assignedToId: null,
        startDate: daysFromStart(17),
        endDate: daysFromStart(24),
        status: "NOT_STARTED",
      },
      {
        projectId: project.id,
        name: "Electrical panel inspection",
        assignedToId: electricianMember.id,
        startDate: daysFromStart(15),
        endDate: daysFromStart(15),
        status: "DELAYED",
      },
    ],
  });

  console.log("\nSeed complete!\n");
  console.log("Demo accounts (all use password: %s):", DEMO_PASSWORD);
  console.log("  GC/Owner:      jane@buildflow.dev");
  console.log("  Trade (elec):  tom@buildflow.dev");
  console.log("  Trade (plumb): sara@buildflow.dev");
  console.log(`\nOrganization: ${organization.name}`);
  console.log(`Project: ${project.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
