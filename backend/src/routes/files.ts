import { Router } from "express";
import { getPresignedGetUrl, deleteObject } from "../services/r2.js";
import { clerkMiddlewareWithDevBypass, requireAuthWithDevBypass } from "../middleware/auth.js";
import { requireDownload, requireUpload } from "../middleware/rbac.js";
import { prisma } from "../db/index.js";

export const filesRoutes = Router();

function getOrgId(req: import("express").Request): string | null {
  return (req as any).auth?.orgId ?? null;
}

filesRoutes.use(clerkMiddlewareWithDevBypass());
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
