import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/** Max bytes loaded into memory for text preview (aligned with typical safe tab usage). */
const MAX_TEXT_PREVIEW_BYTES = 1024 * 1024;

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string | null;
  fileName: string;
  mimeType: string | null;
  /** When set, text preview is skipped if size exceeds the limit without fetching. */
  fileSize?: number | null;
}

function classifyPreview(ext: string, mimeType: string | null) {
  const isImage =
    /^(jpg|jpeg|png|gif|webp|svg|bmp|avif|ico)$/i.test(ext) ||
    (mimeType?.startsWith("image/") ?? false);
  const isPdf = ext === "pdf" || mimeType === "application/pdf";
  const isVideo =
    (mimeType?.startsWith("video/") ?? false) ||
    /^(mp4|webm|mov|avi|mkv)$/i.test(ext);
  const isAudio =
    (mimeType?.startsWith("audio/") ?? false) ||
    /^(mp3|wav|ogg|flac|m4a|opus)$/i.test(ext);
  const isText =
    (mimeType?.startsWith("text/") ?? false) ||
    mimeType === "application/json" ||
    mimeType === "application/javascript" ||
    mimeType === "application/xml" ||
    mimeType === "text/xml" ||
    /^(txt|md|json|xml|html|css|js|ts|tsx|jsx|yaml|yml)$/i.test(ext);

  return { isImage, isPdf, isVideo, isAudio, isText };
}

export function FilePreviewModal({
  isOpen,
  onClose,
  url,
  fileName,
  mimeType,
  fileSize,
}: FilePreviewModalProps) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const { isImage, isPdf, isVideo, isAudio, isText } = useMemo(
    () => classifyPreview(ext, mimeType),
    [ext, mimeType]
  );

  useEffect(() => {
    if (!isOpen || !url) return;
    setError(null);
    setTextContent(null);
    if (!isText) return;

    if (fileSize != null && fileSize > MAX_TEXT_PREVIEW_BYTES) {
      setError(
        `This file is too large to preview (max ${(MAX_TEXT_PREVIEW_BYTES / 1024 / 1024).toFixed(0)} MB). Download to view.`
      );
      return;
    }

    fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load");
        const buf = await r.arrayBuffer();
        if (buf.byteLength > MAX_TEXT_PREVIEW_BYTES) {
          throw new Error("too_large");
        }
        return new TextDecoder("utf-8", { fatal: false }).decode(buf);
      })
      .then(setTextContent)
      .catch((e) =>
        setError(
          e?.message === "too_large"
            ? `This file is too large to preview (max ${(MAX_TEXT_PREVIEW_BYTES / 1024 / 1024).toFixed(0)} MB). Download to view.`
            : "Failed to load"
        )
      );
  }, [isOpen, url, isText, fileSize]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          key="file-preview-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="max-w-4xl max-h-[90vh] w-full bg-surface rounded-lg overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface">
              <span className="font-medium truncate">{fileName}</span>
              <button
                type="button"
                onClick={onClose}
                className="text-text-muted hover:text-text px-2"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 min-h-0">
              {isImage && url ? (
                <img src={url} alt={fileName} className="max-w-full h-auto" />
              ) : isPdf && url ? (
                <iframe
                  src={url}
                  title={fileName}
                  className="w-full h-[70vh] border-0"
                />
              ) : isVideo && url ? (
                <video
                  src={url}
                  controls
                  className="max-w-full max-h-[70vh]"
                  playsInline
                />
              ) : isAudio && url ? (
                <div className="flex items-center justify-center py-8">
                  <audio src={url} controls className="w-full max-w-md" />
                </div>
              ) : isText ? (
                error ? (
                  <p className="text-error">{error}</p>
                ) : textContent !== null ? (
                  <pre className="text-sm overflow-auto whitespace-pre-wrap font-mono text-text">
                    {textContent}
                  </pre>
                ) : (
                  <p className="text-text-muted">Loading...</p>
                )
              ) : (
                <p className="text-text-muted">
                  Preview not available for this file type.
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
