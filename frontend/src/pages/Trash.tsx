import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api-context";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/Modal";
import { getFileIconComponent } from "@/lib/fileIcons";
import { Trash2, RotateCcw } from "lucide-react";
import type { FileRecord } from "@/lib/api";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type TrashFile = FileRecord & { deletedAt: string };

export function Trash() {
  const api = useApi();
  const { orgRole } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [fileToPermanentDelete, setFileToPermanentDelete] = useState<TrashFile | null>(null);

  const isAdmin = orgRole === "admin";

  const { data, isLoading } = useQuery({
    queryKey: ["trash"],
    queryFn: () => api.getTrash(),
  });

  const files = (data?.files ?? []) as TrashFile[];

  const handleRestore = async (file: TrashFile) => {
    try {
      await api.restoreFile(file.id);
      queryClient.invalidateQueries({ queryKey: ["trash"] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      showToast(`"${file.name}" restored`, "success");
      if (file.folderId) navigate(`/files/${file.folderId}`);
      else navigate("/files");
    } catch {
      showToast("Failed to restore file", "error");
    }
  };

  const handlePermanentDeleteConfirm = async () => {
    if (!fileToPermanentDelete) return;
    try {
      await api.permanentDeleteFile(fileToPermanentDelete.id);
      queryClient.invalidateQueries({ queryKey: ["trash"] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
      showToast("File permanently deleted", "success");
      setFileToPermanentDelete(null);
    } catch {
      showToast("Failed to permanently delete", "error");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-8"
    >
      <h1 className="text-xl font-display font-semibold text-text mb-2">Trash</h1>
      <p className="text-sm text-text-muted mb-6">
        Deleted files are listed here. Restore them to their folder or permanently delete (admin only).
      </p>

      <div className="border border-border rounded-lg overflow-hidden bg-surface">
        {isLoading ? (
          <div className="p-8 text-center text-text-muted">Loading...</div>
        ) : files.length === 0 ? (
          <div className="p-12 text-center">
            <Trash2 size={48} className="mx-auto text-text-muted/50 mb-4" />
            <p className="text-text-muted font-medium">Trash is empty</p>
            <p className="text-sm text-text-muted mt-1">Deleted files will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-hover text-left text-text-muted font-medium">
                  <th className="px-4 py-3 w-10" />
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3 w-24">Size</th>
                  <th className="px-4 py-3 w-40">Deleted</th>
                  <th className="px-4 py-3 w-48 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <motion.tr
                    key={file.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-b border-border last:border-b-0 hover:bg-surface-hover"
                  >
                    <td className="px-4 py-3">
                      {(() => {
                        const Icon = getFileIconComponent(file.name, file.mimeType);
                        return <Icon size={20} className="text-text-muted" />;
                      })()}
                    </td>
                    <td className="px-4 py-3 font-medium text-text truncate max-w-xs">{file.name}</td>
                    <td className="px-4 py-3 text-text-muted">{formatSize(file.size)}</td>
                    <td className="px-4 py-3 text-text-muted">{file.deletedAt ? formatDate(file.deletedAt) : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleRestore(file)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-accent hover:bg-accent/10 font-medium text-sm"
                        >
                          <RotateCcw size={14} />
                          Restore
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setFileToPermanentDelete(file)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-error hover:bg-error/10 font-medium text-sm"
                          >
                            <Trash2 size={14} />
                            Delete permanently
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!fileToPermanentDelete}
        onClose={() => setFileToPermanentDelete(null)}
        onConfirm={handlePermanentDeleteConfirm}
        title="Permanently delete file?"
        message={
          fileToPermanentDelete
            ? `"${fileToPermanentDelete.name}" will be removed from R2 and cannot be recovered.`
            : ""
        }
        confirmLabel="Delete permanently"
        variant="danger"
      />
    </motion.div>
  );
}
