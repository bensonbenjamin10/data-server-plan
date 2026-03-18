import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/index.js";
import { jwtMiddlewareWithDevBypass, requireAuthWithDevBypass } from "../middleware/auth.js";
import { hashPassword } from "../services/auth.js";

export const orgRoutes = Router();

function getAuth(req: import("express").Request) {
  return (req as any).auth as { userId: string; orgId: string; orgRole: string } | null;
}

orgRoutes.use(jwtMiddlewareWithDevBypass());
orgRoutes.use(requireAuthWithDevBypass());

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
      where: { orgId: auth.orgId },
      _sum: { size: true },
    });
    res.json({
      id: org.id,
      name: org.name,
      createdAt: org.createdAt.toISOString(),
      memberCount: org._count.members,
      totalStorage: sizeResult._sum.size ?? 0,
    });
  } catch (err) {
    console.error("[org/get]", err);
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
    res.json({ id: updated.id, name: updated.name });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error("[org/update]", err);
    res.status(500).json({ error: "Failed to update org" });
  }
});

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
    console.error("[org/members]", err);
    res.status(500).json({ error: "Failed to list members" });
  }
});

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

    let user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      const tempHash = await hashPassword(Math.random().toString(36).slice(2) + "Aa1!");
      user = await prisma.user.create({
        data: { email: email.toLowerCase(), passwordHash: tempHash },
      });
    }

    const existing = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId: auth.orgId, userId: user.id } },
    });
    if (existing) {
      res.status(400).json({ error: "User is already a member" });
      return;
    }

    const member = await prisma.orgMember.create({
      data: { orgId: auth.orgId, userId: user.id, role },
    });
    res.status(201).json({
      id: member.id,
      userId: user.id,
      email: user.email,
      role: member.role,
      createdAt: member.createdAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error("[org/invite]", err);
    res.status(500).json({ error: "Failed to invite member" });
  }
});

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
    const updated = await prisma.orgMember.update({
      where: { id: req.params.id },
      data: { role },
    });
    res.json({ id: updated.id, role: updated.role });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error("[org/role]", err);
    res.status(500).json({ error: "Failed to update role" });
  }
});

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
    res.status(204).send();
  } catch (err) {
    console.error("[org/remove]", err);
    res.status(500).json({ error: "Failed to remove member" });
  }
});
