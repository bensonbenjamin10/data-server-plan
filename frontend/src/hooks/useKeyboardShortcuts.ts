import { useEffect, useCallback } from "react";

export function useKeyboardShortcuts(handlers: {
  onUpload?: () => void;
  onSearch?: () => void;
}) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "u") {
          e.preventDefault();
          handlers.onUpload?.();
        }
        if (e.key === "f") {
          e.preventDefault();
          handlers.onSearch?.();
        }
      }
    },
    [handlers.onUpload, handlers.onSearch]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
