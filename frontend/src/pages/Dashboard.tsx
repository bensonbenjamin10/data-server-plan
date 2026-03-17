import { Link, useNavigate } from "react-router-dom";
import { getFileIcon } from "@/lib/fileIcons";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api-context";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function Dashboard() {
  const api = useApi();
  const navigate = useNavigate();
  const { data: recentData } = useQuery({
    queryKey: ["files", "recent"],
    queryFn: () => api.getRecentFiles(10),
  });
  const { data: statsData } = useQuery({
    queryKey: ["files", "stats"],
    queryFn: () => api.getFileStats(),
  });
  const recentFiles = recentData?.files ?? [];
  const stats = statsData ?? { fileCount: 0, totalSize: 0 };

  return (
    <div className="p-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-8"
      >
        <div>
          <h1 className="text-3xl font-display font-semibold text-text mb-2">
            Welcome to Org Data Storage
          </h1>
          <p className="text-text-muted mb-6">
            Upload, organize, and retrieve your organization&apos;s files securely.
          </p>
          <div className="flex gap-4 items-center">
            <Link
              to="/files"
              className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
            >
              Go to Files
            </Link>
            <div className="text-sm text-text-muted">
              {stats.fileCount} files · {formatSize(stats.totalSize)} used
            </div>
          </div>
        </div>

        {recentFiles.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-text mb-4">Recent files</h2>
            <div className="border border-border rounded-lg overflow-hidden bg-surface">
              {recentFiles.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => navigate(file.folderId ? `/files/${file.folderId}` : "/files")}
                  className="w-full px-4 py-3 text-left hover:bg-surface-hover flex items-center gap-3 text-text"
                >
                  <span className="text-xl">{getFileIcon(file.name, file.mimeType)}</span>
                  <span className="truncate flex-1">{file.name}</span>
                  {file.folder?.name && (
                    <span className="text-sm text-text-muted truncate max-w-32">{file.folder.name}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
