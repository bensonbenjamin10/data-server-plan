import { motion } from "framer-motion";

interface BulkActionBarProps {
  selectedCount: number;
  selectedFiles: { id: string; name: string }[];
  selectedFolders: { id: string; name: string }[]; // used for bulk move
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkDownload: () => void;
  onBulkMove: () => void;
}

export function BulkActionBar({
  selectedCount,
  selectedFiles,
  selectedFolders: _selectedFolders,
  onClearSelection,
  onBulkDelete,
  onBulkDownload,
  onBulkMove,
}: BulkActionBarProps) {
  const hasFiles = selectedFiles.length > 0;

  return (
    <motion.div
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 10, opacity: 0 }}
      className="flex items-center gap-4 px-4 py-3 bg-surface border-t border-border rounded-lg"
    >
      <span className="font-medium text-text">
        {selectedCount} selected
      </span>
      <div className="flex gap-2">
        {hasFiles && (
          <button
            onClick={onBulkDownload}
            className="text-sm px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-hover font-medium focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
          >
            Download
          </button>
        )}
        <button
          onClick={onBulkMove}
          className="text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-surface-hover font-medium text-text focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
        >
          Move
        </button>
        <button
          onClick={onBulkDelete}
          className="text-sm px-3 py-1.5 rounded-lg bg-error text-white hover:opacity-90 font-medium"
        >
          Delete
        </button>
      </div>
      <button
        onClick={onClearSelection}
        className="text-sm text-text-muted hover:text-text ml-auto"
      >
        Clear selection
      </button>
    </motion.div>
  );
}
