import { Modal } from "./Modal";
import type { FolderTreeNode } from "@/lib/api";

interface MoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (targetFolderId: string | null) => void;
  title: string;
  folderTree: FolderTreeNode[];
  excludeFolderId?: string | null;
  /** When moving multiple folders, pass all selected folder IDs to exclude them and their descendants. */
  excludeFolderIds?: string[] | null;
}

function collectDescendantIds(node: FolderTreeNode): Set<string> {
  const ids = new Set<string>([node.id]);
  for (const child of node.children) {
    for (const id of collectDescendantIds(child)) ids.add(id);
  }
  return ids;
}

function FolderOption({
  node,
  depth,
  excludeIds,
  onSelect,
}: {
  node: FolderTreeNode;
  depth: number;
  excludeIds: Set<string>;
  onSelect: (id: string | null) => void;
}) {
  if (excludeIds.has(node.id)) return null;

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className="text-left py-2 px-3 rounded hover:bg-surface-hover text-text"
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
      >
        {node.name}
      </button>
      {node.children.map((child) => (
        <FolderOption
          key={child.id}
          node={child}
          depth={depth + 1}
          excludeIds={excludeIds}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

export function MoveModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  folderTree,
  excludeFolderId,
  excludeFolderIds,
}: MoveModalProps) {
  function findNode(nodes: FolderTreeNode[], id: string): FolderTreeNode | null {
    for (const n of nodes) {
      if (n.id === id) return n;
      const found = findNode(n.children, id);
      if (found) return found;
    }
    return null;
  }
  const excludeIds = new Set<string>();
  if (excludeFolderId) {
    const node = findNode(folderTree, excludeFolderId);
    if (node) for (const id of collectDescendantIds(node)) excludeIds.add(id);
  }
  if (excludeFolderIds?.length) {
    for (const folderId of excludeFolderIds) {
      const node = findNode(folderTree, folderId);
      if (node) for (const id of collectDescendantIds(node)) excludeIds.add(id);
    }
  }

  const handleSelect = (id: string | null) => {
    onConfirm(id);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="max-h-64 overflow-auto space-y-1">
        <button
          type="button"
          onClick={() => handleSelect(null)}
          className="w-full text-left py-2 px-3 rounded hover:bg-surface-hover text-text font-medium"
        >
          Root
        </button>
        {folderTree.map((node) => (
          <FolderOption
            key={node.id}
            node={node}
            depth={0}
            excludeIds={excludeIds}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </Modal>
  );
}
