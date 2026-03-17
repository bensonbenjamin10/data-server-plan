import { motion } from "framer-motion";
import type { UploadStatus } from "@/hooks/useResumableUpload";

interface UploadProgressProps {
  fileName: string;
  status: UploadStatus;
  progress: number;
  error: string | null;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  canPauseResume?: boolean;
}

export function UploadProgress({
  fileName,
  status,
  progress,
  error,
  onPause,
  onResume,
  onCancel,
  canPauseResume = true,
}: UploadProgressProps) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="bg-surface rounded-lg border border-border p-4 shadow-card"
    >
      <div className="flex items-center justify-between gap-4 mb-2">
        <span className="font-medium text-text truncate flex-1 min-w-0">
          {fileName}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {canPauseResume && status === "uploading" && onPause && (
            <button
              onClick={onPause}
              className="text-sm text-accent hover:text-accent-hover font-medium"
            >
              Pause
            </button>
          )}
          {canPauseResume && status === "paused" && onResume && (
            <button
              onClick={onResume}
              className="text-sm text-accent hover:text-accent-hover font-medium"
            >
              Resume
            </button>
          )}
          {(status === "uploading" || status === "paused") && onCancel && (
            <button
              onClick={onCancel}
              className="text-sm text-error hover:opacity-80 font-medium"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
      <div className="h-2 bg-border rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-accent rounded-full"
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.2 }}
        />
      </div>
      {error && (
        <p className="mt-2 text-sm text-error">{error}</p>
      )}
      {status === "completed" && (
        <p className="mt-2 text-sm text-success">Upload complete</p>
      )}
    </motion.div>
  );
}
