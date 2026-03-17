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
