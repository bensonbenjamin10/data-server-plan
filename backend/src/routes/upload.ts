import { Router } from "express";
import { z } from "zod";
import {
  getPresignedPutUrl,
  createMultipartUpload,
  getPresignedUploadPartUrl,
  completeMultipartUpload,
  abortMultipartUpload,
  listParts,
} from "../services/r2.js";
import { clerkMiddlewareWithDevBypass, requireAuthWithDevBypass, resolveOrgMiddleware } from "../middleware/auth.js";
import { requireUpload } from "../middleware/rbac.js";
import { prisma } from "../db/index.js";

export const uploadRoutes = Router();

const presignSchema = z.object({
  key: z.string().min(1),
  contentType: z.string().optional(),
});

const multipartCreateSchema = z.object({
  key: z.string().min(1),
});

const presignPartSchema = z.object({
  key: z.string().min(1),
  uploadId: z.string().min(1),
  partNumber: z.number().int().min(1),
});

const completeSchema = z.object({
  key: z.string().min(1),
  uploadId: z.string().min(1),
  parts: z.array(
    z.object({
      partNumber: z.number().int().min(1),
      etag: z.string().min(1),
    })
  ),
  name: z.string().min(1),
  size: z.number().int().min(0),
  mimeType: z.string().optional(),
  folderId: z.string().optional().nullable(),
});

const singleCompleteSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  size: z.number().int().min(0),
  mimeType: z.string().optional(),
  folderId: z.string().optional().nullable(),
});

const abortSchema = z.object({
  key: z.string().min(1),
  uploadId: z.string().min(1),
});

function getOrgId(req: import("express").Request): string | null {
  return (req as any).auth?.orgId ?? null;
}

function getUserId(req: import("express").Request): string | null {
  return (req as any).auth?.userId ?? null;
}

uploadRoutes.use(clerkMiddlewareWithDevBypass());
uploadRoutes.use(requireAuthWithDevBypass());
uploadRoutes.use(resolveOrgMiddleware());
uploadRoutes.use(requireUpload);

uploadRoutes.post("/presign", async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    const body = presignSchema.parse(req.body);
    const url = await getPresignedPutUrl(body.key, body.contentType);
    res.json({ url, key: body.key });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Failed to generate presigned URL" });
  }
});

uploadRoutes.post("/complete", async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    const body = singleCompleteSchema.parse(req.body);
    const file = await prisma.file.create({
      data: {
        orgId,
        folderId: body.folderId || null,
        name: body.name,
        r2Key: body.key,
        size: body.size,
        mimeType: body.mimeType || null,
        uploadedById: userId || null,
      },
    });
    res.status(201).json(file);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Failed to register file" });
  }
});

uploadRoutes.post("/multipart/create", async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    const body = multipartCreateSchema.parse(req.body);
    const uploadId = await createMultipartUpload(body.key);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.multipartUpload.upsert({
      where: { uploadId },
      create: { uploadId, r2Key: body.key, orgId, expiresAt },
      update: { expiresAt },
    });
    res.json({ uploadId, key: body.key });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Failed to create multipart upload" });
  }
});

uploadRoutes.post("/multipart/presign-part", async (req, res) => {
  try {
    const body = presignPartSchema.parse(req.body);
    const url = await getPresignedUploadPartUrl(
      body.key,
      body.uploadId,
      body.partNumber
    );
    res.json({ url, partNumber: body.partNumber });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Failed to generate presigned URL" });
  }
});

uploadRoutes.get("/multipart/parts", async (req, res) => {
  try {
    const key = req.query.key as string;
    const uploadId = req.query.uploadId as string;
    if (!key || !uploadId) {
      res.status(400).json({ error: "key and uploadId required" });
      return;
    }
    const parts = await listParts(key, uploadId);
    res.json({ parts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list parts" });
  }
});

uploadRoutes.post("/multipart/complete", async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    const body = completeSchema.parse(req.body);
    await completeMultipartUpload(body.key, body.uploadId, body.parts);
    const file = await prisma.file.create({
      data: {
        orgId,
        folderId: body.folderId || null,
        name: body.name,
        r2Key: body.key,
        size: body.size,
        mimeType: body.mimeType || null,
        uploadedById: userId || null,
      },
    });
    await prisma.multipartUpload.deleteMany({ where: { uploadId: body.uploadId } });
    res.status(201).json(file);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Failed to complete multipart upload" });
  }
});

uploadRoutes.post("/multipart/abort", async (req, res) => {
  try {
    const body = abortSchema.parse(req.body);
    await abortMultipartUpload(body.key, body.uploadId);
    await prisma.multipartUpload.deleteMany({ where: { uploadId: body.uploadId } });
    res.status(204).send();
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Failed to abort multipart upload" });
  }
});
