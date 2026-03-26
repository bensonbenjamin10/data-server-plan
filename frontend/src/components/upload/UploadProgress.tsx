import { motion } from "framer-motion";
import type { UploadQueueItem } from "@/hooks/useUploadQueue";
import type { UploadStatus } from "@/hooks/useResumableUpload";

interface UploadProgressProps {
  items: UploadQueueItem[];
  /** Current single-file hook status (pause/resume for active upload) */
  hookStatus: UploadStatus;
  hookFileName: string | null;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onRetry?: (id: string) => void;
  onClearCompleted?: () => void;
  canPauseResume?: boolean;
}

function statusLabel(status: UploadQueueItem["status"]): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "uploading":
      return "Uploading";
    case "completed":
      return "Done";
    case "error":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export function UploadProgress({
  items,
  hookStatus,
  hookFileName,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onClearCompleted,
  canPauseResume = true,
}: UploadProgressProps) {
  if (items.length === 0) return null;

  const hasCompleted = items.some((i) => i.status === "completed" || i.status === "cancelled");
  const activeUpload = items.find((i) => i.status === "uploading");

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="bg-surface rounded-lg border border-border p-4 shadow-card"
    >
      <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
        <span className="font-medium text-text">Uploads ({items.length})</span>
        <div className="flex items-center gap-2 shrink-0">
          {hasCompleted && onClearCompleted && (
            <button
              type="button"
              onClick={onClearCompleted}
              className="text-sm text-text-muted hover:text-text font-medium"
            >
              Clear finished
            </button>
          )}
          {canPauseResume && hookStatus === "uploading" && onPause && (
            <button type="button" onClick={onPause} className="text-sm text-accent hover:text-accent-hover font-medium">
              Pause
            </button>
          )}
          {canPauseResume && hookStatus === "paused" && onResume && (
            <button type="button" onClick={onResume} className="text-sm text-accent hover:text-accent-hover font-medium">
              Resume
            </button>
          )}
          {(hookStatus === "uploading" || hookStatus === "paused") && onCancel && (
            <button type="button" onClick={onCancel} className="text-sm text-error hover:opacity-80 font-medium">
              Cancel current
            </button>
          )}
        </div>
      </div>

      {activeUpload && hookFileName && (
        <p className="text-xs text-text-muted mb-2 truncate">
          Active: {hookFileName}
        </p>
      )}

      <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-md border border-border/60 bg-surface-hover/50 px-3 py-2"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text truncate" title={item.relativePath || item.fileName}>
                  {item.relativePath || item.fileName}
                </p>
                <p className="text-xs text-text-muted">{statusLabel(item.status)}</p>
              </div>
              {item.status === "error" && onRetry && (
                <button
                  type="button"
                  onClick={() => onRetry(item.id)}
                  className="text-xs text-accent hover:underline shrink-0"
                >
                  Retry
                </button>
              )}
            </div>
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${
                  item.status === "error" ? "bg-error" : item.status === "completed" ? "bg-success" : "bg-accent"
                }`}
                initial={false}
                animate={{ width: `${item.progress}%` }}
                transition={{ duration: 0.2 }}
              />
            </div>
            {item.error && (
              <p className="mt-1 text-xs text-error break-words">{item.error}</p>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
