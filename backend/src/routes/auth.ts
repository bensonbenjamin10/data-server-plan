import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/index.js";
import { signToken, hashPassword, verifyPassword } from "../services/auth.js";
import { getOrgsForUser, getActiveOrgMembership } from "../services/org.js";
import { jwtMiddleware, requireAuth } from "../middleware/auth.js";

export const authRoutes = Router();

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  orgName: z.string().min(1).optional(),
});

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const switchOrgSchema = z.object({
  orgId: z.string().min(1),
});

authRoutes.post("/sign-up", async (req, res) => {
  try {
    const body = signUpSchema.parse(req.body);
    const existing = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });
    if (existing) {
      res.status(400).json({ error: "Email already registered" });
      return;
    }
    const passwordHash = await hashPassword(body.password);
    const orgName = body.orgName || "My Organization";
    const [user, org] = await prisma.$transaction([
      prisma.user.create({
        data: {
          email: body.email.toLowerCase(),
          passwordHash,
        },
      }),
      prisma.organization.create({
        data: { name: orgName },
      }),
    ]);
    await prisma.orgMember.create({
      data: {
        orgId: org.id,
        userId: user.id,
        role: "admin",
      },
    });
    const token = signToken({
      userId: user.id,
      orgId: org.id,
      orgRole: "admin",
    });
    res.status(201).json({
      user: { id: user.id, email: user.email },
      org: { id: org.id, name: org.name },
      token,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error("[auth/sign-up]", err);
    res.status(500).json({ error: "Sign up failed" });
  }
});

authRoutes.post("/sign-in", async (req, res) => {
  try {
    const body = signInSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    const ok = await verifyPassword(body.password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    const orgs = await getOrgsForUser(user.id);
    if (orgs.length === 0) {
      res.status(403).json({ error: "No organization membership" });
      return;
    }
    const first = orgs[0];
    const token = signToken({
      userId: user.id,
      orgId: first.id,
      orgRole: first.role,
    });
    res.json({
      user: { id: user.id, email: user.email },
      org: { id: first.id, name: first.name },
      orgs,
      token,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error("[auth/sign-in]", err);
    res.status(500).json({ error: "Sign in failed" });
  }
});

authRoutes.get("/me", jwtMiddleware(), requireAuth(), async (req, res) => {
  const auth = (req as any).auth;
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, email: true },
  });
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  const orgs = await getOrgsForUser(auth.userId);
  const current = orgs.find((o) => o.id === auth.orgId);
  res.json({
    userId: auth.userId,
    user: { id: user.id, email: user.email },
    orgId: auth.orgId,
    orgRole: auth.orgRole,
    orgs,
    org: current ? { id: current.id, name: current.name } : null,
  });
});

authRoutes.get("/profile", jwtMiddleware(), requireAuth(), async (req, res) => {
  try {
    const auth = (req as any).auth;
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { id: true, email: true, createdAt: true },
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const orgs = await getOrgsForUser(auth.userId);
    const [filesUploaded, sizeResult] = await Promise.all([
      prisma.file.count({ where: { uploadedById: auth.userId } }),
      prisma.file.aggregate({
        where: { uploadedById: auth.userId },
        _sum: { size: true },
      }),
    ]);
    res.json({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
      orgs,
      filesUploaded,
      totalStorageUsed: sizeResult._sum.size ?? 0,
    });
  } catch (err) {
    console.error("[auth/profile]", err);
    res.status(500).json({ error: "Failed to get profile" });
  }
});

authRoutes.patch("/profile", jwtMiddleware(), requireAuth(), async (req, res) => {
  try {
    const auth = (req as any).auth;
    const { email, currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: auth.userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const data: { email?: string; passwordHash?: string } = {};

    if (email && email !== user.email) {
      const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (existing) {
        res.status(400).json({ error: "Email already in use" });
        return;
      }
      data.email = email.toLowerCase();
    }

    if (newPassword) {
      if (!currentPassword) {
        res.status(400).json({ error: "Current password required" });
        return;
      }
      const ok = await verifyPassword(currentPassword, user.passwordHash);
      if (!ok) {
        res.status(401).json({ error: "Current password is incorrect" });
        return;
      }
      data.passwordHash = await hashPassword(newPassword);
    }

    if (Object.keys(data).length === 0) {
      res.json({ message: "No changes" });
      return;
    }

    await prisma.user.update({ where: { id: auth.userId }, data });
    res.json({ message: "Profile updated" });
  } catch (err) {
    console.error("[auth/profile]", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

authRoutes.post("/switch-org", jwtMiddleware(), requireAuth(), async (req, res) => {
  try {
    const body = switchOrgSchema.parse(req.body);
    const auth = (req as any).auth;
    const membership = await getActiveOrgMembership(auth.userId, body.orgId);
    if (!membership) {
      res.status(403).json({ error: "Not a member of this organization" });
      return;
    }
    const token = signToken({
      userId: auth.userId,
      orgId: membership.orgId,
      orgRole: membership.orgRole,
    });
    res.json({ token });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error("[auth/switch-org]", err);
    res.status(500).json({ error: "Switch org failed" });
  }
});
