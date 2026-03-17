import { useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useApi } from "@/lib/api-context";
import { usePresignedDownload } from "@/hooks/usePresignedDownload";
import { useResumableUpload } from "@/hooks/useResumableUpload";
import { useToast } from "@/components/ui/Toast";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { UploadZone } from "@/components/upload/UploadZone";
import { UploadProgress } from "@/components/upload/UploadProgress";
import { FileList } from "@/components/files/FileList";
import { FileGrid } from "@/components/files/FileGrid";

export function Files() {
  const { folderId } = useParams();
  const navigate = useNavigate();
  const api = useApi();
  const { download } = usePresignedDownload();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useKeyboardShortcuts({
    onUpload: () => fileInputRef.current?.click(),
  });

  const { data: filesData } = useQuery({
    queryKey: ["files", folderId || null],
    queryFn: () => api.listFiles(folderId || null),
  });

  const { data: foldersData } = useQuery({
    queryKey: ["folders", folderId || null],
    queryFn: () => api.listFolders(folderId || null),
  });

  const { data: currentFolder } = useQuery({
    queryKey: ["folder", folderId],
    queryFn: () => api.getFolder(folderId!),
    enabled: !!folderId,
  });

  const {
    upload,
    pause,
    resume,
    cancel,
    state: uploadState,
  } = useResumableUpload();

  const files = filesData?.files ?? [];
  const folders = foldersData?.folders ?? [];

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["files"] });
    queryClient.invalidateQueries({ queryKey: ["folders"] });
  }, [queryClient]);

  const handleFilesSelected = useCallback(
    async (fileList: File[]) => {
      for (const file of fileList) {
        try {
          await upload(file, {
            folderId: folderId || null,
            onProgress: () => {},
          });
          invalidate();
          showToast(`${file.name} uploaded successfully`, "success");
        } catch {
          showToast(`Failed to upload ${file.name}`, "error");
        }
      }
    },
    [upload, folderId, invalidate, showToast]
  );

  const handleDownload = useCallback(
    async (file: { id: string; name: string }) => {
      try {
        await download(file.id, file.name);
        showToast("Download started", "success");
      } catch {
        showToast("Download failed", "error");
      }
    },
    [download, showToast]
  );

  const handleDelete = useCallback(
    async (file: { id: string; name: string }) => {
      if (!confirm(`Delete "${file.name}"?`)) return;
      try {
        await api.deleteFile(file.id);
        queryClient.invalidateQueries({ queryKey: ["files"] });
        showToast("File deleted", "success");
      } catch {
        showToast("Delete failed", "error");
      }
    },
    [api, queryClient, showToast]
  );

  const handleDoubleClick = useCallback(
    (id: string, isFolder: boolean) => {
      if (isFolder) {
        navigate(`/files/${id}`);
      }
    },
    [navigate]
  );

  const handleCreateFolder = useCallback(async () => {
    const name = prompt("Folder name:");
    if (!name?.trim()) return;
    try {
      await api.createFolder(name.trim(), folderId || null);
      invalidate();
      showToast("Folder created", "success");
    } catch {
      showToast("Failed to create folder", "error");
    }
  }, [api, folderId, invalidate, showToast]);

  const breadcrumbItems = [
    { label: "Files", path: "/files" },
    ...(folderId && currentFolder
      ? [{ label: currentFolder.name, path: undefined } as const]
      : folderId
      ? [{ label: "Folder", path: undefined } as const]
      : []),
  ];

  return (
    <div className="p-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Breadcrumbs items={breadcrumbItems} />
            <button
              onClick={handleCreateFolder}
              className="text-sm px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-hover font-medium"
            >
              New folder
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded ${viewMode === "list" ? "bg-accent/20 text-accent" : "text-text-muted hover:bg-neutral/30"}`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded ${viewMode === "grid" ? "bg-accent/20 text-accent" : "text-text-muted hover:bg-neutral/30"}`}
            >
              Grid
            </button>
          </div>
        </div>

        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = e.target.files ? Array.from(e.target.files) : [];
              if (files.length) handleFilesSelected(files);
              e.target.value = "";
            }}
          />
          <UploadZone onFilesSelected={handleFilesSelected} />
          <p className="text-xs text-text-muted mt-2">
            Tip: Ctrl+U to upload
          </p>
        </div>

        {uploadState.status !== "idle" && uploadState.fileName && (
          <UploadProgress
            fileName={uploadState.fileName}
            status={uploadState.status}
            progress={uploadState.progress}
            error={uploadState.error}
            onPause={pause}
            onResume={resume}
            onCancel={cancel}
            canPauseResume={true}
          />
        )}

        {files.length === 0 && folders.length === 0 ? (
          <div className="text-center py-16 bg-surface rounded-lg border border-neutral/60">
            <p className="text-4xl mb-4">📂</p>
            <p className="text-text-muted font-medium">No files yet</p>
            <p className="text-sm text-text-muted mt-1">
              Drag and drop files above or click to upload
            </p>
          </div>
        ) : (
          viewMode === "list" ? (
            <FileList
              files={files}
              folders={folders}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onDoubleClick={handleDoubleClick}
              onDownload={handleDownload}
              onDelete={handleDelete}
            />
          ) : (
            <FileGrid
              files={files}
              folders={folders}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onDoubleClick={handleDoubleClick}
              onDownload={handleDownload}
              onDelete={handleDelete}
            />
          )
        )}
      </motion.div>
    </div>
  );
}
