import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../db/index.js";
import {
  signToken,
  hashPassword,
  verifyPassword,
  generateRefreshToken,
  REFRESH_TOKEN_EXPIRY_MS,
  ACCESS_TOKEN_EXPIRY,
} from "../services/auth.js";
import { getOrgsForUser, getActiveOrgMembership } from "../services/org.js";
import { jwtMiddleware, requireAuth } from "../middleware/auth.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "../services/email.js";
import { logAuditEvent } from "../services/audit.js";
import { logger } from "../lib/logger.js";

export const authRoutes = Router();

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

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

function getClientIp(req: import("express").Request): string | null {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || null;
}

function setRefreshTokenCookie(res: import("express").Response, token: string) {
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie("refresh_token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: REFRESH_TOKEN_EXPIRY_MS,
    path: "/api/auth",
  });
}

function clearRefreshTokenCookie(res: import("express").Response) {
  const isProduction = process.env.NODE_ENV === "production";
  res.clearCookie("refresh_token", {
    path: "/api/auth",
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
  });
}

// ── Sign Up ──

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
          emailVerified: false,
        },
      }),
      prisma.organization.create({
        data: { name: orgName },
      }),
    ]);
    await prisma.orgMember.create({
      data: { orgId: org.id, userId: user.id, role: "admin" },
    });

    const verifyToken = crypto.randomBytes(32).toString("hex");
    await prisma.emailVerification.create({
      data: {
        userId: user.id,
        token: verifyToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    sendVerificationEmail(user.email, verifyToken).catch(() => {});

    const refreshToken = generateRefreshToken();
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        ipAddress: getClientIp(req),
        userAgent: req.headers["user-agent"] || null,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
      },
    });

    const accessToken = signToken({
      userId: user.id,
      orgId: org.id,
      orgRole: "admin",
    });

    setRefreshTokenCookie(res, refreshToken);
    logAuditEvent({ orgId: org.id, userId: user.id, action: "auth.sign_up", resource: "user", resourceId: user.id, req });

    res.status(201).json({
      user: { id: user.id, email: user.email, emailVerified: false },
      org: { id: org.id, name: org.name },
      token: accessToken,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    logger.error({ err }, "Sign up failed");
    res.status(500).json({ error: "Sign up failed" });
  }
});

// ── Sign In ──

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

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      res.status(423).json({ error: `Account locked. Try again in ${minutesLeft} minute(s).` });
      return;
    }

    const ok = await verifyPassword(body.password, user.passwordHash);
    if (!ok) {
      const newAttempts = user.failedAttempts + 1;
      const updateData: { failedAttempts: number; lockedUntil?: Date } = { failedAttempts: newAttempts };
      if (newAttempts >= LOCKOUT_THRESHOLD) {
        updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      }
      await prisma.user.update({ where: { id: user.id }, data: updateData });
      logAuditEvent({ userId: user.id, action: "auth.sign_in_failed", resource: "user", resourceId: user.id, metadata: { attempt: newAttempts }, req });
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: getClientIp(req),
      },
    });

    const orgs = await getOrgsForUser(user.id);

    const refreshToken = generateRefreshToken();
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        ipAddress: getClientIp(req),
        userAgent: req.headers["user-agent"] || null,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
      },
    });

    const first = orgs[0];
    const accessToken = first
      ? signToken({ userId: user.id, orgId: first.id, orgRole: first.role })
      : signToken({ userId: user.id, orgId: "", orgRole: "" });

    setRefreshTokenCookie(res, refreshToken);
    logAuditEvent({ orgId: first?.id, userId: user.id, action: "auth.sign_in", resource: "user", resourceId: user.id, req });

    res.json({
      user: { id: user.id, email: user.email, emailVerified: user.emailVerified },
      org: first ? { id: first.id, name: first.name } : null,
      orgs,
      token: accessToken,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    logger.error({ err }, "Sign in failed");
    res.status(500).json({ error: "Sign in failed" });
  }
});

// ── Refresh Token ──

authRoutes.post("/refresh", async (req, res) => {
  try {
    const refreshTokenValue = req.cookies?.refresh_token;
    if (!refreshTokenValue) {
      res.status(401).json({ error: "No refresh token" });
      return;
    }

    const session = await prisma.session.findUnique({
      where: { refreshToken: refreshTokenValue },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      clearRefreshTokenCookie(res);
      res.status(401).json({ error: "Invalid or expired refresh token" });
      return;
    }

    const newRefreshToken = generateRefreshToken();
    await prisma.session.update({
      where: { id: session.id },
      data: {
        refreshToken: newRefreshToken,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
      },
    });

    const orgs = await getOrgsForUser(session.userId);
    const first = orgs[0];
    const accessToken = first
      ? signToken({ userId: session.userId, orgId: first.id, orgRole: first.role })
      : signToken({ userId: session.userId, orgId: "", orgRole: "" });

    setRefreshTokenCookie(res, newRefreshToken);

    res.json({
      token: accessToken,
      user: { id: session.user.id, email: session.user.email, emailVerified: session.user.emailVerified },
      org: first ? { id: first.id, name: first.name } : null,
      orgs,
    });
  } catch (err) {
    logger.error({ err }, "Token refresh failed");
    res.status(500).json({ error: "Token refresh failed" });
  }
});

// ── Sign Out ──

authRoutes.post("/sign-out", async (req, res) => {
  try {
    const refreshTokenValue = req.cookies?.refresh_token;
    if (refreshTokenValue) {
      await prisma.session.updateMany({
        where: { refreshToken: refreshTokenValue, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    clearRefreshTokenCookie(res);
    const auth = (req as any).auth;
    if (auth?.userId) {
      logAuditEvent({ userId: auth.userId, action: "auth.sign_out", resource: "session", req });
    }
    res.json({ message: "Signed out" });
  } catch (err) {
    logger.error({ err }, "Sign out failed");
    res.status(500).json({ error: "Sign out failed" });
  }
});

// ── Me ──

authRoutes.get("/me", jwtMiddleware(), requireAuth(), async (req, res) => {
  const auth = (req as any).auth;
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, email: true, emailVerified: true },
  });
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  const orgs = await getOrgsForUser(auth.userId);
  const current = orgs.find((o) => o.id === auth.orgId);
  res.json({
    userId: auth.userId,
    user: { id: user.id, email: user.email, emailVerified: user.emailVerified },
    orgId: auth.orgId,
    orgRole: auth.orgRole,
    orgs,
    org: current ? { id: current.id, name: current.name } : null,
  });
});

// ── Profile ──

authRoutes.get("/profile", jwtMiddleware(), requireAuth(), async (req, res) => {
  try {
    const auth = (req as any).auth;
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { id: true, email: true, emailVerified: true, createdAt: true },
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
      emailVerified: user.emailVerified,
      createdAt: user.createdAt.toISOString(),
      orgs,
      filesUploaded,
      totalStorageUsed: sizeResult._sum.size ?? 0,
    });
  } catch (err) {
    logger.error({ err }, "Failed to get profile");
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

    if (data.passwordHash) {
      logAuditEvent({ userId: auth.userId, orgId: auth.orgId, action: "auth.password_change", resource: "user", resourceId: auth.userId, req });
    }

    res.json({ message: "Profile updated" });
  } catch (err) {
    logger.error({ err }, "Failed to update profile");
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// ── Switch Org ──

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
    logger.error({ err }, "Switch org failed");
    res.status(500).json({ error: "Switch org failed" });
  }
});

// ── Email Verification ──

authRoutes.post("/verify-email", async (req, res) => {
  try {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.body);
    const record = await prisma.emailVerification.findUnique({ where: { token } });
    if (!record || record.expiresAt < new Date()) {
      res.status(400).json({ error: "Invalid or expired verification link" });
      return;
    }
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } }),
      prisma.emailVerification.delete({ where: { id: record.id } }),
    ]);
    logAuditEvent({ userId: record.userId, action: "auth.email_verified", resource: "user", resourceId: record.userId, req });
    res.json({ message: "Email verified" });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    logger.error({ err }, "Verification failed");
    res.status(500).json({ error: "Verification failed" });
  }
});

authRoutes.post("/resend-verification", jwtMiddleware(), requireAuth(), async (req, res) => {
  try {
    const auth = (req as any).auth;
    const user = await prisma.user.findUnique({ where: { id: auth.userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (user.emailVerified) {
      res.json({ message: "Email already verified" });
      return;
    }
    await prisma.emailVerification.deleteMany({ where: { userId: user.id } });
    const verifyToken = crypto.randomBytes(32).toString("hex");
    await prisma.emailVerification.create({
      data: {
        userId: user.id,
        token: verifyToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    await sendVerificationEmail(user.email, verifyToken);
    res.json({ message: "Verification email sent" });
  } catch (err) {
    logger.error({ err }, "Failed to resend verification");
    res.status(500).json({ error: "Failed to resend verification" });
  }
});

// ── Password Reset ──

authRoutes.post("/forgot-password", async (req, res) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (user) {
      await prisma.passwordReset.deleteMany({ where: { userId: user.id } });
      const token = crypto.randomBytes(32).toString("hex");
      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          token,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      sendPasswordResetEmail(user.email, token).catch(() => {});
    }
    res.json({ message: "If an account exists with that email, a reset link has been sent." });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    logger.error({ err }, "Forgot password failed");
    res.status(500).json({ error: "Failed to process request" });
  }
});

authRoutes.get("/reset-password/:token", async (req, res) => {
  try {
    const record = await prisma.passwordReset.findUnique({ where: { token: req.params.token } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      res.status(400).json({ error: "Invalid or expired reset link" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: record.userId }, select: { email: true } });
    res.json({ email: user?.email });
  } catch (err) {
    logger.error({ err }, "Reset password validation failed");
    res.status(500).json({ error: "Failed to validate reset token" });
  }
});

authRoutes.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = z
      .object({ token: z.string().min(1), newPassword: z.string().min(8) })
      .parse(req.body);

    const record = await prisma.passwordReset.findUnique({ where: { token } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      res.status(400).json({ error: "Invalid or expired reset link" });
      return;
    }

    const newHash = await hashPassword(newPassword);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash: newHash, failedAttempts: 0, lockedUntil: null } }),
      prisma.passwordReset.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      prisma.session.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);

    logAuditEvent({ userId: record.userId, action: "auth.password_reset", resource: "user", resourceId: record.userId, req });
    res.json({ message: "Password has been reset. Please sign in." });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    logger.error({ err }, "Password reset failed");
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// ── Accept Invite ──

authRoutes.get("/invite/:token", async (req, res) => {
  try {
    const invite = await prisma.invite.findUnique({
      where: { token: req.params.token },
      include: { organization: { select: { name: true } } },
    });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      res.status(400).json({ error: "Invalid or expired invitation" });
      return;
    }
    const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });
    res.json({
      orgName: invite.organization.name,
      role: invite.role,
      email: invite.email,
      existingUser: !!existingUser,
    });
  } catch (err) {
    logger.error({ err }, "Invite validation failed");
    res.status(500).json({ error: "Failed to validate invite" });
  }
});

authRoutes.post("/accept-invite", async (req, res) => {
  try {
    const { token, password } = z
      .object({ token: z.string().min(1), password: z.string().min(8).optional() })
      .parse(req.body);

    const invite = await prisma.invite.findUnique({
      where: { token },
      include: { organization: true },
    });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      res.status(400).json({ error: "Invalid or expired invitation" });
      return;
    }

    let user = await prisma.user.findUnique({ where: { email: invite.email } });

    if (!user) {
      if (!password) {
        res.status(400).json({ error: "Password is required for new accounts" });
        return;
      }
      const passwordHash = await hashPassword(password);
      user = await prisma.user.create({
        data: { email: invite.email, passwordHash, emailVerified: true },
      });
    }

    const existingMember = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId: invite.orgId, userId: user.id } },
    });
    if (existingMember) {
      await prisma.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
      res.status(400).json({ error: "You are already a member of this organization" });
      return;
    }

    await prisma.$transaction([
      prisma.orgMember.create({ data: { orgId: invite.orgId, userId: user.id, role: invite.role } }),
      prisma.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
    ]);

    const refreshToken = generateRefreshToken();
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        ipAddress: getClientIp(req),
        userAgent: req.headers["user-agent"] || null,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
      },
    });

    const accessToken = signToken({ userId: user.id, orgId: invite.orgId, orgRole: invite.role });
    setRefreshTokenCookie(res, refreshToken);

    logAuditEvent({ orgId: invite.orgId, userId: user.id, action: "member.invite_accept", resource: "invite", resourceId: invite.id, req });

    res.json({
      user: { id: user.id, email: user.email, emailVerified: user.emailVerified },
      org: { id: invite.organization.id, name: invite.organization.name },
      token: accessToken,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    logger.error({ err }, "Accept invite failed");
    res.status(500).json({ error: "Failed to accept invitation" });
  }
});

// ── Sessions ──

authRoutes.get("/sessions", jwtMiddleware(), requireAuth(), async (req, res) => {
  try {
    const auth = (req as any).auth;
    const sessions = await prisma.session.findMany({
      where: { userId: auth.userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, ipAddress: true, userAgent: true, createdAt: true },
    });
    res.json({ sessions });
  } catch (err) {
    logger.error({ err }, "Failed to list sessions");
    res.status(500).json({ error: "Failed to list sessions" });
  }
});

authRoutes.delete("/sessions/:id", jwtMiddleware(), requireAuth(), async (req, res) => {
  try {
    const auth = (req as any).auth;
    const session = await prisma.session.findFirst({
      where: { id: req.params.id, userId: auth.userId },
    });
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    logAuditEvent({ userId: auth.userId, action: "session.revoke", resource: "session", resourceId: session.id, req });
    res.json({ message: "Session revoked" });
  } catch (err) {
    logger.error({ err }, "Failed to revoke session");
    res.status(500).json({ error: "Failed to revoke session" });
  }
});

// ── My Access Requests ──

authRoutes.get("/my-requests", jwtMiddleware(), requireAuth(), async (req, res) => {
  try {
    const auth = (req as any).auth;
    const requests = await prisma.accessRequest.findMany({
      where: { userId: auth.userId },
      include: { organization: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({
      requests: requests.map((r) => ({
        id: r.id,
        orgId: r.orgId,
        orgName: r.organization.name,
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

// ── Data Export (GDPR) ──

authRoutes.get("/export-data", jwtMiddleware(), requireAuth(), async (req, res) => {
  try {
    const auth = (req as any).auth;
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { id: true, email: true, emailVerified: true, createdAt: true },
    });
    const memberships = await prisma.orgMember.findMany({
      where: { userId: auth.userId },
      include: { organization: { select: { name: true } } },
    });
    const files = await prisma.file.findMany({
      where: { uploadedById: auth.userId },
      select: { id: true, name: true, size: true, mimeType: true, createdAt: true },
    });
    const auditLogs = await prisma.auditLog.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    res.json({ user, memberships, files, auditLogs });
  } catch (err) {
    logger.error({ err }, "Failed to export data");
    res.status(500).json({ error: "Failed to export data" });
  }
});

authRoutes.delete("/delete-account", jwtMiddleware(), requireAuth(), async (req, res) => {
  try {
    const auth = (req as any).auth;
    const { password } = z.object({ password: z.string().min(1) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: auth.userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: "Incorrect password" });
      return;
    }
    await prisma.auditLog.updateMany({
      where: { userId: auth.userId },
      data: { userId: null, metadata: { anonymized: true } },
    });
    await prisma.user.delete({ where: { id: auth.userId } });
    clearRefreshTokenCookie(res);
    res.json({ message: "Account deleted" });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    logger.error({ err }, "Failed to delete account");
    res.status(500).json({ error: "Failed to delete account" });
  }
});
