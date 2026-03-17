import express from "express";
import cors from "cors";
import { authRoutes } from "./routes/auth.js";
import { uploadRoutes } from "./routes/upload.js";
import { filesRoutes } from "./routes/files.js";
import { foldersRoutes } from "./routes/folders.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/files", filesRoutes);
app.use("/api/folders", foldersRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
