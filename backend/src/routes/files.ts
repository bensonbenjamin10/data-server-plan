import { Router } from "express";
import { z } from "zod";
import { getPresignedGetUrl, deleteObject } from "../services/r2.js";
import { clerkMiddlewareWithDevBypass, requireAuthWithDevBypass, resolveOrgMiddleware } from "../middleware/auth.js";
import { requireDownload, requireUpload } from "../middleware/rbac.js";
import { prisma } from "../db/index.js";

export const filesRoutes = Router();

const updateFileSchema = z.object({
  name: z.string().min(1).optional(),
  folderId: z.string().nullable().optional(),
});

function getOrgId(req: import("express").Request): string | null {
  return (req as any).auth?.orgId ?? null;
}

filesRoutes.use(clerkMiddlewareWithDevBypass());
filesRoutes.use(requireAuthWithDevBypass());
filesRoutes.use(resolveOrgMiddleware());

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
