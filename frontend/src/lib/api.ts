const API_BASE = import.meta.env.VITE_API_URL || "/api";

export function createApi(getToken: () => Promise<string | null>) {
  async function fetchWithAuth(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const token = await getToken();
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };
    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }
    return fetch(`${API_BASE}${url}`, { ...options, headers });
  }

  return {
  async getPresignedUrl(key: string, contentType?: string) {
    const res = await fetchWithAuth("/upload/presign", {
      method: "POST",
      body: JSON.stringify({ key, contentType }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ url: string; key: string }>;
  },

  async completeUpload(data: {
    key: string;
    name: string;
    size: number;
    mimeType?: string;
    folderId?: string | null;
  }) {
    const res = await fetchWithAuth("/upload/complete", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createMultipartUpload(key: string) {
    const res = await fetchWithAuth("/upload/multipart/create", {
      method: "POST",
      body: JSON.stringify({ key }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ uploadId: string; key: string }>;
  },

  async getPresignedPartUrl(
    key: string,
    uploadId: string,
    partNumber: number
  ) {
    const res = await fetchWithAuth("/upload/multipart/presign-part", {
      method: "POST",
      body: JSON.stringify({ key, uploadId, partNumber }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ url: string; partNumber: number }>;
  },

  async listParts(key: string, uploadId: string) {
    const res = await fetchWithAuth(
      `/upload/multipart/parts?key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}`
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ parts: { partNumber: number; etag: string }[] }>;
  },

  async completeMultipartUpload(data: {
    key: string;
    uploadId: string;
    parts: { partNumber: number; etag: string }[];
    name: string;
    size: number;
    mimeType?: string;
    folderId?: string | null;
  }) {
    const res = await fetchWithAuth("/upload/multipart/complete", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async abortMultipartUpload(key: string, uploadId: string) {
    const res = await fetchWithAuth("/upload/multipart/abort", {
      method: "POST",
      body: JSON.stringify({ key, uploadId }),
    });
    if (!res.ok) throw new Error(await res.text());
  },

  async listFiles(folderId?: string | null) {
    const qs = folderId ? `?folderId=${folderId}` : "";
    const res = await fetchWithAuth(`/files${qs}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ files: FileRecord[] }>;
  },

  async getFileStats() {
    const res = await fetchWithAuth("/files/stats");
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ fileCount: number; totalSize: number }>;
  },

  async getDashboardStats() {
    const res = await fetchWithAuth("/files/dashboard-stats");
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<DashboardStats>;
  },

  async getStorageBreakdown() {
    const res = await fetchWithAuth("/files/storage-breakdown");
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<StorageBreakdown>;
  },

  async getProfile() {
    const res = await fetchWithAuth("/auth/profile");
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<UserProfile>;
  },

  async updateProfile(data: { email?: string; currentPassword?: string; newPassword?: string }) {
    const res = await fetchWithAuth("/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getOrg() {
    const res = await fetchWithAuth("/org");
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<OrgDetails>;
  },

  async updateOrg(data: { name: string }) {
    const res = await fetchWithAuth("/org", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getOrgMembers() {
    const res = await fetchWithAuth("/org/members");
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ members: OrgMemberRecord[] }>;
  },

  async inviteOrgMember(email: string, role: string) {
    const res = await fetchWithAuth("/org/members/invite", {
      method: "POST",
      body: JSON.stringify({ email, role }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateMemberRole(memberId: string, role: string) {
    const res = await fetchWithAuth(`/org/members/${memberId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async removeMember(memberId: string) {
    const res = await fetchWithAuth(`/org/members/${memberId}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await res.text());
  },

  async getRecentFiles(limit?: number) {
    const qs = limit ? `?limit=${limit}` : "";
    const res = await fetchWithAuth(`/files/recent${qs}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ files: FileRecord[] }>;
  },

  async getDownloadUrl(fileId: string) {
    const res = await fetchWithAuth(`/files/${fileId}/download`);
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ url: string; name: string }>;
  },

  async updateFile(fileId: string, data: { name?: string; folderId?: string | null }) {
    const res = await fetchWithAuth(`/files/${fileId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async deleteFile(fileId: string) {
    const res = await fetchWithAuth(`/files/${fileId}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await res.text());
  },

  async listFolders(parentId?: string | null) {
    const qs = parentId ? `?parentId=${parentId}` : "";
    const res = await fetchWithAuth(`/folders${qs}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ folders: FolderRecord[] }>;
  },

  async getFolderTree() {
    const res = await fetchWithAuth("/folders/tree");
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ tree: FolderTreeNode[] }>;
  },

  async getFolder(id: string) {
    const res = await fetchWithAuth(`/folders/${id}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<FolderRecord>;
  },

  async createFolder(name: string, parentId?: string | null) {
    const res = await fetchWithAuth("/folders", {
      method: "POST",
      body: JSON.stringify({ name, parentId }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateFolder(folderId: string, data: { name?: string; parentId?: string | null }) {
    const res = await fetchWithAuth(`/folders/${folderId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async deleteFolder(folderId: string) {
    const res = await fetchWithAuth(`/folders/${folderId}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await res.text());
  },

  async search(q: string) {
    const res = await fetchWithAuth(`/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{
      files: Array<{ id: string; name: string; folderId: string | null; folderName: string | null; createdAt: string }>;
      folders: Array<{ id: string; name: string; path: string; parentId: string | null }>;
    }>;
  },
};
}

export interface FileRecord {
  id: string;
  name: string;
  r2Key: string;
  size: number;
  mimeType: string | null;
  folderId: string | null;
  createdAt: string;
  folder?: { name: string } | null;
  uploadedBy?: { email: string } | null;
}

export interface FolderRecord {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
}

export interface FolderTreeNode {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
  children: FolderTreeNode[];
}

export interface DashboardStats {
  fileCount: number;
  folderCount: number;
  totalSize: number;
  recentUploads: number;
  filesByType: Array<{ category: string; count: number; size: number }>;
  storageTimeline: Array<{ month: string; size: number }>;
}

export interface StorageBreakdown {
  byType: Array<{ category: string; count: number; size: number }>;
  largestFiles: Array<{ id: string; name: string; size: number; mimeType: string | null }>;
  totalSize: number;
  fileCount: number;
}

export interface UserProfile {
  id: string;
  email: string;
  createdAt: string;
  orgs: Array<{ id: string; name: string; role: string }>;
  filesUploaded: number;
  totalStorageUsed: number;
}

export interface OrgDetails {
  id: string;
  name: string;
  createdAt: string;
  memberCount: number;
  totalStorage: number;
}

export interface OrgMemberRecord {
  id: string;
  userId: string;
  email: string;
  role: string;
  createdAt: string;
}
