import type { Request } from "express";
import { prisma } from "../db/index.js";
import { logger } from "../lib/logger.js";

export interface AuditEventParams {
  orgId?: string | null;
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  req?: Request;
}

export function logAuditEvent(params: AuditEventParams): void {
  const ipAddress = params.req
    ? (params.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || params.req.socket.remoteAddress || null
    : null;
  const userAgent = params.req?.headers["user-agent"] || null;

  prisma.auditLog
    .create({
      data: {
        orgId: params.orgId || undefined,
        userId: params.userId || undefined,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId || undefined,
        metadata: (params.metadata as any) ?? undefined,
        ipAddress,
        userAgent,
      },
    })
    .catch((err) => {
      logger.error({ err }, "Failed to log audit event");
    });
}

export const AuditActions = {
  AUTH_SIGN_IN: "auth.sign_in",
  AUTH_SIGN_IN_FAILED: "auth.sign_in_failed",
  AUTH_SIGN_UP: "auth.sign_up",
  AUTH_SIGN_OUT: "auth.sign_out",
  AUTH_PASSWORD_CHANGE: "auth.password_change",
  AUTH_PASSWORD_RESET: "auth.password_reset",
  AUTH_EMAIL_VERIFIED: "auth.email_verified",
  FILE_UPLOAD: "file.upload",
  FILE_DOWNLOAD: "file.download",
  FILE_DELETE: "file.delete",
  FILE_RENAME: "file.rename",
  FILE_MOVE: "file.move",
  FILE_RESTORE: "file.restore",
  FILE_PERMANENT_DELETE: "file.permanent_delete",
  FOLDER_CREATE: "folder.create",
  FOLDER_DELETE: "folder.delete",
  FOLDER_RENAME: "folder.rename",
  MEMBER_INVITE: "member.invite",
  MEMBER_INVITE_ACCEPT: "member.invite_accept",
  MEMBER_ROLE_CHANGE: "member.role_change",
  MEMBER_REMOVE: "member.remove",
  ACCESS_REQUEST: "access.request",
  ACCESS_APPROVE: "access.approve",
  ACCESS_DENY: "access.deny",
  ORG_UPDATE: "org.update",
  SESSION_REVOKE: "session.revoke",
} as const;
