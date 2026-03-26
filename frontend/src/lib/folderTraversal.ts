/**
 * Collect files from drag-and-drop using File System Access API (webkitGetAsEntry).
 */

export interface FileWithRelativePath {
  file: File;
  /** POSIX-style path relative to the dropped root, e.g. "Photos/2024/a.jpg" */
  relativePath: string;
}

async function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  const acc: FileSystemEntry[] = [];
  const readBatch = (): Promise<FileSystemEntry[]> =>
    new Promise((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
  let batch: FileSystemEntry[];
  do {
    batch = await readBatch();
    acc.push(...batch);
  } while (batch.length > 0);
  return acc;
}

async function walkDirectory(
  dirEntry: FileSystemDirectoryEntry,
  prefix: string,
  out: FileWithRelativePath[]
): Promise<void> {
  const reader = dirEntry.createReader();
  const entries = await readAllEntries(reader);

  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isFile) {
      await new Promise<void>((resolve, reject) => {
        (entry as FileSystemFileEntry).file(
          (file) => {
            out.push({ file, relativePath: rel });
            resolve();
          },
          reject
        );
      });
    } else if (entry.isDirectory) {
      await walkDirectory(entry as FileSystemDirectoryEntry, rel, out);
    }
  }
}

/**
 * Collect files from a DataTransfer (drag-and-drop). Supports folders when
 * `webkitGetAsEntry` is available.
 */
export async function collectFilesFromDataTransfer(dt: DataTransfer): Promise<FileWithRelativePath[]> {
  const results: FileWithRelativePath[] = [];
  const items = dt.items;

  if (!items || items.length === 0) {
    return Array.from(dt.files).map((f) => ({ file: f, relativePath: f.name }));
  }

  const itemArray = Array.from(items);
  const canUseEntries = itemArray.some((i) => typeof i.webkitGetAsEntry === "function");

  if (!canUseEntries) {
    return Array.from(dt.files).map((f) => ({ file: f, relativePath: f.name }));
  }

  for (const item of itemArray) {
    if (item.kind !== "file") continue;
    const entry = item.webkitGetAsEntry?.();
    if (!entry) {
      const f = item.getAsFile();
      if (f) results.push({ file: f, relativePath: f.name });
      continue;
    }
    if (entry.isFile) {
      await new Promise<void>((resolve, reject) => {
        (entry as FileSystemFileEntry).file(
          (file) => {
            results.push({ file, relativePath: file.name });
            resolve();
          },
          reject
        );
      });
    } else if (entry.isDirectory) {
      await walkDirectory(entry as FileSystemDirectoryEntry, entry.name, results);
    }
  }

  return results;
}

/**
 * Normalize `webkitRelativePath` from `<input webkitdirectory>` to POSIX-style segments.
 */
export function normalizeRelativePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}
