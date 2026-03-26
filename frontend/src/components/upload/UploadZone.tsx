import { useCallback, useRef, useState } from "react";
import {
  collectFilesFromDataTransfer,
  normalizeRelativePath,
  type FileWithRelativePath,
} from "@/lib/folderTraversal";

export type { FileWithRelativePath };

interface UploadZoneProps {
  onFilesSelected: (files: FileWithRelativePath[]) => void;
  disabled?: boolean;
  className?: string;
}

export function UploadZone({
  onFilesSelected,
  disabled,
  className = "",
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      try {
        const files = await collectFilesFromDataTransfer(e.dataTransfer);
        if (files.length) onFilesSelected(files);
      } catch {
        const fallback = Array.from(e.dataTransfer.files).map((f) => ({
          file: f,
          relativePath: f.name,
        }));
        if (fallback.length) onFilesSelected(fallback);
      }
    },
    [onFilesSelected, disabled]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files ? Array.from(e.target.files) : [];
      if (list.length) {
        onFilesSelected(
          list.map((f) => ({
            file: f,
            relativePath: normalizeRelativePath(
              (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name
            ),
          }))
        );
      }
      e.target.value = "";
    },
    [onFilesSelected]
  );

  const handleFolderInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files ? Array.from(e.target.files) : [];
      if (list.length) {
        onFilesSelected(
          list.map((f) => ({
            file: f,
            relativePath: normalizeRelativePath(
              (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name
            ),
          }))
        );
      }
      e.target.value = "";
    },
    [onFilesSelected]
  );

  return (
    <div className={`space-y-3 ${className}`}>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative border-2 border-dashed rounded-lg transition-colors bg-surface ${
          isDragging && !disabled
            ? "border-accent bg-accent/10"
            : "border-border hover:border-border-subtle"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInput}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
        />
        <div className="p-8 text-center pointer-events-none">
          <p className="text-text-muted font-medium">
            {isDragging ? "Drop files or folders here" : "Drag and drop files or folders, or click to choose files"}
          </p>
        </div>
      </div>

      <input
        ref={folderInputRef}
        type="file"
        {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
        multiple
        onChange={handleFolderInput}
        disabled={disabled}
        className="hidden"
      />

      <div className="flex flex-wrap gap-2 justify-center">
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          className="text-sm px-4 py-2 rounded-lg border border-border bg-surface hover:bg-surface-hover text-text font-medium disabled:opacity-50"
        >
          Choose files
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => folderInputRef.current?.click()}
          className="text-sm px-4 py-2 rounded-lg border border-border bg-surface hover:bg-surface-hover text-text font-medium disabled:opacity-50"
        >
          Upload folder
        </button>
      </div>
    </div>
  );
}
