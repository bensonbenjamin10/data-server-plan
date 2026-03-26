import { useCallback, useEffect, useRef, useState } from "react";
import { useResumableUpload } from "./useResumableUpload";

export interface UseUploadQueueOptions {
  /** Called after each file finishes uploading successfully (for cache invalidation). */
  onUploadComplete?: () => void;
}

export type QueueItemStatus = "queued" | "uploading" | "completed" | "error" | "cancelled";

export interface UploadQueueItem {
  id: string;
  fileName: string;
  relativePath?: string;
  status: QueueItemStatus;
  progress: number;
  error: string | null;
  file: File;
  folderId: string | null;
}

export interface QueuedUploadInput {
  file: File;
  folderId: string | null;
  relativePath?: string;
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `uq-${Date.now()}-${idCounter}`;
}

export function useUploadQueue(options?: UseUploadQueueOptions) {
  const onUploadCompleteRef = useRef(options?.onUploadComplete);
  useEffect(() => {
    onUploadCompleteRef.current = options?.onUploadComplete;
  }, [options?.onUploadComplete]);

  const { upload, pause, resume, cancel, reset, state: uploadHookState } = useResumableUpload();
  const [items, setItems] = useState<UploadQueueItem[]>([]);
  const queueRef = useRef<UploadQueueItem[]>([]);
  const processingRef = useRef(false);
  const currentItemIdRef = useRef<string | null>(null);

  const syncItems = useCallback(() => {
    setItems([...queueRef.current]);
  }, []);

  const runQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      while (true) {
        const idx = queueRef.current.findIndex((i) => i.status === "queued");
        if (idx === -1) break;

        const item = queueRef.current[idx];
        currentItemIdRef.current = item.id;
        queueRef.current[idx] = { ...item, status: "uploading", progress: 0, error: null };
        syncItems();

        try {
          await upload(item.file, {
            folderId: item.folderId,
            onProgress: (p) => {
              const j = queueRef.current.findIndex((x) => x.id === item.id);
              if (j !== -1) {
                queueRef.current[j] = { ...queueRef.current[j], progress: p };
                syncItems();
              }
            },
          });
          const j = queueRef.current.findIndex((x) => x.id === item.id);
          if (j !== -1) {
            queueRef.current[j] = {
              ...queueRef.current[j],
              status: "completed",
              progress: 100,
              error: null,
            };
            onUploadCompleteRef.current?.();
          }
        } catch (e) {
          const j = queueRef.current.findIndex((x) => x.id === item.id);
          if (j !== -1) {
            const errMsg = e instanceof Error ? e.message : "Upload failed";
            const wasAbort =
              e instanceof DOMException && e.name === "AbortError";
            queueRef.current[j] = {
              ...queueRef.current[j],
              status: wasAbort ? "cancelled" : "error",
              error: wasAbort ? null : errMsg,
            };
          }
        }
        currentItemIdRef.current = null;
        syncItems();
      }
    } finally {
      processingRef.current = false;
      if (queueRef.current.some((i) => i.status === "queued")) {
        queueMicrotask(() => void runQueue());
      }
    }
  }, [upload, syncItems]);

  const addFiles = useCallback(
    (inputs: QueuedUploadInput[]) => {
      if (inputs.length === 0) return;
      const newItems: UploadQueueItem[] = inputs.map((inp) => ({
        id: nextId(),
        fileName: inp.file.name,
        relativePath: inp.relativePath,
        status: "queued" as const,
        progress: 0,
        error: null,
        file: inp.file,
        folderId: inp.folderId,
      }));
      queueRef.current = [...queueRef.current, ...newItems];
      syncItems();
      void runQueue();
    },
    [runQueue, syncItems]
  );

  const retryItem = useCallback(
    (id: string) => {
      const idx = queueRef.current.findIndex((i) => i.id === id);
      if (idx === -1) return;
      const item = queueRef.current[idx];
      if (item.status !== "error") return;
      queueRef.current[idx] = {
        ...item,
        status: "queued",
        progress: 0,
        error: null,
      };
      syncItems();
      void runQueue();
    },
    [runQueue, syncItems]
  );

  const cancelCurrent = useCallback(() => {
    cancel();
    const id = currentItemIdRef.current;
    if (id) {
      const idx = queueRef.current.findIndex((i) => i.id === id);
      if (idx !== -1 && queueRef.current[idx].status === "uploading") {
        queueRef.current[idx] = {
          ...queueRef.current[idx],
          status: "cancelled",
          error: null,
        };
        syncItems();
      }
    }
  }, [cancel, syncItems]);

  const clearCompleted = useCallback(() => {
    queueRef.current = queueRef.current.filter((i) => i.status !== "completed" && i.status !== "cancelled");
    syncItems();
  }, [syncItems]);

  const hasActiveWork =
    items.some((i) => i.status === "queued" || i.status === "uploading") ||
    uploadHookState.status === "uploading" ||
    uploadHookState.status === "paused";

  return {
    items,
    addFiles,
    retryItem,
    cancelCurrent,
    clearCompleted,
    pause,
    resume,
    reset,
    uploadHookState,
    hasActiveWork,
  };
}
