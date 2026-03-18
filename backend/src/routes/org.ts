import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../db/index.js";
import { logger } from "../lib/logger.js";
import { jwtMiddlewareWithDevBypass, requireAuthWithDevBypass, jwtMiddleware, requireAuth } from "../middleware/auth.js";
import {
  sendInviteEmail,
  sendAccessRequestNotification,
  sendAccessApprovedEmail,
  sendAccessDeniedEmail,
} from "../services/email.js";
import { logAuditEvent } from "../services/audit.js";

export const orgRoutes = Router();

function getAuth(req: import("express").Request) {
  return (req as any).auth as { userId: string; orgId: string; orgRole: string } | null;
}

orgRoutes.use(jwtMiddlewareWithDevBypass());
orgRoutes.use(requireAuthWithDevBypass());

// ── Org info ──

orgRoutes.get("/", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth?.orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    const org = await prisma.organization.findUnique({
      where: { id: auth.orgId },
      include: { _count: { select: { members: true } } },
    });
    if (!org) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }
    const sizeResult = await prisma.file.aggregate({
      where: { orgId: auth.orgId, deletedAt: null },
      _sum: { size: true },
    });
    res.json({
      id: org.id,
      name: org.name,
      createdAt: org.createdAt.toISOString(),
      memberCount: org._count.members,
      totalStorage: sizeResult._sum.size ?? 0,
      storageQuota: Number(org.storageQuota),
    });
  } catch (err) {
    logger.error({ err }, "Failed to get org");
    res.status(500).json({ error: "Failed to get org" });
  }
});

orgRoutes.patch("/", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth?.orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    if (auth.orgRole !== "admin") {
      res.status(403).json({ error: "Admin role required" });
      return;
    }
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
    const updated = await prisma.organization.update({
      where: { id: auth.orgId },
      data: { name },
    });
    logAuditEvent({ orgId: auth.orgId, userId: auth.userId, action: "org.update", resource: "org", resourceId: auth.orgId, metadata: { name }, req });
    res.json({ id: updated.id, name: updated.name });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    logger.error({ err }, "Failed to update org");
    res.status(500).json({ error: "Failed to update org" });
  }
});

// ── Members ──

orgRoutes.get("/members", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth?.orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    const members = await prisma.orgMember.findMany({
      where: { orgId: auth.orgId },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: "asc" },
    });
    res.json({
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        email: m.user.email,
        role: m.role,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    logger.error({ err }, "Failed to list members");
    res.status(500).json({ error: "Failed to list members" });
  }
});

// ── Invite (rewritten: token-based with email) ──

orgRoutes.post("/members/invite", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth?.orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    if (auth.orgRole !== "admin") {
      res.status(403).json({ error: "Admin role required" });
      return;
    }
    const { email, role } = z
      .object({ email: z.string().email(), role: z.enum(["admin", "member", "viewer"]) })
      .parse(req.body);

    const normalizedEmail = email.toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      const existingMember = await prisma.orgMember.findUnique({
        where: { orgId_userId: { orgId: auth.orgId, userId: existingUser.id } },
      });
      if (existingMember) {
        res.status(400).json({ error: "User is already a member" });
        return;
      }
    }

    const pendingInvite = await prisma.invite.findFirst({
      where: { orgId: auth.orgId, email: normalizedEmail, acceptedAt: null, expiresAt: { gt: new Date() } },
    });
    if (pendingInvite) {
      res.status(400).json({ error: "An active invite already exists for this email" });
      return;
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invite = await prisma.invite.create({
      data: {
        orgId: auth.orgId,
        email: normalizedEmail,
        role,
        token,
        invitedBy: auth.userId,
        expiresAt,
      },
    });

    const org = await prisma.organization.findUnique({ where: { id: auth.orgId } });
    const inviter = await prisma.user.findUnique({ where: { id: auth.userId } });

    sendInviteEmail(normalizedEmail, inviter?.email || "An admin", org?.name || "an organization", token).catch(() => {});

    logAuditEvent({ orgId: auth.orgId, userId: auth.userId, action: "member.invite", resource: "invite", resourceId: invite.id, metadata: { email: normalizedEmail, role }, req });

    res.status(201).json({
      id: invite.id,
      email: normalizedEmail,
      role,
      expiresAt: invite.expiresAt.toISOString(),
      createdAt: invite.createdAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    logger.error({ err }, "Failed to invite member");
    res.status(500).json({ error: "Failed to invite member" });
  }
});

orgRoutes.get("/invites", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth?.orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    if (auth.orgRole !== "admin") {
      res.status(403).json({ error: "Admin role required" });
      return;
    }
    const invites = await prisma.invite.findMany({
      where: { orgId: auth.orgId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      include: { inviter: { select: { email: true } } },
    });
    res.json({
      invites: invites.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        invitedBy: i.inviter.email,
        expiresAt: i.expiresAt.toISOString(),
        createdAt: i.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    logger.error({ err }, "Failed to list invites");
    res.status(500).json({ error: "Failed to list invites" });
  }
});

orgRoutes.delete("/invites/:id", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth?.orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    if (auth.orgRole !== "admin") {
      res.status(403).json({ error: "Admin role required" });
      return;
    }
    const invite = await prisma.invite.findFirst({
      where: { id: req.params.id, orgId: auth.orgId },
    });
    if (!invite) {
      res.status(404).json({ error: "Invite not found" });
      return;
    }
    await prisma.invite.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    logger.error({ err }, "Failed to revoke invite");
    res.status(500).json({ error: "Failed to revoke invite" });
  }
});

// ── Role change ──

orgRoutes.patch("/members/:id/role", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth?.orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    if (auth.orgRole !== "admin") {
      res.status(403).json({ error: "Admin role required" });
      return;
    }
    const { role } = z.object({ role: z.enum(["admin", "member", "viewer"]) }).parse(req.body);
    const member = await prisma.orgMember.findFirst({
      where: { id: req.params.id, orgId: auth.orgId },
    });
    if (!member) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    const oldRole = member.role;
    const updated = await prisma.orgMember.update({
      where: { id: req.params.id },
      data: { role },
    });
    logAuditEvent({ orgId: auth.orgId, userId: auth.userId, action: "member.role_change", resource: "member", resourceId: member.id, metadata: { oldRole, newRole: role, targetUserId: member.userId }, req });
    res.json({ id: updated.id, role: updated.role });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    logger.error({ err }, "Failed to update role");
    res.status(500).json({ error: "Failed to update role" });
  }
});

// ── Remove member ──

orgRoutes.delete("/members/:id", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth?.orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    if (auth.orgRole !== "admin") {
      res.status(403).json({ error: "Admin role required" });
      return;
    }
    const member = await prisma.orgMember.findFirst({
      where: { id: req.params.id, orgId: auth.orgId },
      include: { user: { select: { email: true } } },
    });
    if (!member) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    if (member.userId === auth.userId) {
      res.status(400).json({ error: "Cannot remove yourself" });
      return;
    }
    await prisma.orgMember.delete({ where: { id: req.params.id } });
    logAuditEvent({ orgId: auth.orgId, userId: auth.userId, action: "member.remove", resource: "member", resourceId: member.id, metadata: { removedEmail: member.user.email, removedUserId: member.userId }, req });
    res.status(204).send();
  } catch (err) {
    logger.error({ err }, "Failed to remove member");
    res.status(500).json({ error: "Failed to remove member" });
  }
});

// ── Access Requests ──

orgRoutes.get("/access-requests", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth?.orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    if (auth.orgRole !== "admin") {
      res.status(403).json({ error: "Admin role required" });
      return;
    }
    const statusFilter = (req.query.status as string) || "pending";
    const requests = await prisma.accessRequest.findMany({
      where: { orgId: auth.orgId, status: statusFilter },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({
      requests: requests.map((r) => ({
        id: r.id,
        userId: r.userId,
        email: r.user.email,
        message: r.message,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    logger.error({ err }, "Failed to list access requests");
    res.status(500).json({ error: "Failed to list access requests" });
  }
});

orgRoutes.post("/access-requests/:id/approve", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth?.orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    if (auth.orgRole !== "admin") {
      res.status(403).json({ error: "Admin role required" });
      return;
    }
    const { role } = z.object({ role: z.enum(["admin", "member", "viewer"]).default("viewer") }).parse(req.body || {});

    const request = await prisma.accessRequest.findFirst({
      where: { id: req.params.id, orgId: auth.orgId, status: "pending" },
      include: { user: { select: { email: true } } },
    });
    if (!request) {
      res.status(404).json({ error: "Access request not found or already processed" });
      return;
    }

    await prisma.$transaction([
      prisma.accessRequest.update({
        where: { id: request.id },
        data: { status: "approved", reviewedBy: auth.userId, reviewedAt: new Date() },
      }),
      prisma.orgMember.create({
        data: { orgId: auth.orgId, userId: request.userId, role },
      }),
    ]);

    const org = await prisma.organization.findUnique({ where: { id: auth.orgId } });
    sendAccessApprovedEmail(request.user.email, org?.name || "the organization").catch(() => {});
    logAuditEvent({ orgId: auth.orgId, userId: auth.userId, action: "access.approve", resource: "access_request", resourceId: request.id, metadata: { approvedUserId: request.userId, role }, req });

    res.json({ message: "Access request approved" });
  } catch (err) {
    logger.error({ err }, "Failed to approve access request");
    res.status(500).json({ error: "Failed to approve access request" });
  }
});

orgRoutes.post("/access-requests/:id/deny", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth?.orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    if (auth.orgRole !== "admin") {
      res.status(403).json({ error: "Admin role required" });
      return;
    }

    const request = await prisma.accessRequest.findFirst({
      where: { id: req.params.id, orgId: auth.orgId, status: "pending" },
      include: { user: { select: { email: true } } },
    });
    if (!request) {
      res.status(404).json({ error: "Access request not found or already processed" });
      return;
    }

    await prisma.accessRequest.update({
      where: { id: request.id },
      data: { status: "denied", reviewedBy: auth.userId, reviewedAt: new Date() },
    });

    const org = await prisma.organization.findUnique({ where: { id: auth.orgId } });
    sendAccessDeniedEmail(request.user.email, org?.name || "the organization").catch(() => {});
    logAuditEvent({ orgId: auth.orgId, userId: auth.userId, action: "access.deny", resource: "access_request", resourceId: request.id, metadata: { deniedUserId: request.userId }, req });

    res.json({ message: "Access request denied" });
  } catch (err) {
    logger.error({ err }, "Failed to deny access request");
    res.status(500).json({ error: "Failed to deny access request" });
  }
});

// ── Search orgs (for request-access flow, requires auth but not org context) ──

orgRoutes.get("/search", async (req, res) => {
  try {
    const q = (req.query.q as string || "").trim();
    if (q.length < 2) {
      res.json({ organizations: [] });
      return;
    }
    const orgs = await prisma.organization.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true },
      take: 10,
    });
    res.json({ organizations: orgs });
  } catch (err) {
    logger.error({ err }, "Failed to search organizations");
    res.status(500).json({ error: "Failed to search organizations" });
  }
});

// ── Request access to an org ──

orgRoutes.post("/:orgId/request-access", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth?.userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const { message } = z.object({ message: z.string().max(500).optional() }).parse(req.body || {});
    const orgId = req.params.orgId;

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    const existingMember = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId, userId: auth.userId } },
    });
    if (existingMember) {
      res.status(400).json({ error: "You are already a member of this organization" });
      return;
    }

    const existingRequest = await prisma.accessRequest.findUnique({
      where: { orgId_userId: { orgId, userId: auth.userId } },
    });
    if (existingRequest && existingRequest.status === "pending") {
      res.status(400).json({ error: "You already have a pending request for this organization" });
      return;
    }

    const request = existingRequest
      ? await prisma.accessRequest.update({
          where: { id: existingRequest.id },
          data: { status: "pending", message, reviewedBy: null, reviewedAt: null },
        })
      : await prisma.accessRequest.create({
          data: { orgId, userId: auth.userId, message },
        });

    const adminMembers = await prisma.orgMember.findMany({
      where: { orgId, role: "admin" },
      include: { user: { select: { email: true } } },
    });
    const adminEmails = adminMembers.map((m) => m.user.email);
    const requester = await prisma.user.findUnique({ where: { id: auth.userId } });
    if (adminEmails.length > 0 && requester) {
      sendAccessRequestNotification(adminEmails, requester.email, org.name).catch(() => {});
    }

    logAuditEvent({ orgId, userId: auth.userId, action: "access.request", resource: "access_request", resourceId: request.id, metadata: { message }, req });

    res.status(201).json({
      id: request.id,
      orgId,
      orgName: org.name,
      status: "pending",
      createdAt: request.createdAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    logger.error({ err }, "Failed to submit access request");
    res.status(500).json({ error: "Failed to submit access request" });
  }
});

// ── Storage info ──

orgRoutes.get("/storage", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth?.orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    const org = await prisma.organization.findUnique({ where: { id: auth.orgId } });
    if (!org) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }
    const sizeResult = await prisma.file.aggregate({
      where: { orgId: auth.orgId, deletedAt: null },
      _sum: { size: true },
    });
    res.json({
      used: sizeResult._sum.size ?? 0,
      quota: Number(org.storageQuota),
    });
  } catch (err) {
    logger.error({ err }, "Failed to get storage info");
    res.status(500).json({ error: "Failed to get storage info" });
  }
});
