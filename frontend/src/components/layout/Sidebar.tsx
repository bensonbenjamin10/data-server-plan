import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api-context";
import { FolderTree } from "./FolderTree";
import { ProgressBar } from "@/components/ui/ProgressBar";
import {
  LayoutDashboard,
  FolderOpen,
  Trash2,
  Settings,
  Building2,
  User,
  PanelLeftClose,
  PanelLeft,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const mainNav: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/files", label: "Files", icon: FolderOpen },
  { to: "/trash", label: "Trash", icon: Trash2, end: true },
];

const accountNav: NavItem[] = [
  { to: "/organization", label: "Organization", icon: Building2 },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/settings", label: "Settings", icon: Settings },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function Sidebar() {
  const location = useLocation();
  const api = useApi();
  const isFilesSection = location.pathname.startsWith("/files");
  const [collapsed, setCollapsed] = useState(false);

  const { data: storageInfo } = useQuery({
    queryKey: ["storage"],
    queryFn: () => api.getStorageInfo(),
    staleTime: 60000,
  });

  const renderNavItem = (item: NavItem) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `relative flex items-center gap-3 rounded-lg font-medium transition-colors ${
          collapsed ? "px-3 py-3 justify-center" : "px-3 py-2.5"
        } ${
          isActive ? "text-accent" : "text-text-muted hover:text-text hover:bg-surface-hover"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.div
              layoutId="sidebar-active"
              className="absolute inset-0 bg-accent/10 rounded-lg"
              initial={false}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
          <item.icon size={18} className="relative shrink-0" />
          {!collapsed && <span className="relative text-sm">{item.label}</span>}
        </>
      )}
    </NavLink>
  );

  return (
    <aside
      className={`${
        collapsed ? "w-16" : "w-60"
      } bg-surface border-r border-border flex flex-col shrink-0 transition-all duration-200`}
    >
      {/* Header */}
      <div className={`flex items-center border-b border-border ${collapsed ? "px-3 py-4 justify-center" : "px-4 py-4 justify-between"}`}>
        {!collapsed && (
          <h2 className="font-display font-semibold text-text text-base tracking-tight">
            Org Storage
          </h2>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-hidden min-h-0 flex flex-col">
        <div className={`${collapsed ? "p-2" : "p-3"} space-y-1`}>
          {!collapsed && (
            <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted/60">Main</p>
          )}
          {mainNav.map(renderNavItem)}
        </div>

        {/* Folder Tree */}
        {isFilesSection && !collapsed && (
          <div className="px-3 overflow-auto flex-1 min-h-0">
            <FolderTree />
          </div>
        )}

        <div className={`${collapsed ? "p-2" : "p-3"} space-y-1 mt-auto`}>
          {!collapsed && (
            <>
              <div className="border-t border-border mb-2" />
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted/60">Account</p>
            </>
          )}
          {collapsed && <div className="border-t border-border mb-2" />}
          {accountNav.map(renderNavItem)}
        </div>
      </nav>

      {/* Storage Mini-bar */}
      {!collapsed && storageInfo && (
        <div className="px-4 py-3 border-t border-border">
          <ProgressBar
            value={storageInfo.used}
            max={Math.max(storageInfo.quota, 1)}
            size="sm"
            colorMode="accent"
          />
          <p className="text-[11px] text-text-muted mt-1.5">
            {formatSize(storageInfo.used)} of {formatSize(storageInfo.quota)}
          </p>
        </div>
      )}
    </aside>
  );
}
