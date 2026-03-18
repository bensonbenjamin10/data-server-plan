import { Router } from "express";
import { z } from "zod";
import { getPresignedGetUrl, deleteObject } from "../services/r2.js";
import { logger } from "../lib/logger.js";
import { jwtMiddlewareWithDevBypass, requireAuthWithDevBypass } from "../middleware/auth.js";
import { requireDownload, requireUpload } from "../middleware/rbac.js";
import { prisma } from "../db/index.js";
import { logAuditEvent } from "../services/audit.js";

export const filesRoutes = Router();

function categorizeMime(mime: string | null): string {
  if (!mime) return "other";
  if (mime.startsWith("image/")) return "images";
  if (mime.startsWith("video/")) return "videos";
  if (mime.startsWith("audio/")) return "audio";
  if (
    mime.startsWith("text/") ||
    mime === "application/pdf" ||
    mime.includes("document") ||
    mime.includes("spreadsheet") ||
    mime.includes("presentation")
  ) return "documents";
  return "other";
}

const updateFileSchema = z.object({
  name: z.string().min(1).optional(),
  folderId: z.string().nullable().optional(),
});

function getAuth(req: import("express").Request) {
  return (req as any).auth as { userId: string; orgId: string; orgRole: string } | null;
}

function getOrgId(req: import("express").Request): string | null {
  return (req as any).auth?.orgId ?? null;
}

filesRoutes.use(jwtMiddlewareWithDevBypass());
filesRoutes.use(requireAuthWithDevBypass());

filesRoutes.get("/", requireDownload, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    const folderId = req.query.folderId as string | undefined;
    const files = await prisma.file.findMany({
      where: {
        orgId,
        folderId: folderId || null,
        deletedAt: null,
      },
      include: {
        folder: true,
        uploadedBy: { select: { email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ files });
  } catch (err) {
    logger.error({ err }, "Failed to list files");
    res.status(500).json({ error: "Failed to list files" });
  }
});

filesRoutes.get("/dashboard-stats", requireDownload, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const activeFilter = { orgId, deletedAt: null };

    const [fileCount, folderCount, sizeResult, recentUploadsCount, allFiles] = await Promise.all([
      prisma.file.count({ where: activeFilter }),
      prisma.folder.count({ where: { orgId } }),
      prisma.file.aggregate({ where: activeFilter, _sum: { size: true } }),
      prisma.file.count({ where: { ...activeFilter, createdAt: { gte: sevenDaysAgo } } }),
      prisma.file.findMany({
        where: activeFilter,
        select: { mimeType: true, size: true, createdAt: true },
      }),
    ]);

    const totalSize = sizeResult._sum.size ?? 0;

    const typeMap: Record<string, { count: number; size: number }> = {};
    const monthMap: Record<string, number> = {};

    for (const f of allFiles) {
      const cat = categorizeMime(f.mimeType);
      if (!typeMap[cat]) typeMap[cat] = { count: 0, size: 0 };
      typeMap[cat].count++;
      typeMap[cat].size += f.size;

      const month = `${f.createdAt.getFullYear()}-${String(f.createdAt.getMonth() + 1).padStart(2, "0")}`;
      if (f.createdAt >= sixMonthsAgo) {
        monthMap[month] = (monthMap[month] || 0) + f.size;
      }
    }

    const filesByType = Object.entries(typeMap).map(([category, data]) => ({
      category,
      ...data,
    }));

    const storageTimeline = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, size]) => ({ month, size }));

    res.json({
      fileCount,
      folderCount,
      totalSize,
      recentUploads: recentUploadsCount,
      filesByType,
      storageTimeline,
    });
  } catch (err) {
    logger.error({ err }, "Failed to get dashboard stats");
    res.status(500).json({ error: "Failed to get dashboard stats" });
  }
});

filesRoutes.get("/storage-breakdown", requireDownload, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }

    const allFiles = await prisma.file.findMany({
      where: { orgId, deletedAt: null },
      select: { id: true, name: true, mimeType: true, size: true, createdAt: true },
      orderBy: { size: "desc" },
    });

    const typeMap: Record<string, { count: number; size: number }> = {};
    for (const f of allFiles) {
      const cat = categorizeMime(f.mimeType);
      if (!typeMap[cat]) typeMap[cat] = { count: 0, size: 0 };
      typeMap[cat].count++;
      typeMap[cat].size += f.size;
    }

    const byType = Object.entries(typeMap).map(([category, data]) => ({
      category,
      ...data,
    }));

    const largestFiles = allFiles.slice(0, 5).map((f) => ({
      id: f.id,
      name: f.name,
      size: f.size,
      mimeType: f.mimeType,
    }));

    const totalSize = allFiles.reduce((acc, f) => acc + f.size, 0);

    res.json({ byType, largestFiles, totalSize, fileCount: allFiles.length });
  } catch (err) {
    logger.error({ err }, "Failed to get storage breakdown");
    res.status(500).json({ error: "Failed to get storage breakdown" });
  }
});

filesRoutes.get("/stats", requireDownload, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    const [fileCount, sizeResult] = await Promise.all([
      prisma.file.count({ where: { orgId, deletedAt: null } }),
      prisma.file.aggregate({ where: { orgId, deletedAt: null }, _sum: { size: true } }),
    ]);
    const totalSize = sizeResult._sum.size ?? 0;
    res.json({ fileCount, totalSize });
  } catch (err) {
    logger.error({ err }, "Failed to get stats");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

filesRoutes.get("/recent", requireDownload, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    const limit = Math.min(parseInt((req.query.limit as string) || "10", 10) || 10, 50);
    const files = await prisma.file.findMany({
      where: { orgId, deletedAt: null },
      include: { folder: { select: { name: true, id: true } } },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });
    res.json({ files });
  } catch (err) {
    logger.error({ err }, "Failed to list recent files");
    res.status(500).json({ error: "Failed to list recent files" });
  }
});

// ── Trash ──

filesRoutes.get("/trash", requireUpload, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    const files = await prisma.file.findMany({
      where: { orgId, deletedAt: { not: null } },
      include: { uploadedBy: { select: { email: true } } },
      orderBy: { deletedAt: "desc" },
    });
    res.json({ files });
  } catch (err) {
    logger.error({ err }, "Failed to list trash");
    res.status(500).json({ error: "Failed to list trash" });
  }
});

filesRoutes.post("/:id/restore", requireUpload, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const auth = getAuth(req);
    if (!orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    const file = await prisma.file.findFirst({ where: { id: req.params.id, orgId, deletedAt: { not: null } } });
    if (!file) {
      res.status(404).json({ error: "File not found in trash" });
      return;
    }
    await prisma.file.update({ where: { id: file.id }, data: { deletedAt: null, deletedById: null } });
    logAuditEvent({ orgId, userId: auth?.userId, action: "file.restore", resource: "file", resourceId: file.id, metadata: { name: file.name }, req });
    res.json({ message: "File restored" });
  } catch (err) {
    logger.error({ err }, "Failed to restore file");
    res.status(500).json({ error: "Failed to restore file" });
  }
});

filesRoutes.delete("/:id/permanent", requireUpload, async (req, res) => {
  try {
    const auth = getAuth(req);
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    if (auth?.orgRole !== "admin") {
      res.status(403).json({ error: "Admin role required for permanent deletion" });
      return;
    }
    const file = await prisma.file.findFirst({ where: { id: req.params.id, orgId } });
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    await deleteObject(file.r2Key);
    await prisma.file.delete({ where: { id: file.id } });
    logAuditEvent({ orgId, userId: auth.userId, action: "file.permanent_delete", resource: "file", resourceId: file.id, metadata: { name: file.name, size: file.size }, req });
    res.status(204).send();
  } catch (err) {
    logger.error({ err }, "Failed to permanently delete file");
    res.status(500).json({ error: "Failed to permanently delete file" });
  }
});

// ── Download ──

filesRoutes.get("/:id/download", requireDownload, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const auth = getAuth(req);
    if (!orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    const { id } = req.params;
    const file = await prisma.file.findFirst({ where: { id, orgId, deletedAt: null } });
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    const url = await getPresignedGetUrl(file.r2Key);
    logAuditEvent({ orgId, userId: auth?.userId, action: "file.download", resource: "file", resourceId: file.id, metadata: { name: file.name }, req });
    res.json({ url, name: file.name });
  } catch (err) {
    logger.error({ err }, "Failed to generate download URL");
    res.status(500).json({ error: "Failed to generate download URL" });
  }
});

// ── Update ──

filesRoutes.patch("/:id", requireUpload, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const auth = getAuth(req);
    if (!orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    const { id } = req.params;
    const body = updateFileSchema.parse(req.body);
    const file = await prisma.file.findFirst({ where: { id, orgId, deletedAt: null } });
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    const data: { name?: string; folderId?: string | null } = {};
    const auditMeta: Record<string, unknown> = {};

    if (body.name !== undefined) {
      auditMeta.oldName = file.name;
      auditMeta.newName = body.name;
      data.name = body.name;
    }
    if (body.folderId !== undefined) {
      if (body.folderId) {
        const folder = await prisma.folder.findFirst({ where: { id: body.folderId, orgId } });
        if (!folder) {
          res.status(404).json({ error: "Folder not found" });
          return;
        }
      }
      auditMeta.oldFolderId = file.folderId;
      auditMeta.newFolderId = body.folderId;
      data.folderId = body.folderId;
    }
    const updated = await prisma.file.update({ where: { id }, data });
    const action = body.folderId !== undefined ? "file.move" : "file.rename";
    logAuditEvent({ orgId, userId: auth?.userId, action, resource: "file", resourceId: file.id, metadata: auditMeta, req });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    logger.error({ err }, "Failed to update file");
    res.status(500).json({ error: "Failed to update file" });
  }
});

// ── Soft Delete ──

filesRoutes.delete("/:id", requireUpload, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const auth = getAuth(req);
    if (!orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    const { id } = req.params;
    const file = await prisma.file.findFirst({ where: { id, orgId, deletedAt: null } });
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    await prisma.file.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: auth?.userId || null },
    });
    logAuditEvent({ orgId, userId: auth?.userId, action: "file.delete", resource: "file", resourceId: file.id, metadata: { name: file.name, size: file.size }, req });
    res.status(204).send();
  } catch (err) {
    logger.error({ err }, "Failed to delete file");
    res.status(500).json({ error: "Failed to delete file" });
  }
});

// ── Versions ──

filesRoutes.get("/:id/versions", requireDownload, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    const file = await prisma.file.findFirst({ where: { id: req.params.id, orgId } });
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    const versions = await prisma.fileVersion.findMany({
      where: { fileId: file.id },
      orderBy: { version: "desc" },
      include: { uploadedBy: { select: { email: true } } },
    });
    res.json({ versions });
  } catch (err) {
    logger.error({ err }, "Failed to list versions");
    res.status(500).json({ error: "Failed to list versions" });
  }
});

filesRoutes.get("/:id/versions/:versionId/download", requireDownload, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    const file = await prisma.file.findFirst({ where: { id: req.params.id, orgId } });
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    const version = await prisma.fileVersion.findFirst({
      where: { id: req.params.versionId, fileId: file.id },
    });
    if (!version) {
      res.status(404).json({ error: "Version not found" });
      return;
    }
    const url = await getPresignedGetUrl(version.r2Key);
    res.json({ url });
  } catch (err) {
    logger.error({ err }, "Failed to get version download URL");
    res.status(500).json({ error: "Failed to get version download URL" });
  }
});
