import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useApi } from "@/lib/api-context";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, RoleBadge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { Files, HardDrive, Key, Building2 } from "lucide-react";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getPasswordStrength(password: string): { label: string; color: string; width: string } {
  if (password.length < 8) return { label: "Too short", color: "bg-error", width: "w-1/4" };
  let score = 0;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  if (password.length >= 12) score++;
  if (score <= 2) return { label: "Weak", color: "bg-warning", width: "w-2/5" };
  if (score <= 3) return { label: "Good", color: "bg-accent", width: "w-3/5" };
  return { label: "Strong", color: "bg-success", width: "w-full" };
}

export function Profile() {
  const api = useApi();
  const { switchOrg } = useAuth();
  const { showToast } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.getProfile(),
  });

  const passwordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.updateProfile(data),
    onSuccess: () => {
      showToast("Password updated successfully", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: Error) => {
      showToast(err.message || "Failed to update password", "error");
    },
  });

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast("Passwords do not match", "error");
      return;
    }
    if (newPassword.length < 8) {
      showToast("Password must be at least 8 characters", "error");
      return;
    }
    passwordMutation.mutate({ currentPassword, newPassword });
  };

  const strength = getPasswordStrength(newPassword);

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-8"
      >
        <h1 className="text-2xl font-display font-semibold text-text tracking-tight">Profile</h1>

        {/* User Info Card */}
        <div className="rounded-xl border border-border bg-surface p-6 flex items-center gap-6">
          {isLoading ? (
            <div className="flex items-center gap-6 w-full">
              <Skeleton className="w-16 h-16 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          ) : profile ? (
            <>
              <Avatar email={profile.email} size="xl" />
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-semibold text-text">{profile.email}</h2>
                <p className="text-sm text-text-muted mt-1">
                  Member since {new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="accent" size="sm">
                    {profile.orgs.length} {profile.orgs.length === 1 ? "organization" : "organizations"}
                  </Badge>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Activity Stats */}
        {profile && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard icon={Files} label="Files Uploaded" value={profile.filesUploaded} index={0} />
            <StatCard icon={HardDrive} label="Storage Used" value={formatSize(profile.totalStorageUsed)} index={1} />
          </div>
        )}

        {/* Security Section */}
        <div className="rounded-xl border border-border bg-surface p-6">
          <SectionHeader
            title="Security"
            description="Update your password"
          />
          <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1.5">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1.5">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
                required
                minLength={8}
              />
              {newPassword && (
                <div className="mt-2 space-y-1">
                  <div className="h-1.5 rounded-full bg-border/30 overflow-hidden">
                    <div className={`h-full rounded-full ${strength.color} ${strength.width} transition-all`} />
                  </div>
                  <p className="text-xs text-text-muted">{strength.label}</p>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1.5">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
                required
                minLength={8}
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-error mt-1">Passwords do not match</p>
              )}
            </div>
            <button
              type="submit"
              disabled={passwordMutation.isPending || !currentPassword || !newPassword || newPassword !== confirmPassword}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Key size={16} />
              {passwordMutation.isPending ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>

        {/* Organization Memberships */}
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="p-6 pb-0">
            <SectionHeader title="Organizations" description="Your organization memberships" />
          </div>
          {isLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : profile?.orgs && profile.orgs.length > 0 ? (
            <div className="divide-y divide-border">
              {profile.orgs.map((org) => (
                <div key={org.id} className="px-6 py-4 flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent shrink-0">
                    <Building2 size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text">{org.name}</p>
                    <RoleBadge role={org.role} />
                  </div>
                  <button
                    type="button"
                    onClick={() => switchOrg(org.id)}
                    className="text-sm text-accent hover:text-accent-hover transition-colors font-medium"
                  >
                    Switch
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-sm text-text-muted">No organizations found</div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
