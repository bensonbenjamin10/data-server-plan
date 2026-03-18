import { useEffect, useCallback } from "react";

export function useKeyboardShortcuts(handlers: {
  onUpload?: () => void;
  onSearch?: () => void;
  onEscape?: () => void;
  onSelectAll?: () => void;
}) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handlers.onEscape?.();
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "u") {
          e.preventDefault();
          handlers.onUpload?.();
        }
        if (e.key === "f") {
          e.preventDefault();
          handlers.onSearch?.();
        }
        if (e.key === "a" && handlers.onSelectAll) {
          e.preventDefault();
          handlers.onSelectAll();
        }
      }
    },
    [handlers.onUpload, handlers.onSearch, handlers.onEscape, handlers.onSelectAll]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
