import { motion } from "framer-motion";
import type { FileRecord } from "@/lib/api";

interface FileListProps {
  files: FileRecord[];
  folders: { id: string; name: string; path: string }[];
  selectedId: string | null;
  onSelect: (id: string, isFolder: boolean) => void;
  onDoubleClick: (id: string, isFolder: boolean) => void;
  onDownload: (file: FileRecord) => void;
  onDelete: (file: FileRecord) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function FileList({
  files,
  folders,
  selectedId,
  onSelect,
  onDoubleClick,
  onDownload,
  onDelete,
}: FileListProps) {
  return (
    <div className="border border-neutral/60 rounded-lg overflow-hidden bg-surface">
      <div className="grid grid-cols-[1fr_100px_120px_100px] gap-4 px-4 py-3 bg-neutral/20 text-sm font-medium text-text-muted border-b border-neutral/60">
        <span>Name</span>
        <span>Size</span>
        <span>Modified</span>
        <span></span>
      </div>
      {folders.map((folder) => (
        <motion.div
          key={folder.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`grid grid-cols-[1fr_100px_120px_100px] gap-4 px-4 py-3 items-center cursor-pointer hover:bg-neutral/20 transition-colors ${
            selectedId === folder.id ? "bg-accent/10" : ""
          }`}
          onClick={() => onSelect(folder.id, true)}
          onDoubleClick={() => onDoubleClick(folder.id, true)}
        >
          <span className="font-medium text-text">📁 {folder.name}</span>
          <span className="text-text-muted">—</span>
          <span className="text-text-muted">—</span>
          <span></span>
        </motion.div>
      ))}
      {files.map((file) => (
        <motion.div
          key={file.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`grid grid-cols-[1fr_100px_120px_100px] gap-4 px-4 py-3 items-center cursor-pointer hover:bg-neutral/20 transition-colors group ${
            selectedId === file.id ? "bg-accent/10" : ""
          }`}
          onClick={() => onSelect(file.id, false)}
          onDoubleClick={() => onDoubleClick(file.id, false)}
        >
          <span className="font-medium text-text truncate">{file.name}</span>
          <span className="text-text-muted text-sm">
            {formatSize(file.size)}
          </span>
          <span className="text-text-muted text-sm">
            {formatDate(file.createdAt)}
          </span>
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownload(file);
              }}
              className="text-sm text-accent hover:text-accent-hover font-medium"
            >
              Download
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(file);
              }}
              className="text-sm text-error hover:opacity-80 font-medium"
            >
              Delete
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
