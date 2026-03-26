/**
 * Upload file directly to R2 via presigned URL with progress tracking.
 */

export interface UploadToR2Options {
  /** Aborts the XHR when aborted (e.g. user cancel). */
  signal?: AbortSignal;
  onProgress?: (loaded: number, total: number) => void;
}

export async function uploadToR2(
  url: string,
  file: File,
  options?: UploadToR2Options
): Promise<void> {
  const { signal, onProgress } = options ?? {};

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    const onAbort = () => {
      xhr.abort();
    };

    if (signal) {
      if (signal.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(e.loaded, e.total);
      }
    });

    xhr.addEventListener("load", () => {
      if (signal) signal.removeEventListener("abort", onAbort);
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    });

    xhr.addEventListener("error", () => {
      if (signal) signal.removeEventListener("abort", onAbort);
      reject(new Error("Upload failed"));
    });

    xhr.addEventListener("abort", () => {
      if (signal) signal.removeEventListener("abort", onAbort);
      reject(new DOMException("Aborted", "AbortError"));
    });

    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.send(file);
  });
}
