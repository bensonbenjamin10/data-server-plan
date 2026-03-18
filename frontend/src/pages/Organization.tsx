import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api-context";
import { Tabs } from "@/components/ui/Tabs";
import { Avatar } from "@/components/ui/Avatar";
import { RoleBadge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatCard } from "@/components/ui/StatCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  Building2,
  Users,
  HardDrive,
  Calendar,
  UserPlus,
  MoreVertical,
  Trash2,
  ShieldCheck,
  Edit3,
  Check,
  X,
} from "lucide-react";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "members", label: "Members" },
  { id: "settings", label: "Settings" },
];

export function Organization() {
  const api = useApi();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState("overview");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [roleMenuId, setRoleMenuId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; email: string } | null>(null);

  const { data: orgData, isLoading: orgLoading } = useQuery({
    queryKey: ["org"],
    queryFn: () => api.getOrg(),
  });

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ["org", "members"],
    queryFn: () => api.getOrgMembers(),
  });

  const updateOrgMutation = useMutation({
    mutationFn: (name: string) => api.updateOrg({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org"] });
      showToast("Organization name updated", "success");
      setEditingName(false);
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  const inviteMutation = useMutation({
    mutationFn: () => api.inviteOrgMember(inviteEmail, inviteRole),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", "members"] });
      showToast("Member invited successfully", "success");
      setInviteEmail("");
      setInviteRole("member");
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => api.updateMemberRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", "members"] });
      showToast("Role updated", "success");
      setRoleMenuId(null);
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.removeMember(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", "members"] });
      queryClient.invalidateQueries({ queryKey: ["org"] });
      showToast("Member removed", "success");
      setConfirmRemove(null);
    },
    onError: (err: Error) => showToast(err.message, "error"),
  });

  const handleSaveName = () => {
    if (nameInput.trim()) updateOrgMutation.mutate(nameInput.trim());
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteEmail.trim()) inviteMutation.mutate();
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        <h1 className="text-2xl font-display font-semibold text-text tracking-tight">Organization</h1>

        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Org Identity */}
              <div className="rounded-xl border border-border bg-surface p-6 flex items-center gap-5">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent/10 text-accent shrink-0">
                  <Building2 size={28} />
                </div>
                <div className="flex-1 min-w-0">
                  {editingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        className="text-xl font-semibold text-text bg-background border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent"
                        autoFocus
                      />
                      <button type="button" onClick={handleSaveName} className="p-1.5 rounded-md hover:bg-surface-hover text-success"><Check size={18} /></button>
                      <button type="button" onClick={() => setEditingName(false)} className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted"><X size={18} /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold text-text">{orgData?.name || "Loading..."}</h2>
                      <button
                        type="button"
                        onClick={() => { setNameInput(orgData?.name || ""); setEditingName(true); }}
                        className="p-1 rounded-md hover:bg-surface-hover text-text-muted"
                      >
                        <Edit3 size={14} />
                      </button>
                    </div>
                  )}
                  {orgData?.createdAt && (
                    <p className="text-sm text-text-muted mt-1 flex items-center gap-1.5">
                      <Calendar size={13} />
                      Created {new Date(orgData.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </p>
                  )}
                </div>
              </div>

              {/* Overview Stats */}
              {orgLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Skeleton className="h-24 rounded-xl" />
                  <Skeleton className="h-24 rounded-xl" />
                  <Skeleton className="h-24 rounded-xl" />
                </div>
              ) : orgData ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <StatCard icon={Users} label="Members" value={orgData.memberCount} index={0} />
                  <StatCard icon={HardDrive} label="Total Storage" value={formatSize(orgData.totalStorage)} index={1} />
                  <StatCard icon={Building2} label="Organization ID" value={orgData.id.slice(0, 8) + "..."} index={2} />
                </div>
              ) : null}

              {/* Storage gauge */}
              {orgData && (
                <div className="rounded-xl border border-border bg-surface p-6">
                  <SectionHeader title="Storage Usage" />
                  <ProgressBar
                    value={orgData.totalStorage}
                    max={10 * 1024 * 1024 * 1024}
                    label={`${formatSize(orgData.totalStorage)} of 10 GB used`}
                    showPercentage
                    size="lg"
                  />
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "members" && (
            <motion.div
              key="members"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Invite Form */}
              <div className="rounded-xl border border-border bg-surface p-5">
                <SectionHeader title="Invite Member" description="Add a new member to your organization" />
                <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Email address"
                    className="flex-1 px-3 py-2.5 rounded-lg border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
                    required
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="px-3 py-2.5 rounded-lg border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    type="submit"
                    disabled={inviteMutation.isPending}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
                  >
                    <UserPlus size={16} />
                    {inviteMutation.isPending ? "Inviting..." : "Invite"}
                  </button>
                </form>
              </div>

              {/* Members Table */}
              <div className="rounded-xl border border-border bg-surface overflow-hidden">
                <div className="p-5 pb-0">
                  <SectionHeader title="Members" description={`${membersData?.members.length || 0} members`} />
                </div>
                {membersLoading ? (
                  <div className="p-4 space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                  </div>
                ) : membersData?.members && membersData.members.length > 0 ? (
                  <div className="divide-y divide-border">
                    {membersData.members.map((member) => (
                      <div key={member.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-surface-hover/30 transition-colors">
                        <Avatar email={member.email} size="md" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text truncate">{member.email}</p>
                          <p className="text-xs text-text-muted mt-0.5">
                            Joined {new Date(member.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <RoleBadge role={member.role} />
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setRoleMenuId(roleMenuId === member.id ? null : member.id)}
                            className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted"
                          >
                            <MoreVertical size={16} />
                          </button>
                          {roleMenuId === member.id && (
                            <div className="absolute top-full right-0 mt-1 py-1 rounded-lg border border-border bg-surface shadow-dropdown min-w-[160px] z-20">
                              {["admin", "member", "viewer"].map((r) => (
                                <button
                                  key={r}
                                  type="button"
                                  onClick={() => updateRoleMutation.mutate({ id: member.id, role: r })}
                                  className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-surface-hover ${
                                    member.role === r ? "text-accent font-medium" : "text-text"
                                  }`}
                                >
                                  <ShieldCheck size={14} />
                                  <span className="capitalize">{r}</span>
                                  {member.role === r && <Check size={14} className="ml-auto" />}
                                </button>
                              ))}
                              <div className="border-t border-border my-1" />
                              <button
                                type="button"
                                onClick={() => { setRoleMenuId(null); setConfirmRemove({ id: member.id, email: member.email }); }}
                                className="w-full px-3 py-2 text-left text-sm text-error flex items-center gap-2 hover:bg-error/10"
                              >
                                <Trash2 size={14} />
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={Users} title="No members" description="Invite members to start collaborating" />
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "settings" && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="rounded-xl border border-error/30 bg-error/5 p-6">
                <SectionHeader title="Danger Zone" description="Irreversible actions for this organization" />
                <p className="text-sm text-text-muted mb-4">
                  Deleting this organization will permanently remove all files, folders, and member associations.
                  This action cannot be undone.
                </p>
                <button
                  type="button"
                  className="px-4 py-2.5 bg-error text-white rounded-lg text-sm font-medium hover:bg-error/90 transition-colors"
                  onClick={() => showToast("Organization deletion is not yet implemented", "info")}
                >
                  Delete Organization
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <ConfirmModal
        isOpen={!!confirmRemove}
        title="Remove Member"
        message={`Are you sure you want to remove ${confirmRemove?.email} from this organization?`}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={() => confirmRemove && removeMutation.mutate(confirmRemove.id)}
        onClose={() => setConfirmRemove(null)}
      />
    </div>
  );
}
