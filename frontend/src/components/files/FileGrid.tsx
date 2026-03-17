import { motion } from "framer-motion";
import type { FileRecord } from "@/lib/api";

interface FileGridProps {
  files: FileRecord[];
  folders: { id: string; name: string; path: string }[];
  selectedIds: Set<string>;
  onSelect: (id: string, isFolder: boolean, modifiers?: { shift?: boolean; ctrl?: boolean }) => void;
  onDoubleClick: (id: string, isFolder: boolean) => void;
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

export function FileGrid({
  files,
  folders,
  selectedIds,
  onSelect,
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
}: FileGridProps) {
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

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
      {folders.map((folder) => (
        <motion.div
          key={folder.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          draggable={!!onDrop}
          onDragStart={onDrop ? (e) => handleDragStart(e as unknown as React.DragEvent, folder.id, true) : undefined}
          onDragOver={onDrop ? handleDragOver : undefined}
          onDrop={onDrop ? (e) => handleDrop(e as unknown as React.DragEvent, folder.id) : undefined}
          className={`p-4 rounded-lg border cursor-pointer hover:bg-neutral/20 transition-colors text-center relative group ${
            selectedIds.has(folder.id)
              ? "border-accent bg-accent/10"
              : "border-neutral/60"
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
            className="absolute top-2 left-2 rounded border-neutral/60"
          />
          <div className="text-3xl mb-2">📁</div>
          <p className="font-medium text-text truncate text-sm">{folder.name}</p>
          <div className="flex gap-1 mt-2 flex-wrap justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            {onRenameFolder && (
              <button onClick={(e) => { e.stopPropagation(); onRenameFolder(folder); }} className="text-xs text-accent hover:text-accent-hover">Rename</button>
            )}
            {onMoveFolder && (
              <button onClick={(e) => { e.stopPropagation(); onMoveFolder(folder); }} className="text-xs text-accent hover:text-accent-hover">Move</button>
            )}
            {onDeleteFolder && (
              <button onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder); }} className="text-xs text-error">Delete</button>
            )}
          </div>
        </motion.div>
      ))}
      {files.map((file) => (
        <motion.div
          key={file.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`p-4 rounded-lg border cursor-pointer hover:bg-neutral/20 transition-colors text-center group relative ${
            selectedIds.has(file.id)
              ? "border-accent bg-accent/10"
              : "border-neutral/60"
          }`}
          draggable={!!onDrop}
          onDragStart={onDrop ? (e) => handleDragStart(e as unknown as React.DragEvent, file.id, false) : undefined}
          onDragOver={onDrop ? handleDragOver : undefined}
          onDrop={onDrop ? (e) => handleDrop(e as unknown as React.DragEvent, file.folderId ?? currentFolderId) : undefined}
          onClick={(e) => onSelect(file.id, false, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey })}
          onDoubleClick={() => onDoubleClick(file.id, false)}
          onContextMenu={(e) => onContextMenu?.(e, { id: file.id, name: file.name, isFolder: false }, file)}
        >
          <input
            type="checkbox"
            checked={selectedIds.has(file.id)}
            onChange={() => onSelect(file.id, false)}
            onClick={(e) => e.stopPropagation()}
            className="absolute top-2 left-2 rounded border-neutral/60"
          />
          <div className="text-3xl mb-2">📄</div>
          <p className="font-medium text-text truncate text-sm">{file.name}</p>
          <p className="text-xs text-text-muted mt-1">{formatSize(file.size)}</p>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 flex-wrap justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            {onRename && (
              <button onClick={(e) => { e.stopPropagation(); onRename(file); }} className="text-xs text-accent hover:text-accent-hover">Rename</button>
            )}
            {onMove && (
              <button onClick={(e) => { e.stopPropagation(); onMove(file); }} className="text-xs text-accent hover:text-accent-hover">Move</button>
            )}
            <button onClick={(e) => { e.stopPropagation(); onDownload(file); }} className="text-xs text-accent hover:text-accent-hover">Download</button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(file); }} className="text-xs text-error">Delete</button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
