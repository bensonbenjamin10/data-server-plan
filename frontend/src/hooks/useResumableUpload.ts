import { useState, useCallback, useRef } from "react";
import { useApi } from "@/lib/api-context";
import { uploadToR2 } from "@/lib/r2-upload";

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB - R2 minimum for non-final parts
const MULTIPART_THRESHOLD = CHUNK_SIZE;
const PART_TIMEOUT_MS = 60_000;
const MAX_PART_ATTEMPTS = 3;
const MULTIPART_CONCURRENCY = 2;

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

function anyAbortSignal(signals: AbortSignal[]): AbortSignal {
  const c = new AbortController();
  for (const s of signals) {
    if (s.aborted) {
      c.abort();
      return c.signal;
    }
    s.addEventListener("abort", () => c.abort(), { once: true });
  }
  return c.signal;
}

async function uploadPartToR2Once(
  url: string,
  chunk: Blob,
  parentSignals: AbortSignal[]
): Promise<string> {
  const timeout = new AbortController();
  const tid = setTimeout(() => timeout.abort(), PART_TIMEOUT_MS);
  const signal = anyAbortSignal([...parentSignals, timeout.signal]);
  try {
    const res = await fetch(url, {
      method: "PUT",
      body: chunk,
      headers: { "Content-Type": "application/octet-stream" },
      signal,
    });
    if (!res.ok) throw new Error(`Part upload failed: ${res.status}`);
    const etag = res.headers.get("ETag");
    if (!etag) throw new Error("Missing ETag in part response");
    return etag.replace(/"/g, "");
  } finally {
    clearTimeout(tid);
  }
}

async function uploadPartToR2WithRetry(
  url: string,
  chunk: Blob,
  parentSignals: AbortSignal[]
): Promise<string> {
  let lastErr: Error | undefined;
  for (let attempt = 1; attempt <= MAX_PART_ATTEMPTS; attempt++) {
    try {
      return await uploadPartToR2Once(url, chunk, parentSignals);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (e instanceof DOMException && e.name === "AbortError") throw lastErr;
      if (parentSignals.some((s) => s.aborted)) throw lastErr;
      if (attempt < MAX_PART_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 200 * attempt));
      }
    }
  }
  throw lastErr ?? new Error("Part upload failed");
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
  const xhrAbortRef = useRef<AbortController | null>(null);
  const multipartSessionAbortRef = useRef<AbortController | null>(null);

  const upload = useCallback(
    async (
      file: File,
      options?: {
        folderId?: string | null;
        onProgress?: (progress: number) => void;
        signal?: AbortSignal;
      }
    ) => {
      abortRef.current = false;
      pauseRef.current = false;
      xhrAbortRef.current = null;
      multipartSessionAbortRef.current = null;
      setState({ status: "uploading", progress: 0, error: null, fileName: file.name });

      const externalSignal = options?.signal;
      const isAborted = () =>
        abortRef.current || externalSignal?.aborted === true;

      const key = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

      try {
        if (file.size < MULTIPART_THRESHOLD) {
          const ac = new AbortController();
          xhrAbortRef.current = ac;
          const signals = [ac.signal];
          if (externalSignal) signals.push(externalSignal);
          const merged = anyAbortSignal(signals);

          const { url } = await api.getPresignedUrl(key, file.type);
          if (isAborted()) {
            throw new DOMException("Aborted", "AbortError");
          }

          await uploadToR2(url, file, {
            signal: merged,
            onProgress: (loaded, total) => {
              if (isAborted()) return;
              const p = total ? (loaded / total) * 100 : 0;
              setState((s) => ({ ...s, progress: p, fileName: file.name }));
              options?.onProgress?.(p);
            },
          });
          xhrAbortRef.current = null;
          if (isAborted()) {
            throw new DOMException("Aborted", "AbortError");
          }
          await api.completeUpload({
            key,
            name: file.name,
            size: file.size,
            mimeType: file.type,
            folderId: options?.folderId,
          });
        } else {
          const sessionAbort = new AbortController();
          multipartSessionAbortRef.current = sessionAbort;
          const sessionSignals = [sessionAbort.signal];
          if (externalSignal) sessionSignals.push(externalSignal);

          const { uploadId } = await api.createMultipartUpload(key);
          if (isAborted()) {
            await api.abortMultipartUpload(key, uploadId).catch(() => {});
            throw new DOMException("Aborted", "AbortError");
          }

          const totalParts = Math.ceil(file.size / CHUNK_SIZE);
          const completedParts: { partNumber: number; etag: string }[] = [];
          let completedCount = 0;

          const uploadOnePart = async (partNumber: number) => {
            while (pauseRef.current && !isAborted()) {
              await new Promise((r) => setTimeout(r, 200));
            }
            if (isAborted()) {
              throw new DOMException("Aborted", "AbortError");
            }

            const start = (partNumber - 1) * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);

            const { url } = await api.getPresignedPartUrl(key, uploadId, partNumber);
            if (isAborted()) throw new DOMException("Aborted", "AbortError");

            const etag = await uploadPartToR2WithRetry(url, chunk, sessionSignals);
            completedParts.push({ partNumber, etag });

            completedCount += 1;
            const progress = (completedCount / totalParts) * 100;
            setState((s) => ({ ...s, progress, fileName: file.name }));
            options?.onProgress?.(progress);
          };

          try {
            for (let start = 1; start <= totalParts; start += MULTIPART_CONCURRENCY) {
              const batch: number[] = [];
              for (let i = 0; i < MULTIPART_CONCURRENCY && start + i <= totalParts; i++) {
                batch.push(start + i);
              }
              await Promise.all(batch.map((pn) => uploadOnePart(pn)));
            }
          } catch (e) {
            if (isAborted() || (e instanceof DOMException && e.name === "AbortError")) {
              await api.abortMultipartUpload(key, uploadId).catch(() => {});
              throw e instanceof DOMException && e.name === "AbortError"
                ? e
                : new DOMException("Aborted", "AbortError");
            }
            throw e;
          }

          if (isAborted()) {
            await api.abortMultipartUpload(key, uploadId).catch(() => {});
            throw new DOMException("Aborted", "AbortError");
          }

          completedParts.sort((a, b) => a.partNumber - b.partNumber);

          await api.completeMultipartUpload({
            key,
            uploadId,
            parts: completedParts,
            name: file.name,
            size: file.size,
            mimeType: file.type,
            folderId: options?.folderId,
          });
          multipartSessionAbortRef.current = null;
        }

        setState({ status: "completed", progress: 100, error: null, fileName: file.name });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setState({ status: "idle", progress: 0, error: null, fileName: null });
          throw err;
        }
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
    xhrAbortRef.current?.abort();
    multipartSessionAbortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    setState({ status: "idle", progress: 0, error: null, fileName: null });
  }, []);

  return { upload, pause, resume, cancel, reset, state };
}
