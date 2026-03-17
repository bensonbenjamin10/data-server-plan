import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { FolderTree } from "./FolderTree";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/files", label: "Files" },
  { to: "/settings", label: "Settings" },
];

export function Sidebar() {
  const location = useLocation();
  const isFilesSection = location.pathname.startsWith("/files");

  return (
    <aside className="w-64 bg-surface border-r border-neutral/60 flex flex-col shrink-0">
      <div className="p-6 border-b border-neutral/60">
        <h2 className="font-display font-semibold text-primary text-lg">
          Org Storage
        </h2>
      </div>
      <nav className="p-4 flex flex-col gap-1 flex-1 overflow-hidden min-h-0">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `relative px-4 py-3 rounded-lg font-medium transition-colors ${
                isActive ? "text-accent bg-accent/10" : "text-text-muted hover:text-text hover:bg-neutral/30"
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
                <span className="relative">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
        {isFilesSection && (
          <div className="mt-2 overflow-auto flex-1 min-h-0">
            <FolderTree />
          </div>
        )}
      </nav>
    </aside>
  );
}
