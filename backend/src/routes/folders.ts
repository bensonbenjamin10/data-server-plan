import { Router } from "express";
import { z } from "zod";
import { logger } from "../lib/logger.js";
import { jwtMiddlewareWithDevBypass, requireAuthWithDevBypass } from "../middleware/auth.js";
import { requireUpload, requireDownload } from "../middleware/rbac.js";
import { prisma } from "../db/index.js";
import { logAuditEvent } from "../services/audit.js";

function getAuth(req: import("express").Request) {
  return (req as any).auth as { userId: string; orgId: string; orgRole: string } | null;
}

function getOrgId(req: import("express").Request): string | null {
  return (req as any).auth?.orgId ?? null;
}

export const foldersRoutes = Router();

const createFolderSchema = z.object({
  name: z.string().min(1),
  parentId: z.string().optional().nullable(),
});

const updateFolderSchema = z.object({
  name: z.string().min(1).optional(),
  parentId: z.string().nullable().optional(),
});

foldersRoutes.use(jwtMiddlewareWithDevBypass());
foldersRoutes.use(requireAuthWithDevBypass());

foldersRoutes.get("/tree", requireDownload, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    const all = await prisma.folder.findMany({
      where: { orgId },
      orderBy: { name: "asc" },
    });
    const byParent = new Map<string | null, typeof all>();
    byParent.set(null, []);
    for (const f of all) {
      const key = f.parentId ?? null;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(f);
    }
    type FolderItem = (typeof all)[number];
    function buildTree(pid: string | null): Array<{ id: string; name: string; path: string; parentId: string | null; children: ReturnType<typeof buildTree> }> {
      return (byParent.get(pid) ?? []).map((f: FolderItem) => ({
        id: f.id,
        name: f.name,
        path: f.path,
        parentId: f.parentId,
        children: buildTree(f.id),
      }));
    }
    const tree = buildTree(null);
    res.json({ tree });
  } catch (err) {
    logger.error({ err }, "Failed to list folder tree");
    res.status(500).json({ error: "Failed to list folder tree" });
  }
});

foldersRoutes.get("/", requireDownload, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    const parentId = req.query.parentId as string | undefined;
    const folders = await prisma.folder.findMany({
      where: { orgId, parentId: parentId || null },
      orderBy: { name: "asc" },
    });
    res.json({ folders });
  } catch (err) {
    logger.error({ err }, "Failed to list folders");
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
    const folder = await prisma.folder.findFirst({ where: { id, orgId } });
    if (!folder) {
      res.status(404).json({ error: "Folder not found" });
      return;
    }
    res.json(folder);
  } catch (err) {
    logger.error({ err }, "Failed to get folder");
    res.status(500).json({ error: "Failed to get folder" });
  }
});

foldersRoutes.post("/", requireUpload, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const auth = getAuth(req);
    if (!orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    const body = createFolderSchema.parse(req.body);
    let path = body.name;
    if (body.parentId) {
      const parent = await prisma.folder.findFirst({ where: { id: body.parentId, orgId } });
      if (!parent) {
        res.status(404).json({ error: "Parent folder not found" });
        return;
      }
      path = `${parent.path}/${body.name}`;
    }
    const folder = await prisma.folder.create({
      data: { orgId, parentId: body.parentId || null, name: body.name, path },
    });
    logAuditEvent({ orgId, userId: auth?.userId, action: "folder.create", resource: "folder", resourceId: folder.id, metadata: { name: folder.name, path: folder.path }, req });
    res.status(201).json(folder);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    logger.error({ err }, "Failed to create folder");
    res.status(500).json({ error: "Failed to create folder" });
  }
});

foldersRoutes.patch("/:id", requireUpload, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const auth = getAuth(req);
    if (!orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    const { id } = req.params;
    const body = updateFolderSchema.parse(req.body);
    const folder = await prisma.folder.findFirst({ where: { id, orgId } });
    if (!folder) {
      res.status(404).json({ error: "Folder not found" });
      return;
    }
    const newName = body.name ?? folder.name;
    const newParentId = body.parentId !== undefined ? body.parentId : folder.parentId;
    let newPath = newName;
    if (newParentId) {
      const parent = await prisma.folder.findFirst({ where: { id: newParentId, orgId } });
      if (!parent) {
        res.status(404).json({ error: "Parent folder not found" });
        return;
      }
      newPath = `${parent.path}/${newName}`;
    }
    const data: { name?: string; parentId?: string | null; path: string } = { path: newPath };
    if (body.name !== undefined) data.name = body.name;
    if (body.parentId !== undefined) data.parentId = body.parentId;
    const updated = await prisma.folder.update({ where: { id }, data });
    logAuditEvent({ orgId, userId: auth?.userId, action: "folder.rename", resource: "folder", resourceId: folder.id, metadata: { oldName: folder.name, newName: updated.name }, req });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    logger.error({ err }, "Failed to update folder");
    res.status(500).json({ error: "Failed to update folder" });
  }
});

foldersRoutes.delete("/:id", requireUpload, async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const auth = getAuth(req);
    if (!orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    const { id } = req.params;
    const folder = await prisma.folder.findFirst({ where: { id, orgId } });
    if (!folder) {
      res.status(404).json({ error: "Folder not found" });
      return;
    }
    await prisma.folder.delete({ where: { id } });
    logAuditEvent({ orgId, userId: auth?.userId, action: "folder.delete", resource: "folder", resourceId: folder.id, metadata: { name: folder.name }, req });
    res.status(204).send();
  } catch (err) {
    logger.error({ err }, "Failed to delete folder");
    res.status(500).json({ error: "Failed to delete folder" });
  }
});
