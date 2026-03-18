import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
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
import { BulkActionBar } from "@/components/files/BulkActionBar";
import { ConfirmModal, PromptModal } from "@/components/ui/Modal";
import { MoveModal } from "@/components/ui/MoveModal";
import { ContextMenu } from "@/components/ui/ContextMenu";
import { FilePreviewModal } from "@/components/files/FilePreviewModal";
import type { FileRecord } from "@/lib/api";

export function Files() {
  const { folderId } = useParams();
  const navigate = useNavigate();
  const api = useApi();
  const { download } = usePresignedDownload();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"name" | "date" | "size">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [fileToDelete, setFileToDelete] = useState<FileRecord | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<{ id: string; name: string } | null>(null);
  const [fileToRename, setFileToRename] = useState<FileRecord | null>(null);
  const [folderToRename, setFolderToRename] = useState<{ id: string; name: string } | null>(null);
  const [fileToMove, setFileToMove] = useState<FileRecord | null>(null);
  const [folderToMove, setFolderToMove] = useState<{ id: string; name: string } | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ id: string; name: string; mimeType: string | null; url: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: { id: string; name: string; isFolder: boolean };
    file?: FileRecord;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSelectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    setSelectedIds(new Set());
    lastSelectedIdRef.current = null;
  }, [folderId]);

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

  const { data: folderTreeData } = useQuery({
    queryKey: ["folders", "tree"],
    queryFn: () => api.getFolderTree(),
  });
  const folderTree = folderTreeData?.tree ?? [];

  const {
    upload,
    pause,
    resume,
    cancel,
    state: uploadState,
  } = useResumableUpload();

  const files = filesData?.files ?? [];
  const folders = foldersData?.folders ?? [];

  const sortedFolders = [...folders].sort((a, b) => {
    const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    return sortDir === "asc" ? cmp : -cmp;
  });
  const sortedFiles = [...files].sort((a, b) => {
    if (sortBy === "name") {
      const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    }
    if (sortBy === "date") {
      const cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    }
    const cmp = a.size - b.size;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["files"] });
    queryClient.invalidateQueries({ queryKey: ["folders"] });
  }, [queryClient]);

  const orderedIds = [...sortedFolders.map((f) => f.id), ...sortedFiles.map((f) => f.id)];

  const handleSelect = useCallback(
    (id: string, _isFolder: boolean, modifiers?: { shift?: boolean; ctrl?: boolean }) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (modifiers?.ctrl) {
          if (next.has(id)) next.delete(id);
          else next.add(id);
          lastSelectedIdRef.current = id;
          return next;
        }
        if (modifiers?.shift && lastSelectedIdRef.current) {
          const lastIdx = orderedIds.indexOf(lastSelectedIdRef.current);
          const idx = orderedIds.indexOf(id);
          const [lo, hi] = lastIdx < idx ? [lastIdx, idx] : [idx, lastIdx];
          for (let i = lo; i <= hi; i++) next.add(orderedIds[i]);
          return next;
        }
        lastSelectedIdRef.current = id;
        return new Set([id]);
      });
    },
    [orderedIds]
  );

  const handleSelectAll = useCallback((checked: boolean) => {
    setSelectedIds(checked ? new Set(orderedIds) : new Set());
  }, [orderedIds]);

  useKeyboardShortcuts({
    onUpload: () => fileInputRef.current?.click(),
    onEscape: () => setSelectedIds(new Set()),
    onSelectAll: () => {
      if (orderedIds.length > 0) handleSelectAll(true);
    },
  });

  const selectedFiles = sortedFiles.filter((f) => selectedIds.has(f.id));
  const selectedFolders = sortedFolders.filter((f) => selectedIds.has(f.id));

  const handleBulkDownload = useCallback(async () => {
    for (const file of selectedFiles) {
      try {
        await download(file.id, file.name);
      } catch {
        showToast(`Failed to download ${file.name}`, "error");
      }
    }
    if (selectedFiles.length > 0) showToast(`${selectedFiles.length} file(s) download started`, "success");
  }, [download, selectedFiles, showToast]);

  const handleBulkDeleteClick = useCallback(() => {
    setBulkDeleteOpen(true);
  }, []);

  const handleBulkDeleteConfirm = useCallback(async () => {
    for (const file of selectedFiles) {
      try {
        await api.deleteFile(file.id);
      } catch {
        showToast(`Failed to delete ${file.name}`, "error");
      }
    }
    for (const folder of selectedFolders) {
      try {
        await api.deleteFolder(folder.id);
      } catch {
        showToast(`Failed to delete ${folder.name}`, "error");
      }
    }
    invalidate();
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
    showToast(`${selectedFiles.length + selectedFolders.length} item(s) deleted`, "success");
  }, [api, selectedFiles, selectedFolders, invalidate, showToast]);

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

  const handleDelete = useCallback((file: FileRecord) => {
    setFileToDelete(file);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!fileToDelete) return;
    try {
      await api.deleteFile(fileToDelete.id);
      queryClient.invalidateQueries({ queryKey: ["files"] });
      showToast("File deleted", "success");
      setFileToDelete(null);
    } catch {
      showToast("Delete failed", "error");
    }
  }, [api, fileToDelete, queryClient, showToast]);

  const handleDoubleClick = useCallback(
    async (id: string, isFolder: boolean, file?: FileRecord) => {
      if (isFolder) {
        navigate(`/files/${id}`);
      } else if (file) {
        try {
          const { url } = await api.getDownloadUrl(file.id);
          setPreviewFile({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType ?? null,
            url,
          });
        } catch {
          showToast("Failed to open preview", "error");
        }
      }
    },
    [navigate, api, showToast]
  );

  const handleCreateFolderClick = useCallback(() => {
    setCreateFolderOpen(true);
  }, []);

  const handleCreateFolderConfirm = useCallback(
    async (name: string) => {
      try {
        await api.createFolder(name.trim(), folderId || null);
        invalidate();
        showToast("Folder created", "success");
      } catch {
        showToast("Failed to create folder", "error");
      }
    },
    [api, folderId, invalidate, showToast]
  );

  const handleRenameFile = useCallback((file: FileRecord) => setFileToRename(file), []);
  const handleRenameFileConfirm = useCallback(
    async (name: string) => {
      if (!fileToRename) return;
      try {
        await api.updateFile(fileToRename.id, { name: name.trim() });
        invalidate();
        showToast("File renamed", "success");
        setFileToRename(null);
      } catch {
        showToast("Failed to rename file", "error");
      }
    },
    [api, fileToRename, invalidate, showToast]
  );

  const handleRenameFolder = useCallback((folder: { id: string; name: string }) => setFolderToRename(folder), []);
  const handleRenameFolderConfirm = useCallback(
    async (name: string) => {
      if (!folderToRename) return;
      try {
        await api.updateFolder(folderToRename.id, { name: name.trim() });
        invalidate();
        showToast("Folder renamed", "success");
        setFolderToRename(null);
      } catch {
        showToast("Failed to rename folder", "error");
      }
    },
    [api, folderToRename, invalidate, showToast]
  );

  const handleMoveFile = useCallback((file: FileRecord) => setFileToMove(file), []);
  const handleMoveFileConfirm = useCallback(
    async (targetFolderId: string | null) => {
      if (!fileToMove) return;
      try {
        await api.updateFile(fileToMove.id, { folderId: targetFolderId });
        invalidate();
        showToast("File moved", "success");
        setFileToMove(null);
      } catch {
        showToast("Failed to move file", "error");
      }
    },
    [api, fileToMove, invalidate, showToast]
  );

  const handleMoveFolder = useCallback((folder: { id: string; name: string }) => setFolderToMove(folder), []);
  const handleMoveFolderConfirm = useCallback(
    async (targetParentId: string | null) => {
      if (!folderToMove) return;
      try {
        await api.updateFolder(folderToMove.id, { parentId: targetParentId });
        invalidate();
        showToast("Folder moved", "success");
        setFolderToMove(null);
      } catch {
        showToast("Failed to move folder", "error");
      }
    },
    [api, folderToMove, invalidate, showToast]
  );

  const handleDeleteFolder = useCallback((folder: { id: string; name: string }) => setFolderToDelete(folder), []);
  const handleDeleteFolderConfirm = useCallback(async () => {
    if (!folderToDelete) return;
    try {
      await api.deleteFolder(folderToDelete.id);
      invalidate();
      showToast("Folder deleted", "success");
      setFolderToDelete(null);
    } catch {
      showToast("Failed to delete folder", "error");
    }
  }, [api, folderToDelete, invalidate, showToast]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, item: { id: string; name: string; isFolder: boolean }, file?: FileRecord) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, item, file });
    },
    []
  );

  const handleBulkMoveClick = useCallback(() => setBulkMoveOpen(true), []);
  const handleDrop = useCallback(
    async (item: { id: string; isFolder: boolean }, targetFolderId: string | null) => {
      if (item.isFolder) {
        if (item.id === targetFolderId) return;
        try {
          await api.updateFolder(item.id, { parentId: targetFolderId });
          invalidate();
          showToast("Folder moved", "success");
        } catch {
          showToast("Failed to move folder", "error");
        }
      } else {
        try {
          await api.updateFile(item.id, { folderId: targetFolderId });
          invalidate();
          showToast("File moved", "success");
        } catch {
          showToast("Failed to move file", "error");
        }
      }
    },
    [api, invalidate, showToast]
  );

  const handleBulkMoveConfirm = useCallback(
    async (targetFolderId: string | null) => {
      for (const file of selectedFiles) {
        try {
          await api.updateFile(file.id, { folderId: targetFolderId });
        } catch {
          showToast(`Failed to move ${file.name}`, "error");
        }
      }
      if (selectedFolders.length > 0) {
        for (const folder of selectedFolders) {
          try {
            await api.updateFolder(folder.id, { parentId: targetFolderId });
          } catch {
            showToast(`Failed to move ${folder.name}`, "error");
          }
        }
      }
      invalidate();
      setSelectedIds(new Set());
      setBulkMoveOpen(false);
      showToast("Items moved", "success");
    },
    [api, selectedFiles, selectedFolders, invalidate, showToast]
  );

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
              onClick={handleCreateFolderClick}
              className="text-sm px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-hover font-medium"
            >
              New folder
            </button>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={`${sortBy}-${sortDir}`}
              onChange={(e) => {
                const [s, d] = e.target.value.split("-") as ["name" | "date" | "size", "asc" | "desc"];
                setSortBy(s);
                setSortDir(d);
              }}
              className="text-sm px-3 py-1.5 rounded-lg border border-border bg-surface text-text"
            >
              <option value="name-asc">Name A–Z</option>
              <option value="name-desc">Name Z–A</option>
              <option value="date-desc">Date (newest)</option>
              <option value="date-asc">Date (oldest)</option>
              <option value="size-desc">Size (largest)</option>
              <option value="size-asc">Size (smallest)</option>
            </select>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded ${viewMode === "list" ? "bg-accent/10 text-accent" : "text-text-muted hover:bg-surface-hover"}`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded ${viewMode === "grid" ? "bg-accent/10 text-accent" : "text-text-muted hover:bg-surface-hover"}`}
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

        <AnimatePresence>
          {selectedIds.size > 0 && (
            <BulkActionBar
            selectedCount={selectedIds.size}
            selectedFiles={selectedFiles}
            selectedFolders={selectedFolders}
            onClearSelection={() => setSelectedIds(new Set())}
            onBulkDelete={handleBulkDeleteClick}
            onBulkDownload={handleBulkDownload}
            onBulkMove={handleBulkMoveClick}
            />
          )}
        </AnimatePresence>

        {files.length === 0 && folders.length === 0 ? (
          <div className="text-center py-16 bg-surface rounded-lg border border-border">
            <p className="text-4xl mb-4">📂</p>
            <p className="text-text-muted font-medium">No files yet</p>
            <p className="text-sm text-text-muted mt-1">
              Drag and drop files above or click to upload
            </p>
          </div>
        ) : viewMode === "list" ? (
          <div
            onClick={(e) => {
              if (!(e.target as HTMLElement).closest("[data-file-explorer-row]")) {
                setSelectedIds(new Set());
              }
            }}
          >
            <FileList
              files={sortedFiles}
              folders={sortedFolders}
              selectedIds={selectedIds}
              onSelect={handleSelect}
              onSelectAll={handleSelectAll}
              onDoubleClick={handleDoubleClick}
              onDownload={handleDownload}
              onDelete={handleDelete}
              onRename={handleRenameFile}
              onRenameFolder={handleRenameFolder}
              onMove={handleMoveFile}
              onMoveFolder={handleMoveFolder}
              onDeleteFolder={handleDeleteFolder}
              onDrop={handleDrop}
              currentFolderId={folderId ?? null}
              onContextMenu={handleContextMenu}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer hover:text-text">
                <input
                  type="checkbox"
                  checked={orderedIds.length > 0 && orderedIds.every((id) => selectedIds.has(id))}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent"
                />
                Select all
              </label>
            </div>
            <div
              onClick={(e) => {
                if (!(e.target as HTMLElement).closest("[data-file-explorer-row]")) {
                  setSelectedIds(new Set());
                }
              }}
            >
              <FileGrid
                files={sortedFiles}
                folders={sortedFolders}
                selectedIds={selectedIds}
                onSelect={handleSelect}
                onDoubleClick={handleDoubleClick}
                onDownload={handleDownload}
                onDelete={handleDelete}
                onRename={handleRenameFile}
                onRenameFolder={handleRenameFolder}
                onMove={handleMoveFile}
                onMoveFolder={handleMoveFolder}
                onDeleteFolder={handleDeleteFolder}
                onDrop={handleDrop}
                currentFolderId={folderId ?? null}
                onContextMenu={handleContextMenu}
              />
            </div>
          </div>
        )}

        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            isOpen={!!contextMenu}
            onClose={() => setContextMenu(null)}
          >
            {selectedIds.size > 1 && selectedIds.has(contextMenu.item.id) ? (
              <>
                {selectedFiles.length > 0 && (
                  <button
                    onClick={() => {
                      handleBulkDownload();
                      setContextMenu(null);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-surface-hover"
                  >
                    Download selected
                  </button>
                )}
                <button
                  onClick={() => {
                    setBulkMoveOpen(true);
                    setContextMenu(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-surface-hover"
                >
                  Move selected
                </button>
                <button
                  onClick={() => {
                    setBulkDeleteOpen(true);
                    setContextMenu(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-error hover:bg-surface-hover"
                >
                  Delete selected
                </button>
              </>
            ) : contextMenu.item.isFolder ? (
              <>
                <button
                  onClick={() => {
                    setFolderToRename({ id: contextMenu.item.id, name: contextMenu.item.name });
                    setContextMenu(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-surface-hover"
                >
                  Rename
                </button>
                <button
                  onClick={() => {
                    setFolderToMove({ id: contextMenu.item.id, name: contextMenu.item.name });
                    setContextMenu(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-surface-hover"
                >
                  Move
                </button>
                <button
                  onClick={() => {
                    setFolderToDelete({ id: contextMenu.item.id, name: contextMenu.item.name });
                    setContextMenu(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-error hover:bg-surface-hover"
                >
                  Delete
                </button>
              </>
            ) : (
              contextMenu.file && (
                <>
                  <button
                    onClick={async () => {
                      try {
                        const { url } = await api.getDownloadUrl(contextMenu.file!.id);
                        setPreviewFile({
                          id: contextMenu.file!.id,
                          name: contextMenu.file!.name,
                          mimeType: contextMenu.file!.mimeType ?? null,
                          url,
                        });
                      } catch {
                        showToast("Failed to load preview", "error");
                      }
                      setContextMenu(null);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-surface-hover"
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => {
                      handleDownload(contextMenu.file!);
                      setContextMenu(null);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-surface-hover"
                  >
                    Download
                  </button>
                  <button
                    onClick={() => {
                      setFileToRename(contextMenu.file!);
                      setContextMenu(null);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-surface-hover"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => {
                      setFileToMove(contextMenu.file!);
                      setContextMenu(null);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-surface-hover"
                  >
                    Move
                  </button>
                  <button
                    onClick={() => {
                      setFileToDelete(contextMenu.file!);
                      setContextMenu(null);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-error hover:bg-surface-hover"
                  >
                    Delete
                  </button>
                </>
              )
            )}
          </ContextMenu>
        )}

        <ConfirmModal
          isOpen={!!fileToDelete}
          onClose={() => setFileToDelete(null)}
          onConfirm={handleConfirmDelete}
          title="Delete file"
          message={fileToDelete ? `Delete "${fileToDelete.name}"? This cannot be undone.` : ""}
          confirmLabel="Delete"
          variant="danger"
        />
        <ConfirmModal
          isOpen={bulkDeleteOpen}
          onClose={() => setBulkDeleteOpen(false)}
          onConfirm={handleBulkDeleteConfirm}
          title="Delete selected"
          message={`Delete ${selectedIds.size} selected item(s)? This cannot be undone.`}
          confirmLabel="Delete"
          variant="danger"
        />
        <PromptModal
          isOpen={createFolderOpen}
          onClose={() => setCreateFolderOpen(false)}
          onConfirm={handleCreateFolderConfirm}
          title="New folder"
          label="Folder name"
          confirmLabel="Create"
        />
        <PromptModal
          isOpen={!!fileToRename}
          onClose={() => setFileToRename(null)}
          onConfirm={handleRenameFileConfirm}
          title="Rename file"
          label="File name"
          defaultValue={fileToRename?.name ?? ""}
          confirmLabel="Rename"
        />
        <PromptModal
          isOpen={!!folderToRename}
          onClose={() => setFolderToRename(null)}
          onConfirm={handleRenameFolderConfirm}
          title="Rename folder"
          label="Folder name"
          defaultValue={folderToRename?.name ?? ""}
          confirmLabel="Rename"
        />
        <ConfirmModal
          isOpen={!!folderToDelete}
          onClose={() => setFolderToDelete(null)}
          onConfirm={handleDeleteFolderConfirm}
          title="Delete folder"
          message={folderToDelete ? `Delete "${folderToDelete.name}" and all its contents? This cannot be undone.` : ""}
          confirmLabel="Delete"
          variant="danger"
        />
        {fileToMove && (
          <MoveModal
            isOpen={!!fileToMove}
            onClose={() => setFileToMove(null)}
            onConfirm={handleMoveFileConfirm}
            title="Move file"
            folderTree={folderTree}
            excludeFolderId={null}
          />
        )}
        {folderToMove && (
          <MoveModal
            isOpen={!!folderToMove}
            onClose={() => setFolderToMove(null)}
            onConfirm={handleMoveFolderConfirm}
            title="Move folder"
            folderTree={folderTree}
            excludeFolderId={folderToMove?.id}
          />
        )}
        {bulkMoveOpen && (
          <MoveModal
            isOpen={bulkMoveOpen}
            onClose={() => setBulkMoveOpen(false)}
            onConfirm={handleBulkMoveConfirm}
            title="Move selected"
            folderTree={folderTree}
            excludeFolderIds={selectedFolders.map((f) => f.id)}
          />
        )}

        <FilePreviewModal
          isOpen={!!previewFile}
          onClose={() => setPreviewFile(null)}
          url={previewFile?.url ?? null}
          fileName={previewFile?.name ?? ""}
          mimeType={previewFile?.mimeType ?? null}
        />
      </motion.div>
    </div>
  );
}
