import { useState, useRef, useEffect } from "react";
import { getFileIcon } from "@/lib/fileIcons";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api-context";

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const api = useApi();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["search", query],
    queryFn: () => api.search(query),
    enabled: query.length >= 2,
    staleTime: 30000,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const files = data?.files ?? [];
  const folders = data?.folders ?? [];
  const hasResults = files.length > 0 || folders.length > 0;
  const showDropdown = isOpen && query.length >= 2;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="search"
        placeholder="Search files..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        className="w-48 px-3 py-1.5 rounded-lg border border-neutral/60 bg-surface text-sm text-text placeholder:text-text-muted"
      />
      {showDropdown && (
        <div className="absolute top-full left-0 mt-1 w-80 max-h-64 overflow-auto bg-surface border border-neutral/60 rounded-lg shadow-lg z-50">
          {isLoading ? (
            <div className="p-4 text-text-muted text-sm">Searching...</div>
          ) : !hasResults ? (
            <div className="p-4 text-text-muted text-sm">No results</div>
          ) : (
            <div className="py-2">
              {folders.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    navigate(`/files/${f.id}`);
                    setQuery("");
                    setIsOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-neutral/30 flex items-center gap-2"
                >
                  <span className="text-lg">📁</span>
                  <span className="truncate">{f.name}</span>
                </button>
              ))}
              {files.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    navigate(f.folderId ? `/files/${f.folderId}` : "/files");
                    setQuery("");
                    setIsOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-neutral/30 flex items-center gap-2"
                >
                  <span className="text-lg">{getFileIcon(f.name, null)}</span>
                  <span className="truncate flex-1">{f.name}</span>
                  {f.folderName && (
                    <span className="text-xs text-text-muted truncate max-w-24">{f.folderName}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
