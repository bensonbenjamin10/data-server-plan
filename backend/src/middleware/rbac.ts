import type { Request, Response, NextFunction } from "express";

type AllowedRole = "admin" | "member" | "viewer";

/**
 * Require at least one of the given roles.
 * Viewer can only read; member can upload/download; admin can do everything.
 */
function requireRole(...allowedRoles: AllowedRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = (req as any).auth?.orgRole as string | undefined;
    if (!role) {
      res.status(403).json({ error: "Organization role required" });
      return;
    }
    if (allowedRoles.includes(role as AllowedRole)) {
      next();
      return;
    }
    res.status(403).json({ error: "Insufficient permissions" });
  };
}

/** Upload and delete require member or admin */
export const requireUpload = requireRole("admin", "member");

/** Download requires any role */
export const requireDownload = requireRole("admin", "member", "viewer");
