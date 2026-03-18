import { Router } from "express";
import { z } from "zod";
import { getPresignedGetUrl, deleteObject } from "../services/r2.js";
import { jwtMiddlewareWithDevBypass, requireAuthWithDevBypass } from "../middleware/auth.js";
import { requireDownload, requireUpload } from "../middleware/rbac.js";
import { prisma } from "../db/index.js";

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
      },
      include: {
        folder: true,
        uploadedBy: { select: { email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ files });
  } catch (err) {
    console.error(err);
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

    const [fileCount, folderCount, sizeResult, recentUploadsCount, allFiles] = await Promise.all([
      prisma.file.count({ where: { orgId } }),
      prisma.folder.count({ where: { orgId } }),
      prisma.file.aggregate({ where: { orgId }, _sum: { size: true } }),
      prisma.file.count({ where: { orgId, createdAt: { gte: sevenDaysAgo } } }),
      prisma.file.findMany({
        where: { orgId },
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
    console.error(err);
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
      where: { orgId },
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
    console.error(err);
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
      prisma.file.count({ where: { orgId } }),
      prisma.file.aggregate({
        where: { orgId },
        _sum: { size: true },
      }),
    ]);
    const totalSize = sizeResult._sum.size ?? 0;
    res.json({ fileCount, totalSize });
  } catch (err) {
    console.error(err);
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
      where: { orgId },
      include: { folder: { select: { name: true, id: true } } },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });
    res.json({ files });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list recent files" });
  }
});

filesRoutes.get("/:id/download", requireDownload, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    const { id } = req.params;
    const file = await prisma.file.findFirst({
      where: { id, orgId },
    });
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    const url = await getPresignedGetUrl(file.r2Key);
    res.json({ url, name: file.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate download URL" });
  }
});

filesRoutes.patch("/:id", requireUpload, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    const { id } = req.params;
    const body = updateFileSchema.parse(req.body);
    const file = await prisma.file.findFirst({
      where: { id, orgId },
    });
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    const data: { name?: string; folderId?: string | null } = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.folderId !== undefined) {
      if (body.folderId) {
        const folder = await prisma.folder.findFirst({
          where: { id: body.folderId, orgId },
        });
        if (!folder) {
          res.status(404).json({ error: "Folder not found" });
          return;
        }
      }
      data.folderId = body.folderId;
    }
    const updated = await prisma.file.update({
      where: { id },
      data,
    });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Failed to update file" });
  }
});

filesRoutes.delete("/:id", requireUpload, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    const { id } = req.params;
    const file = await prisma.file.findFirst({
      where: { id, orgId },
    });
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    await deleteObject(file.r2Key);
    await prisma.file.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete file" });
  }
});
