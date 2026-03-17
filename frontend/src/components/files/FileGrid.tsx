import { motion } from "framer-motion";
import type { FileRecord } from "@/lib/api";

interface FileGridProps {
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

export function FileGrid({
  files,
  folders,
  selectedId,
  onSelect,
  onDoubleClick,
  onDownload,
  onDelete,
}: FileGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
      {folders.map((folder) => (
        <motion.div
          key={folder.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`p-4 rounded-lg border cursor-pointer hover:bg-neutral/20 transition-colors text-center ${
            selectedId === folder.id
              ? "border-accent bg-accent/10"
              : "border-neutral/60"
          }`}
          onClick={() => onSelect(folder.id, true)}
          onDoubleClick={() => onDoubleClick(folder.id, true)}
        >
          <div className="text-3xl mb-2">📁</div>
          <p className="font-medium text-text truncate text-sm">{folder.name}</p>
        </motion.div>
      ))}
      {files.map((file) => (
        <motion.div
          key={file.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`p-4 rounded-lg border cursor-pointer hover:bg-neutral/20 transition-colors text-center group relative ${
            selectedId === file.id
              ? "border-accent bg-accent/10"
              : "border-neutral/60"
          }`}
          onClick={() => onSelect(file.id, false)}
          onDoubleClick={() => onDoubleClick(file.id, false)}
        >
          <div className="text-3xl mb-2">📄</div>
          <p className="font-medium text-text truncate text-sm">{file.name}</p>
          <p className="text-xs text-text-muted mt-1">{formatSize(file.size)}</p>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownload(file);
              }}
              className="text-xs text-accent hover:text-accent-hover font-medium"
            >
              Download
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(file);
              }}
              className="text-xs text-error hover:opacity-80 font-medium"
            >
              Delete
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
