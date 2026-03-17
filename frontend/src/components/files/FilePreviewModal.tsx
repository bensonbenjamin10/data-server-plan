import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string | null;
  fileName: string;
  mimeType: string | null;
}

export function FilePreviewModal({
  isOpen,
  onClose,
  url,
  fileName,
  mimeType,
}: FilePreviewModalProps) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const isImage = /^(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(ext) ||
    (mimeType?.startsWith("image/"));
  const isPdf = ext === "pdf" || mimeType === "application/pdf";
  const isText = /^(txt|md|json|xml|html|css|js|ts|tsx|jsx)$/i.test(ext) ||
    mimeType?.startsWith("text/");

  useEffect(() => {
    if (!isOpen || !url) return;
    setError(null);
    setTextContent(null);
    if (isText) {
      fetch(url)
        .then((r) => r.text())
        .then(setTextContent)
        .catch(() => setError("Failed to load"));
    }
  }, [isOpen, url, isText]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.95 }}
          className="max-w-4xl max-h-[90vh] w-full bg-surface rounded-lg overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-2 border-b border-neutral/60">
            <span className="font-medium truncate">{fileName}</span>
            <button
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
              <iframe src={url} title={fileName} className="w-full h-[70vh] border-0" />
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
              <p className="text-text-muted">Preview not available for this file type.</p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
