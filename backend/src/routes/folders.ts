import { Router } from "express";
import { z } from "zod";
import { clerkMiddlewareWithDevBypass, requireAuthWithDevBypass } from "../middleware/auth.js";
import { requireUpload, requireDownload } from "../middleware/rbac.js";
import { prisma } from "../db/index.js";

function getOrgId(req: import("express").Request): string | null {
  return (req as any).auth?.orgId ?? null;
}

export const foldersRoutes = Router();

const createFolderSchema = z.object({
  name: z.string().min(1),
  parentId: z.string().optional().nullable(),
});

foldersRoutes.use(clerkMiddlewareWithDevBypass());
foldersRoutes.use(requireAuthWithDevBypass());

foldersRoutes.get("/", requireDownload, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    const parentId = req.query.parentId as string | undefined;
    const folders = await prisma.folder.findMany({
      where: {
        orgId,
        parentId: parentId || null,
      },
      orderBy: { name: "asc" },
    });
    res.json({ folders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list folders" });
  }
});

foldersRoutes.get("/:id", requireDownload, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    const { id } = req.params;
    const folder = await prisma.folder.findFirst({
      where: { id, orgId },
    });
    if (!folder) {
      res.status(404).json({ error: "Folder not found" });
      return;
    }
    res.json(folder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get folder" });
  }
});

foldersRoutes.post("/", requireUpload, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    const body = createFolderSchema.parse(req.body);
    let path = body.name;
    if (body.parentId) {
      const parent = await prisma.folder.findFirst({
        where: { id: body.parentId, orgId },
      });
      if (!parent) {
        res.status(404).json({ error: "Parent folder not found" });
        return;
      }
      path = `${parent.path}/${body.name}`;
    }
    const folder = await prisma.folder.create({
      data: {
        orgId,
        parentId: body.parentId || null,
        name: body.name,
        path,
      },
    });
    res.status(201).json(folder);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Failed to create folder" });
  }
});
