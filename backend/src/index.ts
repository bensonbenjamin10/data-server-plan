import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { authRoutes } from "./routes/auth.js";
import { uploadRoutes } from "./routes/upload.js";
import { filesRoutes } from "./routes/files.js";
import { foldersRoutes } from "./routes/folders.js";
import { searchRoutes } from "./routes/search.js";
import { orgRoutes } from "./routes/org.js";
import { auditRoutes } from "./routes/audit.js";
import { checkR2Connection } from "./services/r2.js";
import { prisma } from "./db/index.js";
import { logger } from "./lib/logger.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

// Security headers
app.use(helmet());

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://frontend-production-f322.up.railway.app",
  "https://data.finjoe.app",
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
].filter(Boolean);

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (origin.endsWith(".railway.app") || origin.endsWith(".finjoe.app")) return true;
  return false;
}

app.use(
  cors({
    origin: (origin, cb) => {
      if (isOriginAllowed(origin)) {
        cb(null, true);
      } else {
        cb(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Request ID middleware
app.use((req, _res, next) => {
  (req as any).id = crypto.randomUUID();
  _res.setHeader("X-Request-Id", (req as any).id);
  next();
});

// Rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
app.use(globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts, please try again later." },
});
app.use("/api/auth/sign-in", authLimiter);
app.use("/api/auth/sign-up", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many upload requests, please try again later." },
});
app.use("/api/upload", uploadLimiter);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/files", filesRoutes);
app.use("/api/folders", foldersRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/org", orgRoutes);
app.use("/api/audit", auditRoutes);

// Health
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/health/r2", async (_req, res) => {
  const r2 = await checkR2Connection();
  res.status(r2.ok ? 200 : 503).json(r2);
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, async () => {
  logger.info(`Server running on http://localhost:${PORT}`);
  const r2 = await checkR2Connection();
  if (!r2.ok) {
    logger.warn({ error: r2.error }, "R2 startup check failed");
  }
});
