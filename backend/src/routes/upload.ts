import { Router, type Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";
import { logger } from "../lib/logger.js";
import {
  getPresignedPutUrl,
  createMultipartUpload,
  getPresignedUploadPartUrl,
  completeMultipartUpload,
  abortMultipartUpload,
  listParts,
} from "../services/r2.js";
import { jwtMiddlewareWithDevBypass, requireAuthWithDevBypass } from "../middleware/auth.js";
import { requireUpload } from "../middleware/rbac.js";
import { prisma } from "../db/index.js";
import { logAuditEvent } from "../services/audit.js";

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

async function checkStorageQuota(orgId: string, additionalBytes: number): Promise<{ allowed: boolean; used: number; quota: number }> {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { storageQuota: true } });
  const quota = Number(org?.storageQuota ?? 5497558138880);
  const sizeResult = await prisma.file.aggregate({ where: { orgId, deletedAt: null }, _sum: { size: true } });
  const used = sizeResult._sum.size ?? 0;
  return { allowed: used + additionalBytes <= quota, used, quota };
}

const rateLimitValidate = { xForwardedForHeader: false as const };

function uploadRateLimitKey(req: Request): string {
  const a = (req as any).auth;
  if (a?.userId) return `user:${a.userId}`;
  if (a?.orgId) return `org:${a.orgId}`;
  const ip = req.ip ?? (req.socket?.remoteAddress as string) ?? "unknown";
  return `ip:${ipKeyGenerator(ip)}`;
}

/** Normalize path so comparison works whether Express gives "/presign" or "presign". */
function uploadRoutePath(req: Request): string {
  const p = req.path ?? "";
  return p.startsWith("/") ? p : `/${p}`;
}

const UPLOAD_START_PATHS = ["/presign", "/multipart/create"];

const uploadStartLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many uploads started. Please try again later." },
  validate: rateLimitValidate,
  keyGenerator: uploadRateLimitKey,
  skip: (req) => !UPLOAD_START_PATHS.includes(uploadRoutePath(req)),
});

const presignPartLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many upload requests, please try again later." },
  validate: rateLimitValidate,
  keyGenerator: uploadRateLimitKey,
  skip: (req) => UPLOAD_START_PATHS.includes(uploadRoutePath(req)),
});

uploadRoutes.use(jwtMiddlewareWithDevBypass());
uploadRoutes.use(requireAuthWithDevBypass());
uploadRoutes.use(requireUpload);
uploadRoutes.use(uploadStartLimiter);
uploadRoutes.use(presignPartLimiter);

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
    logger.error({ err }, "Failed to generate presigned URL");
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

    const { allowed, used, quota } = await checkStorageQuota(orgId, body.size);
    if (!allowed) {
      res.status(413).json({ error: "Storage quota exceeded", used, quota });
      return;
    }

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
    await prisma.fileVersion.create({
      data: {
        fileId: file.id,
        version: 1,
        r2Key: file.r2Key,
        size: file.size,
        uploadedById: userId || null,
      },
    });
    logAuditEvent({ orgId, userId, action: "file.upload", resource: "file", resourceId: file.id, metadata: { name: file.name, size: file.size, mimeType: file.mimeType }, req });
    res.status(201).json(file);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    logger.error({ err }, "Failed to register file");
    res.status(500).json({ error: "Failed to register file" });
  }
});

const MAX_CONCURRENT_MULTIPART_UPLOADS_PER_ORG = 10;

uploadRoutes.post("/multipart/create", async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(403).json({ error: "Organization context required" });
      return;
    }
    const body = multipartCreateSchema.parse(req.body);
    const count = await prisma.multipartUpload.count({
      where: { orgId, expiresAt: { gt: new Date() } },
    });
    if (count >= MAX_CONCURRENT_MULTIPART_UPLOADS_PER_ORG) {
      res.status(429).json({
        error: "Too many concurrent uploads. Please complete or cancel an upload before starting another.",
      });
      return;
    }
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
    logger.error({ err }, "Failed to create multipart upload");
    res.status(500).json({ error: "Failed to create multipart upload" });
  }
});

uploadRoutes.post("/multipart/presign-part", async (req, res) => {
  try {
    const body = presignPartSchema.parse(req.body);
    const url = await getPresignedUploadPartUrl(body.key, body.uploadId, body.partNumber);
    res.json({ url, partNumber: body.partNumber });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    logger.error({ err }, "Failed to generate presigned part URL");
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
    logger.error({ err }, "Failed to list parts");
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

    const { allowed, used, quota } = await checkStorageQuota(orgId, body.size);
    if (!allowed) {
      res.status(413).json({ error: "Storage quota exceeded", used, quota });
      return;
    }

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
    await prisma.fileVersion.create({
      data: {
        fileId: file.id,
        version: 1,
        r2Key: file.r2Key,
        size: file.size,
        uploadedById: userId || null,
      },
    });
    await prisma.multipartUpload.deleteMany({ where: { uploadId: body.uploadId } });
    logAuditEvent({ orgId, userId, action: "file.upload", resource: "file", resourceId: file.id, metadata: { name: file.name, size: file.size, mimeType: file.mimeType, multipart: true }, req });
    res.status(201).json(file);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    logger.error({ err }, "Failed to complete multipart upload");
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
    logger.error({ err }, "Failed to abort multipart upload");
    res.status(500).json({ error: "Failed to abort multipart upload" });
  }
});
