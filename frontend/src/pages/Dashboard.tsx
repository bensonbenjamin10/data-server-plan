import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api-context";
import { useAuth } from "@/lib/auth-context";
import { getFileIconComponent } from "@/lib/fileIcons";
import { StatCard } from "@/components/ui/StatCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { StatCardSkeleton, ListItemSkeleton } from "@/components/ui/Skeleton";
import {
  Files,
  FolderOpen,
  Clock,
  HardDrive,
  Upload,
  FolderPlus,
  ArrowRight,
} from "lucide-react";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const TYPE_COLORS: Record<string, string> = {
  images: "bg-blue-500",
  documents: "bg-emerald-500",
  videos: "bg-purple-500",
  audio: "bg-amber-500",
  other: "bg-zinc-500",
};

const TYPE_TEXT_COLORS: Record<string, string> = {
  images: "text-blue-400",
  documents: "text-emerald-400",
  videos: "text-purple-400",
  audio: "text-amber-400",
  other: "text-zinc-400",
};

export function Dashboard() {
  const api = useApi();
  const { user, org } = useAuth();
  const navigate = useNavigate();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.getDashboardStats(),
  });

  const { data: recentData, isLoading: recentLoading } = useQuery({
    queryKey: ["files", "recent"],
    queryFn: () => api.getRecentFiles(10),
  });

  const recentFiles = recentData?.files ?? [];
  const emailPrefix = user?.email?.split("@")[0] ?? "";
  const totalTypeSize = stats?.filesByType.reduce((s, t) => s + t.size, 0) || 1;

  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-8"
      >
        {/* Greeting */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-semibold text-text tracking-tight">
            {getGreeting()}, {emailPrefix}
          </h1>
          <p className="text-text-muted mt-1">
            {org?.name ? `${org.name} — ` : ""}Here's an overview of your storage
          </p>
        </div>

        {/* Stat Cards */}
        {statsLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Files} label="Total Files" value={stats.fileCount} index={0} />
            <StatCard icon={FolderOpen} label="Folders" value={stats.folderCount} index={1} />
            <StatCard
              icon={Clock}
              label="Recent Uploads"
              value={stats.recentUploads}
              subtitle="Last 7 days"
              index={2}
            />
            <StatCard
              icon={HardDrive}
              label="Storage Used"
              value={formatSize(stats.totalSize)}
              index={3}
            />
          </div>
        ) : null}

        {/* Middle Row: File Type Breakdown + Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* File Type Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="lg:col-span-2 rounded-xl border border-border bg-surface p-5"
          >
            <SectionHeader title="Storage by File Type" description="Breakdown of your stored files" />
            {stats && stats.filesByType.length > 0 ? (
              <div className="space-y-4">
                {/* Stacked bar */}
                <div className="h-3 rounded-full overflow-hidden flex bg-border/30">
                  {stats.filesByType
                    .sort((a, b) => b.size - a.size)
                    .map((t) => (
                      <div
                        key={t.category}
                        className={`${TYPE_COLORS[t.category] || TYPE_COLORS.other} transition-all`}
                        style={{ width: `${Math.max((t.size / totalTypeSize) * 100, 2)}%` }}
                        title={`${t.category}: ${formatSize(t.size)}`}
                      />
                    ))}
                </div>
                {/* Legend */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {stats.filesByType
                    .sort((a, b) => b.size - a.size)
                    .map((t) => (
                      <div key={t.category} className="flex items-center gap-2.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${TYPE_COLORS[t.category] || TYPE_COLORS.other}`} />
                        <div className="min-w-0">
                          <p className={`text-sm font-medium capitalize ${TYPE_TEXT_COLORS[t.category] || "text-text-muted"}`}>
                            {t.category}
                          </p>
                          <p className="text-xs text-text-muted">
                            {t.count} files · {formatSize(t.size)}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-muted py-4">No files uploaded yet</p>
            )}
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="rounded-xl border border-border bg-surface p-5 flex flex-col"
          >
            <SectionHeader title="Quick Actions" />
            <div className="flex flex-col gap-3 flex-1 justify-center">
              <Link
                to="/files"
                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition-colors shadow-sm"
              >
                <Upload size={18} />
                <span className="flex-1">Upload Files</span>
                <ArrowRight size={16} className="opacity-60" />
              </Link>
              <Link
                to="/files"
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-surface-hover text-text font-medium hover:bg-border/30 transition-colors"
              >
                <FolderPlus size={18} className="text-text-muted" />
                <span className="flex-1">New Folder</span>
                <ArrowRight size={16} className="opacity-40" />
              </Link>
              <Link
                to="/organization"
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-surface-hover text-text font-medium hover:bg-border/30 transition-colors"
              >
                <Files size={18} className="text-text-muted" />
                <span className="flex-1">Manage Organization</span>
                <ArrowRight size={16} className="opacity-40" />
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="rounded-xl border border-border bg-surface overflow-hidden"
        >
          <div className="p-5 pb-0">
            <SectionHeader
              title="Recent Activity"
              description="Latest file uploads and changes"
              action={
                <Link
                  to="/files"
                  className="text-sm text-accent hover:text-accent-hover transition-colors font-medium inline-flex items-center gap-1"
                >
                  View all <ArrowRight size={14} />
                </Link>
              }
            />
          </div>
          <div className="divide-y divide-border">
            {recentLoading ? (
              Array.from({ length: 5 }).map((_, i) => <ListItemSkeleton key={i} />)
            ) : recentFiles.length > 0 ? (
              recentFiles.map((file) => {
                const IconComponent = getFileIconComponent(file.name, file.mimeType);
                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => navigate(file.folderId ? `/files/${file.folderId}` : "/files")}
                    className="w-full px-5 py-3.5 text-left hover:bg-surface-hover/50 flex items-center gap-4 transition-colors group"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-hover text-text-muted shrink-0 group-hover:bg-border/50 transition-colors">
                      <IconComponent size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text truncate">{file.name}</p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {file.folder?.name && <span>{file.folder.name} · </span>}
                        {formatSize(file.size)}
                        {file.uploadedBy?.email && <span> · {file.uploadedBy.email}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant="default" size="sm">{file.mimeType?.split("/")[0] || "file"}</Badge>
                      <span className="text-xs text-text-muted whitespace-nowrap">{timeAgo(file.createdAt)}</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-12 text-center text-sm text-text-muted">
                No files uploaded yet. Start by uploading your first file.
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
