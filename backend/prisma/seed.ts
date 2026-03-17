import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEV_PASSWORD = "dev123";

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: "dev-org-id" },
    create: {
      id: "dev-org-id",
      name: "Development Organization",
    },
    update: {},
  });

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { id: "dev-user-id" },
    create: {
      id: "dev-user-id",
      email: "dev@example.com",
      passwordHash,
    },
    update: { passwordHash },
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

  console.log("Seed complete:", { org: org.name, user: user.email, devPassword: DEV_PASSWORD });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
