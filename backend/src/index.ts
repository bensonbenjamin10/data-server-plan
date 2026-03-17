import express from "express";
import cors from "cors";
import { authRoutes } from "./routes/auth.js";
import { uploadRoutes } from "./routes/upload.js";
import { filesRoutes } from "./routes/files.js";
import { foldersRoutes } from "./routes/folders.js";
import { searchRoutes } from "./routes/search.js";
import { checkR2Connection } from "./services/r2.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

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

app.use("/api/auth", authRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/files", filesRoutes);
app.use("/api/folders", foldersRoutes);
app.use("/api/search", searchRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/health/r2", async (_req, res) => {
  const r2 = await checkR2Connection();
  res.status(r2.ok ? 200 : 503).json(r2);
});

// Global error handler – log 500s for debugging
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[Unhandled error]", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  const r2 = await checkR2Connection();
  if (!r2.ok) {
    console.warn("[R2] Startup check failed:", r2.error);
  }
});
