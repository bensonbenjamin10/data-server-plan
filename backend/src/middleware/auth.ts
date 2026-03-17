import { clerkMiddleware, getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { resolveOrgId } from "../services/org.js";

const SKIP_AUTH = process.env.SKIP_AUTH === "1";

export function clerkMiddlewareWithDevBypass() {
  if (SKIP_AUTH) {
    return (req: Request, _res: Response, next: NextFunction) => {
      (req as any).auth = {
        userId: "dev-user-id",
        orgId: "dev-org-id",
        orgRole: "admin",
      };
      next();
    };
  }
  return clerkMiddleware();
}

/** Normalize Clerk orgRole: "org:admin" -> "admin" */
function normalizeOrgRole(role: string | undefined): string | undefined {
  if (!role) return role;
  return role.startsWith("org:") ? role.slice(4) : role;
}

/** API-friendly auth: returns 401 if not authenticated (no redirect) */
export function requireAuthWithDevBypass() {
  if (SKIP_AUTH) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = getAuth(req);
    if (!auth.userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    (req as any).auth = {
      ...auth,
      orgRole: normalizeOrgRole(auth.orgRole),
    };
    next();
  };
}

/**
 * Resolves Clerk orgId to our internal Organization.id.
 * Must run after requireAuthWithDevBypass. With SKIP_AUTH, orgId is already correct.
 */
export function resolveOrgMiddleware() {
  if (SKIP_AUTH) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }
  return async (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as any).auth;
    const clerkOrgId = auth?.orgId;
    if (!clerkOrgId) {
      next();
      return;
    }
    try {
      const internalOrgId = await resolveOrgId(clerkOrgId);
      (req as any).auth = { ...auth, orgId: internalOrgId };
      next();
    } catch (err) {
      console.error("[resolveOrg] clerkOrgId=" + clerkOrgId, err);
      res.status(500).json({
        error: "Failed to resolve organization",
        details: err instanceof Error ? err.message : String(err),
      });
    }
  };
}

export interface AuthRequest extends Request {
  auth?: {
    userId: string;
    orgId?: string;
    orgRole?: string;
  };
}

export function requireOrg(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const orgId = req.auth?.orgId;
  if (!orgId) {
    res.status(403).json({ error: "Organization context required" });
    return;
  }
  next();
}
