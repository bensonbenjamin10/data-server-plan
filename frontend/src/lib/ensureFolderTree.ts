import { normalizeRelativePath } from "./folderTraversal";

export interface FolderTreeDeps {
  createFolder: (name: string, parentId?: string | null) => Promise<{ id: string }>;
  listFolders: (parentId?: string | null) => Promise<{ folders: { id: string; name: string }[] }>;
}

/**
 * Create nested folders for all directory segments in the given relative paths.
 * Reuses existing folders with the same name under the same parent (find-or-create).
 * Returns a map from directory path (e.g. "a/b") to folder id.
 */
export async function ensureFolderTree(
  deps: FolderTreeDeps,
  relativePaths: string[],
  rootParentId: string | null
): Promise<Map<string, string>> {
  const pathToId = new Map<string, string>();
  const allDirs = new Set<string>();

  for (const raw of relativePaths) {
    const rel = normalizeRelativePath(raw);
    const parts = rel.split("/").filter(Boolean);
    if (parts.length <= 1) continue;
    for (let i = 0; i < parts.length - 1; i++) {
      allDirs.add(parts.slice(0, i + 1).join("/"));
    }
  }

  const sorted = [...allDirs].sort((a, b) => a.split("/").length - b.split("/").length);

  for (const dirPath of sorted) {
    const parts = dirPath.split("/").filter(Boolean);
    const name = parts[parts.length - 1]!;
    const parentPath = parts.slice(0, -1).join("/");
    const parentId = parentPath ? pathToId.get(parentPath) ?? null : rootParentId;

    const { folders } = await deps.listFolders(parentId);
    const existing = folders.find((f) => f.name === name);
    if (existing) {
      pathToId.set(dirPath, existing.id);
    } else {
      const folder = await deps.createFolder(name, parentId);
      pathToId.set(dirPath, folder.id);
    }
  }

  return pathToId;
}

/**
 * Resolve target folder id for a file given its relative path and folder map.
 */
export function getFolderIdForRelativeFile(
  relativePath: string,
  pathToId: Map<string, string>,
  rootParentId: string | null
): string | null {
  const rel = normalizeRelativePath(relativePath);
  const parts = rel.split("/").filter(Boolean);
  if (parts.length <= 1) return rootParentId;
  const dirPath = parts.slice(0, -1).join("/");
  return pathToId.get(dirPath) ?? rootParentId;
}
