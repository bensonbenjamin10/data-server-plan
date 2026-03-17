import { prisma } from "../db/index.js";

/**
 * Resolves Clerk's orgId (e.g. org_xxx) to our internal Organization.id.
 * Creates the org if it doesn't exist (for first-time use).
 */
export async function resolveOrgId(clerkOrgId: string): Promise<string> {
  const existing = await prisma.organization.findUnique({
    where: { clerkOrgId },
  });
  if (existing) return existing.id;

  const created = await prisma.organization.create({
    data: {
      name: "Organization",
      clerkOrgId,
    },
  });
  return created.id;
}
