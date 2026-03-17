import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../services/auth.js";

const SKIP_AUTH = process.env.SKIP_AUTH === "1";

export function jwtMiddleware() {
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
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      (req as any).auth = null;
      next();
      return;
    }
    const payload = verifyToken(token);
    if (!payload) {
      (req as any).auth = null;
      next();
      return;
    }
    (req as any).auth = payload;
    next();
  };
}

export function requireAuth() {
  if (SKIP_AUTH) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as any).auth;
    if (!auth?.userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    next();
  };
}

/** Combined middleware for protected API routes: JWT + require auth. No org resolution needed (JWT has internal orgId). */
export function jwtMiddlewareWithDevBypass() {
  return jwtMiddleware();
}

export function requireAuthWithDevBypass() {
  return requireAuth();
}

export interface AuthRequest extends Request {
  auth?: {
    userId: string;
    orgId: string;
    orgRole: string;
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
