import { Router } from "express";
import { prisma } from "../db/index.js";
import { logger } from "../lib/logger.js";
import { jwtMiddlewareWithDevBypass, requireAuthWithDevBypass } from "../middleware/auth.js";

export const auditRoutes = Router();

function getAuth(req: import("express").Request) {
  return (req as any).auth as { userId: string; orgId: string; orgRole: string } | null;
}

auditRoutes.use(jwtMiddlewareWithDevBypass());
auditRoutes.use(requireAuthWithDevBypass());

auditRoutes.get("/", async (req, res) => {
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

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { orgId: auth.orgId };

    if (req.query.action) where.action = req.query.action;
    if (req.query.resource) where.resource = req.query.resource;
    if (req.query.userId) where.userId = req.query.userId;

    if (req.query.from || req.query.to) {
      const createdAt: Record<string, Date> = {};
      if (req.query.from) createdAt.gte = new Date(req.query.from as string);
      if (req.query.to) createdAt.lte = new Date(req.query.to as string);
      where.createdAt = createdAt;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: { user: { select: { email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      logs: logs.map((l) => ({
        id: l.id,
        action: l.action,
        resource: l.resource,
        resourceId: l.resourceId,
        userId: l.userId,
        userEmail: l.user?.email || null,
        metadata: l.metadata,
        ipAddress: l.ipAddress,
        createdAt: l.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    logger.error({ err }, "Failed to list audit logs");
    res.status(500).json({ error: "Failed to list audit logs" });
  }
});

auditRoutes.get("/export", async (req, res) => {
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

    const where: Record<string, unknown> = { orgId: auth.orgId };
    if (req.query.from || req.query.to) {
      const createdAt: Record<string, Date> = {};
      if (req.query.from) createdAt.gte = new Date(req.query.from as string);
      if (req.query.to) createdAt.lte = new Date(req.query.to as string);
      where.createdAt = createdAt;
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 10000,
      include: { user: { select: { email: true } } },
    });

    const header = "Timestamp,User,Action,Resource,ResourceID,IP,Details";
    const rows = logs.map((l) => {
      const meta = l.metadata ? JSON.stringify(l.metadata).replace(/"/g, '""') : "";
      return `${l.createdAt.toISOString()},${l.user?.email || ""},${l.action},${l.resource},${l.resourceId || ""},${l.ipAddress || ""},"${meta}"`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=audit-log.csv");
    res.send([header, ...rows].join("\n"));
  } catch (err) {
    logger.error({ err }, "Failed to export audit logs");
    res.status(500).json({ error: "Failed to export audit logs" });
  }
});
