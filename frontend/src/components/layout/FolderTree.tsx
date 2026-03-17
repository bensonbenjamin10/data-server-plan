import { useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useApi } from "@/lib/api-context";
import { useToast } from "@/components/ui/Toast";
import type { FolderTreeNode } from "@/lib/api";

function FolderTreeItem({
  node,
  depth,
  currentFolderId,
  onDrop,
}: {
  node: FolderTreeNode;
  depth: number;
  currentFolderId: string | null;
  onDrop?: (item: { id: string; isFolder: boolean }, targetFolderId: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isActive = currentFolderId === node.id;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!onDrop) return;
      try {
        const data = JSON.parse(e.dataTransfer.getData("application/json")) as { id: string; isFolder: boolean };
        if (data.id === node.id && data.isFolder) return;
        onDrop(data, node.id);
      } catch {}
    },
    [onDrop, node.id]
  );

  return (
    <div className="flex flex-col">
      <div
        className="flex items-center gap-1 group"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onDragOver={onDrop ? handleDragOver : undefined}
        onDrop={onDrop ? handleDrop : undefined}
      >
        <button
          type="button"
          onClick={() => hasChildren && setIsExpanded((e) => !e)}
          className="w-5 h-6 flex items-center justify-center shrink-0 text-text-muted hover:text-text"
        >
          {hasChildren ? (
            <span className="text-xs">{isExpanded ? "▾" : "▸"}</span>
          ) : (
            <span className="w-2" />
          )}
        </button>
        <Link
          to={`/files/${node.id}`}
          className={`flex-1 min-w-0 py-1.5 px-2 rounded text-sm truncate ${
            isActive
              ? "bg-accent/10 text-accent font-medium"
              : "text-text-muted hover:text-text hover:bg-surface-hover"
          }`}
        >
          {node.name}
        </Link>
      </div>
      <AnimatePresence>
        {hasChildren && isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            {node.children.map((child) => (
              <FolderTreeItem
                key={child.id}
                node={child}
                depth={depth + 1}
                currentFolderId={currentFolderId}
                onDrop={onDrop}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FolderTree() {
  const { folderId } = useParams();
  const api = useApi();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data } = useQuery({
    queryKey: ["folders", "tree"],
    queryFn: () => api.getFolderTree(),
  });

  const tree = data?.tree ?? [];

  const handleDrop = useCallback(
    async (item: { id: string; isFolder: boolean }, targetFolderId: string) => {
      if (item.isFolder) {
        if (item.id === targetFolderId) return;
        try {
          await api.updateFolder(item.id, { parentId: targetFolderId });
          queryClient.invalidateQueries({ queryKey: ["folders"] });
          queryClient.invalidateQueries({ queryKey: ["files"] });
          showToast("Folder moved", "success");
        } catch {
          showToast("Failed to move folder", "error");
        }
      } else {
        try {
          await api.updateFile(item.id, { folderId: targetFolderId });
          queryClient.invalidateQueries({ queryKey: ["folders"] });
          queryClient.invalidateQueries({ queryKey: ["files"] });
          showToast("File moved", "success");
        } catch {
          showToast("Failed to move file", "error");
        }
      }
    },
    [api, queryClient, showToast]
  );

  const handleDropRoot = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      try {
        const data = JSON.parse(e.dataTransfer.getData("application/json")) as { id: string; isFolder: boolean };
        if (data.isFolder) {
          await api.updateFolder(data.id, { parentId: null });
        } else {
          await api.updateFile(data.id, { folderId: null });
        }
        queryClient.invalidateQueries({ queryKey: ["folders"] });
        queryClient.invalidateQueries({ queryKey: ["files"] });
        showToast("Moved to root", "success");
      } catch {
        showToast("Failed to move", "error");
      }
    },
    [api, queryClient, showToast]
  );

  return (
    <div className="flex flex-col gap-0.5 py-1">
      <div
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
        onDrop={handleDropRoot}
        className="py-1.5 px-2 rounded text-sm text-text-muted hover:bg-surface-hover"
      >
        Root
      </div>
      {tree.map((node) => (
        <FolderTreeItem
          key={node.id}
          node={node}
          depth={0}
          currentFolderId={folderId ?? null}
          onDrop={handleDrop}
        />
      ))}
    </div>
  );
}
