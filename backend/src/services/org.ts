import { prisma } from "../db/index.js";

export interface OrgWithRole {
  id: string;
  name: string;
  role: string;
}

export async function getOrgsForUser(userId: string): Promise<OrgWithRole[]> {
  const memberships = await prisma.orgMember.findMany({
    where: { userId },
    include: { organization: true },
  });
  return memberships.map((m: { organization: { id: string; name: string }; role: string }) => ({
    id: m.organization.id,
    name: m.organization.name,
    role: m.role,
  }));
}

export async function getActiveOrgMembership(
  userId: string,
  orgId: string
): Promise<{ orgId: string; orgRole: string } | null> {
  const membership = await prisma.orgMember.findUnique({
    where: {
      orgId_userId: { orgId, userId },
    },
  });
  if (!membership) return null;
  return { orgId: membership.orgId, orgRole: membership.role };
}
