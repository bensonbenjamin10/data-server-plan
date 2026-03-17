import { motion } from "framer-motion";
import type { FileRecord } from "@/lib/api";
import { getFileIcon } from "@/lib/fileIcons";

interface FileListProps {
  files: FileRecord[];
  folders: { id: string; name: string; path: string }[];
  selectedIds: Set<string>;
  onSelect: (id: string, isFolder: boolean, modifiers?: { shift?: boolean; ctrl?: boolean }) => void;
  onSelectAll?: (checked: boolean) => void;
  onDoubleClick: (id: string, isFolder: boolean, file?: FileRecord) => void;
  onDownload: (file: FileRecord) => void;
  onDelete: (file: FileRecord) => void;
  onRename?: (file: FileRecord) => void;
  onRenameFolder?: (folder: { id: string; name: string }) => void;
  onMove?: (file: FileRecord) => void;
  onMoveFolder?: (folder: { id: string; name: string }) => void;
  onDeleteFolder?: (folder: { id: string; name: string }) => void;
  onDrop?: (item: { id: string; isFolder: boolean }, targetFolderId: string | null) => void;
  currentFolderId?: string | null;
  onContextMenu?: (e: React.MouseEvent, item: { id: string; name: string; isFolder: boolean }, file?: FileRecord) => void;
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
  selectedIds,
  onSelect,
  onSelectAll,
  onDoubleClick,
  onDownload,
  onDelete,
  onRename,
  onRenameFolder,
  onMove,
  onMoveFolder,
  onDeleteFolder,
  onDrop,
  currentFolderId = null,
  onContextMenu,
}: FileListProps) {
  const handleDragStart = (e: React.DragEvent, id: string, isFolder: boolean) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ id, isFolder }));
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const handleDrop = (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    if (!onDrop) return;
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json")) as { id: string; isFolder: boolean };
      onDrop(data, targetFolderId);
    } catch {}
  };
  const allIds = [...folders.map((f) => f.id), ...files.map((f) => f.id)];
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));

  return (
    <div
      className="border border-border rounded-lg overflow-hidden bg-surface"
      onDragOver={onDrop ? handleDragOver : undefined}
      onDrop={onDrop ? (e) => handleDrop(e, currentFolderId) : undefined}
    >
      <div className="grid grid-cols-[32px_1fr_100px_120px_100px] gap-4 px-4 py-3 bg-surface-hover text-sm font-medium text-text-muted border-b border-border items-center">
        {onSelectAll && (
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => onSelectAll(e.target.checked)}
            className="rounded border-border text-accent focus:ring-accent"
          />
        )}
        {!onSelectAll && <span />}
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
          draggable={!!onDrop}
          onDragStart={onDrop ? (e) => handleDragStart(e as unknown as React.DragEvent, folder.id, true) : undefined}
          onDragOver={onDrop ? handleDragOver : undefined}
          onDrop={onDrop ? (e) => handleDrop(e as unknown as React.DragEvent, folder.id) : undefined}
          className={`grid grid-cols-[32px_1fr_100px_120px_100px] gap-4 px-4 py-3 items-center cursor-pointer hover:bg-surface-hover transition-colors group ${
            selectedIds.has(folder.id) ? "bg-accent/10" : ""
          }`}
          onClick={(e) => onSelect(folder.id, true, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey })}
          onDoubleClick={() => onDoubleClick(folder.id, true)}
          onContextMenu={(e) => onContextMenu?.(e, { id: folder.id, name: folder.name, isFolder: true })}
        >
          <input
            type="checkbox"
            checked={selectedIds.has(folder.id)}
            onChange={() => onSelect(folder.id, true)}
            onClick={(e) => e.stopPropagation()}
            className="rounded border-border text-accent focus:ring-accent"
          />
          <span className="font-medium text-text"><span className="text-lg">📁</span> {folder.name}</span>
          <span className="text-text-muted">—</span>
          <span className="text-text-muted">—</span>
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {onRenameFolder && (
              <button
                onClick={(e) => { e.stopPropagation(); onRenameFolder(folder); }}
                className="text-sm text-accent hover:text-accent-hover font-medium"
              >
                Rename
              </button>
            )}
            {onMoveFolder && (
              <button
                onClick={(e) => { e.stopPropagation(); onMoveFolder(folder); }}
                className="text-sm text-accent hover:text-accent-hover font-medium"
              >
                Move
              </button>
            )}
            {onDeleteFolder && (
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder); }}
                className="text-sm text-error hover:opacity-80 font-medium"
              >
                Delete
              </button>
            )}
          </div>
        </motion.div>
      ))}
      {files.map((file) => (
        <motion.div
          key={file.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          draggable={!!onDrop}
          onDragStart={onDrop ? (e) => handleDragStart(e as unknown as React.DragEvent, file.id, false) : undefined}
          onDragOver={onDrop ? handleDragOver : undefined}
          onDrop={onDrop ? (e) => handleDrop(e as unknown as React.DragEvent, file.folderId ?? currentFolderId) : undefined}
          className={`grid grid-cols-[32px_1fr_100px_120px_100px] gap-4 px-4 py-3 items-center cursor-pointer hover:bg-surface-hover transition-colors group ${
            selectedIds.has(file.id) ? "bg-accent/10" : ""
          }`}
          onClick={(e) => onSelect(file.id, false, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey })}
          onDoubleClick={() => onDoubleClick(file.id, false, file)}
          onContextMenu={(e) => onContextMenu?.(e, { id: file.id, name: file.name, isFolder: false }, file)}
        >
          <input
            type="checkbox"
            checked={selectedIds.has(file.id)}
            onChange={() => onSelect(file.id, false)}
            onClick={(e) => e.stopPropagation()}
            className="rounded border-border text-accent focus:ring-accent"
          />
          <span className="font-medium text-text truncate"><span className="text-lg">{getFileIcon(file.name, file.mimeType)}</span> {file.name}</span>
          <span className="text-text-muted text-sm">
            {formatSize(file.size)}
          </span>
          <span className="text-text-muted text-sm">
            {formatDate(file.createdAt)}
          </span>
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-wrap">
            {onRename && (
              <button
                onClick={(e) => { e.stopPropagation(); onRename(file); }}
                className="text-sm text-accent hover:text-accent-hover font-medium"
              >
                Rename
              </button>
            )}
            {onMove && (
              <button
                onClick={(e) => { e.stopPropagation(); onMove(file); }}
                className="text-sm text-accent hover:text-accent-hover font-medium"
              >
                Move
              </button>
            )}
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
