import { useState, useCallback, useRef } from "react";
import { useApi } from "@/lib/api-context";
import { uploadToR2 } from "@/lib/r2-upload";

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB - R2 minimum for non-final parts
const MULTIPART_THRESHOLD = CHUNK_SIZE;

export type UploadStatus =
  | "idle"
  | "uploading"
  | "paused"
  | "completed"
  | "error";

export interface UploadState {
  status: UploadStatus;
  progress: number;
  error: string | null;
  fileName: string | null;
}

export function useResumableUpload() {
  const api = useApi();
  const [state, setState] = useState<UploadState>({
    status: "idle",
    progress: 0,
    error: null,
    fileName: null,
  });
  const abortRef = useRef(false);
  const pauseRef = useRef(false);

  const upload = useCallback(
    async (
      file: File,
      options?: {
        folderId?: string | null;
        onProgress?: (progress: number) => void;
      }
    ) => {
      abortRef.current = false;
      pauseRef.current = false;
      setState({ status: "uploading", progress: 0, error: null, fileName: file.name });

      const key = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

      try {
        if (file.size < MULTIPART_THRESHOLD) {
          // Single presigned PUT
          const { url } = await api.getPresignedUrl(key, file.type);
          await uploadToR2(url, file, (loaded, total) => {
            if (abortRef.current) return;
            const p = total ? (loaded / total) * 100 : 0;
            setState((s) => ({ ...s, progress: p, fileName: file.name }));
            options?.onProgress?.(p);
          });
          if (abortRef.current) return;
          await api.completeUpload({
            key,
            name: file.name,
            size: file.size,
            mimeType: file.type,
            folderId: options?.folderId,
          });
        } else {
          // Multipart upload
          const { uploadId } = await api.createMultipartUpload(key);
          if (abortRef.current) return;

          const totalParts = Math.ceil(file.size / CHUNK_SIZE);
          const completedParts: { partNumber: number; etag: string }[] = [];

          for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
            while (pauseRef.current && !abortRef.current) {
              await new Promise((r) => setTimeout(r, 200));
            }
            if (abortRef.current) {
              await api.abortMultipartUpload(key, uploadId);
              return;
            }

            const start = (partNumber - 1) * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);

            const { url } = await api.getPresignedPartUrl(
              key,
              uploadId,
              partNumber
            );

            const etag = await uploadPartToR2(url, chunk, partNumber);
            completedParts.push({ partNumber, etag });

            const progress = (partNumber / totalParts) * 100;
            setState((s) => ({ ...s, progress, fileName: file.name }));
            options?.onProgress?.(progress);
          }

          if (abortRef.current) {
            await api.abortMultipartUpload(key, uploadId);
            return;
          }

          await api.completeMultipartUpload({
            key,
            uploadId,
            parts: completedParts,
            name: file.name,
            size: file.size,
            mimeType: file.type,
            folderId: options?.folderId,
          });
        }

        setState({ status: "completed", progress: 100, error: null, fileName: file.name });
      } catch (err) {
        setState((s) => ({
          ...s,
          status: "error",
          error: err instanceof Error ? err.message : "Upload failed",
          fileName: file.name,
        }));
        throw err;
      }
    },
    [api]
  );

  const pause = useCallback(() => {
    pauseRef.current = true;
    setState((s) => ({ ...s, status: "paused" }));
  }, []);

  const resume = useCallback(() => {
    pauseRef.current = false;
    setState((s) => ({ ...s, status: "uploading" }));
  }, []);

  const cancel = useCallback(() => {
    abortRef.current = true;
    pauseRef.current = false;
  }, []);

  const reset = useCallback(() => {
    setState({ status: "idle", progress: 0, error: null, fileName: null });
  }, []);

  return { upload, pause, resume, cancel, reset, state };
}

async function uploadPartToR2(
  url: string,
  chunk: Blob,
  _partNumber: number
): Promise<string> {
  const res = await fetch(url, {
    method: "PUT",
    body: chunk,
    headers: { "Content-Type": "application/octet-stream" },
  });
  if (!res.ok) throw new Error(`Part upload failed: ${res.status}`);
  const etag = res.headers.get("ETag");
  if (!etag) throw new Error("Missing ETag in part response");
  return etag.replace(/"/g, "");
}
