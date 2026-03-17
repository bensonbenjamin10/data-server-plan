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

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) {
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

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  const r2 = await checkR2Connection();
  if (!r2.ok) {
    console.warn("[R2] Startup check failed:", r2.error);
  }
});
