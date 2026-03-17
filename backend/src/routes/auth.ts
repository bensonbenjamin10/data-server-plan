import { Router } from "express";
import { clerkMiddlewareWithDevBypass, requireAuthWithDevBypass } from "../middleware/auth.js";

export const authRoutes = Router();

authRoutes.use(clerkMiddlewareWithDevBypass());

authRoutes.get("/me", requireAuthWithDevBypass(), async (req, res) => {
  const auth = (req as any).auth;
  if (!auth) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json({
    userId: auth.userId,
    orgId: auth.orgId,
    orgRole: auth.orgRole,
  });
});
