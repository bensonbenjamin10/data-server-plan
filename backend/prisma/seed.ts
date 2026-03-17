import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: "dev-org-id" },
    create: {
      id: "dev-org-id",
      name: "Development Organization",
    },
    update: {},
  });

  const user = await prisma.user.upsert({
    where: { id: "dev-user-id" },
    create: {
      id: "dev-user-id",
      email: "dev@example.com",
    },
    update: {},
  });

  await prisma.orgMember.upsert({
    where: {
      orgId_userId: { orgId: org.id, userId: user.id },
    },
    create: {
      orgId: org.id,
      userId: user.id,
      role: "admin",
    },
    update: {},
  });

  console.log("Seed complete:", { org: org.name, user: user.email });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
