import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api-context";
import { useAuth } from "@/lib/auth-context";
import { Tabs } from "@/components/ui/Tabs";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { getFileIconComponent } from "@/lib/fileIcons";
import {
  Settings as SettingsIcon,
  User,
  Monitor,
  LayoutGrid,
  LayoutList,
  ArrowRight,
  LogOut,
} from "lucide-react";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

const TYPE_DOT_COLORS: Record<string, string> = {
  images: "bg-blue-500",
  documents: "bg-emerald-500",
  videos: "bg-purple-500",
  audio: "bg-amber-500",
  other: "bg-zinc-500",
};

const tabs = [
  { id: "general", label: "General" },
  { id: "storage", label: "Storage" },
  { id: "account", label: "Account" },
];

export function Settings() {
  const api = useApi();
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("general");

  const [defaultView, setDefaultView] = useState<string>(() =>
    localStorage.getItem("preferred_file_view") || "list"
  );

  const { data: breakdown, isLoading: breakdownLoading } = useQuery({
    queryKey: ["storage-breakdown"],
    queryFn: () => api.getStorageBreakdown(),
    enabled: activeTab === "storage",
  });

  const handleViewChange = (view: string) => {
    setDefaultView(view);
    localStorage.setItem("preferred_file_view", view);
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        <h1 className="text-2xl font-display font-semibold text-text tracking-tight">Settings</h1>

        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        <AnimatePresence mode="wait">
          {/* General Tab */}
          {activeTab === "general" && (
            <motion.div
              key="general"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Appearance */}
              <div className="rounded-xl border border-border bg-surface p-6">
                <SectionHeader title="Appearance" description="Customize how the app looks" />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-text">Theme</p>
                      <p className="text-xs text-text-muted mt-0.5">Choose between light and dark mode</p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-hover text-text-muted text-sm">
                      <Monitor size={16} />
                      Dark (default)
                    </div>
                  </div>
                </div>
              </div>

              {/* File View Preference */}
              <div className="rounded-xl border border-border bg-surface p-6">
                <SectionHeader title="File View" description="Choose your default file view layout" />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => handleViewChange("list")}
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                      defaultView === "list"
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border bg-surface-hover text-text-muted hover:text-text"
                    }`}
                  >
                    <LayoutList size={18} />
                    List View
                  </button>
                  <button
                    type="button"
                    onClick={() => handleViewChange("grid")}
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                      defaultView === "grid"
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border bg-surface-hover text-text-muted hover:text-text"
                    }`}
                  >
                    <LayoutGrid size={18} />
                    Grid View
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Storage Tab */}
          {activeTab === "storage" && (
            <motion.div
              key="storage"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Storage Usage */}
              <div className="rounded-xl border border-border bg-surface p-6">
                <SectionHeader title="Storage Usage" />
                {breakdownLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                ) : breakdown ? (
                  <div className="space-y-4">
                    <ProgressBar
                      value={breakdown.totalSize}
                      max={10 * 1024 * 1024 * 1024}
                      label={`${formatSize(breakdown.totalSize)} of 10 GB used`}
                      showPercentage
                      size="lg"
                    />
                    <p className="text-sm text-text-muted">{breakdown.fileCount} total files</p>
                  </div>
                ) : null}
              </div>

              {/* Type Breakdown */}
              <div className="rounded-xl border border-border bg-surface p-6">
                <SectionHeader title="File Type Breakdown" />
                {breakdownLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : breakdown?.byType && breakdown.byType.length > 0 ? (
                  <div className="space-y-3">
                    {breakdown.byType
                      .sort((a, b) => b.size - a.size)
                      .map((t) => (
                        <div key={t.category} className="flex items-center gap-3">
                          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${TYPE_DOT_COLORS[t.category] || TYPE_DOT_COLORS.other}`} />
                          <span className="text-sm font-medium text-text capitalize flex-1">{t.category}</span>
                          <span className="text-sm text-text-muted">{t.count} files</span>
                          <span className="text-sm font-medium text-text w-20 text-right">{formatSize(t.size)}</span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-muted">No files uploaded yet</p>
                )}
              </div>

              {/* Largest Files */}
              <div className="rounded-xl border border-border bg-surface overflow-hidden">
                <div className="p-6 pb-0">
                  <SectionHeader title="Largest Files" description="Top 5 files by size" />
                </div>
                {breakdownLoading ? (
                  <div className="p-4 space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : breakdown?.largestFiles && breakdown.largestFiles.length > 0 ? (
                  <div className="divide-y divide-border">
                    {breakdown.largestFiles.map((file, i) => {
                      const Icon = getFileIconComponent(file.name, file.mimeType);
                      return (
                        <div key={file.id} className="px-6 py-3.5 flex items-center gap-3 hover:bg-surface-hover/30 transition-colors">
                          <span className="text-xs text-text-muted font-mono w-5">{i + 1}</span>
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-hover text-text-muted shrink-0">
                            <Icon size={16} />
                          </div>
                          <span className="text-sm text-text truncate flex-1">{file.name}</span>
                          <Badge variant="default">{formatSize(file.size)}</Badge>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-sm text-text-muted">No files uploaded yet</div>
                )}
              </div>
            </motion.div>
          )}

          {/* Account Tab */}
          {activeTab === "account" && (
            <motion.div
              key="account"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Quick Links */}
              <div className="rounded-xl border border-border bg-surface p-6">
                <SectionHeader title="Account" description="Manage your account settings" />
                <div className="space-y-2">
                  <Link
                    to="/profile"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border hover:bg-surface-hover transition-colors group"
                  >
                    <User size={18} className="text-text-muted" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text">Profile</p>
                      <p className="text-xs text-text-muted">View and edit your profile, change password</p>
                    </div>
                    <ArrowRight size={16} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                  <Link
                    to="/organization"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border hover:bg-surface-hover transition-colors group"
                  >
                    <SettingsIcon size={18} className="text-text-muted" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text">Organization</p>
                      <p className="text-xs text-text-muted">Manage organization settings and members</p>
                    </div>
                    <ArrowRight size={16} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </div>
              </div>

              {/* Session */}
              <div className="rounded-xl border border-border bg-surface p-6">
                <SectionHeader title="Session" />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-text">Signed in as</p>
                      <p className="text-sm text-text-muted">{user?.email}</p>
                    </div>
                    <Badge variant="success" size="sm">Active</Badge>
                  </div>
                  <button
                    type="button"
                    onClick={() => { signOut(); navigate("/sign-in"); }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 border border-error/30 text-error rounded-lg text-sm font-medium hover:bg-error/10 transition-colors"
                  >
                    <LogOut size={16} />
                    Sign Out
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
