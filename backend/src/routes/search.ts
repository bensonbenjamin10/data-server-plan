import { Router } from "express";
import { clerkMiddlewareWithDevBypass, requireAuthWithDevBypass, resolveOrgMiddleware } from "../middleware/auth.js";
import { requireDownload } from "../middleware/rbac.js";
import { prisma } from "../db/index.js";

export const searchRoutes = Router();

function getOrgId(req: import("express").Request): string | null {
  return (req as any).auth?.orgId ?? null;
}

searchRoutes.use(clerkMiddlewareWithDevBypass());
searchRoutes.use(requireAuthWithDevBypass());
searchRoutes.use(resolveOrgMiddleware());

searchRoutes.get("/", requireDownload, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    const q = (req.query.q as string)?.trim();
    if (!q || q.length < 2) {
      res.json({ files: [], folders: [] });
      return;
    }
    const [files, folders] = await Promise.all([
      prisma.file.findMany({
        where: {
          orgId,
          name: { contains: q, mode: "insensitive" },
        },
        include: { folder: { select: { name: true, id: true } } },
        take: 50,
      }),
      prisma.folder.findMany({
        where: {
          orgId,
          name: { contains: q, mode: "insensitive" },
        },
        take: 50,
      }),
    ]);
    type FileItem = (typeof files)[number];
    type FolderItem = (typeof folders)[number];
    res.json({
      files: files.map((f: FileItem) => ({
        id: f.id,
        name: f.name,
        folderId: f.folderId,
        folderName: f.folder?.name ?? null,
        createdAt: f.createdAt,
      })),
      folders: folders.map((f: FolderItem) => ({
        id: f.id,
        name: f.name,
        path: f.path,
        parentId: f.parentId,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed" });
  }
});
