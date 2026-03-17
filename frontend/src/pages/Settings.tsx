import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api-context";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function Settings() {
  const api = useApi();
  const { data: stats } = useQuery({
    queryKey: ["files", "stats"],
    queryFn: () => api.getFileStats(),
  });

  return (
    <div className="p-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-8"
      >
        <h1 className="text-2xl font-display font-semibold text-text mb-4">
          Settings
        </h1>

        <div className="border border-border rounded-lg p-6 bg-surface max-w-md">
          <h2 className="font-medium text-text mb-2">Storage</h2>
          <p className="text-text-muted text-sm">
            {stats ? (
              <>
                {stats.fileCount} files · {formatSize(stats.totalSize)} used
              </>
            ) : (
              "Loading..."
            )}
          </p>
        </div>

        <div className="border border-border rounded-lg p-6 bg-surface max-w-md">
          <h2 className="font-medium text-text mb-2">Organization</h2>
          <p className="text-text-muted text-sm">
            Organization settings can be managed here.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
