import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { SearchBar } from "./SearchBar";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/ui/Avatar";
import {
  ChevronDown,
  User,
  Building2,
  Settings,
  LogOut,
  Bell,
} from "lucide-react";

export function Header() {
  const { user, org, orgs, signOut, switchOrg } = useAuth();
  const [orgOpen, setOrgOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const orgRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        orgRef.current && !orgRef.current.contains(e.target as Node) &&
        userRef.current && !userRef.current.contains(e.target as Node)
      ) {
        setOrgOpen(false);
        setUserOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="h-14 border-b border-border bg-surface flex items-center justify-between px-5 shrink-0">
      <div className="flex items-center gap-3">
        <SearchBar />
        {orgs.length > 0 && (
          <div className="relative" ref={orgRef}>
            <button
              type="button"
              onClick={() => setOrgOpen(!orgOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-surface-hover text-text text-sm font-medium hover:bg-border/30 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background transition-colors"
            >
              <div className="flex h-5 w-5 items-center justify-center rounded bg-accent/15 text-accent">
                <Building2 size={12} />
              </div>
              <span className="max-w-[120px] truncate">{org?.name || "Select org"}</span>
              <ChevronDown size={14} className={`text-text-muted transition-transform ${orgOpen ? "rotate-180" : ""}`} />
            </button>
            {orgOpen && (
              <div className="absolute top-full left-0 mt-1 py-1 rounded-lg border border-border bg-surface shadow-dropdown min-w-[200px] z-10">
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted/60">Organizations</p>
                {orgs.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      switchOrg(o.id);
                      setOrgOpen(false);
                      navigate("/files");
                    }}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2.5 hover:bg-surface-hover transition-colors ${
                      org?.id === o.id ? "bg-accent/10 text-accent font-medium" : "text-text"
                    }`}
                  >
                    <div className={`flex h-6 w-6 items-center justify-center rounded text-xs font-semibold ${
                      org?.id === o.id ? "bg-accent/20 text-accent" : "bg-surface-hover text-text-muted"
                    }`}>
                      {o.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate">{o.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <nav className="flex items-center gap-2">
        {/* Notification bell placeholder */}
        <button
          type="button"
          className="relative p-2 rounded-lg hover:bg-surface-hover text-text-muted transition-colors"
          title="Notifications"
        >
          <Bell size={18} />
        </button>

        {/* User menu */}
        <div className="relative" ref={userRef}>
          <button
            type="button"
            onClick={() => setUserOpen(!userOpen)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-hover transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
          >
            <Avatar email={user?.email} size="sm" />
          </button>
          {userOpen && (
            <div className="absolute top-full right-0 mt-1 rounded-lg border border-border bg-surface shadow-dropdown min-w-[200px] z-10 overflow-hidden">
              <div className="px-3 py-3 border-b border-border">
                <p className="text-sm font-medium text-text truncate">{user?.email}</p>
                <p className="text-xs text-text-muted mt-0.5">{org?.name}</p>
              </div>
              <div className="py-1">
                <Link
                  to="/profile"
                  onClick={() => setUserOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-text hover:bg-surface-hover transition-colors"
                >
                  <User size={15} className="text-text-muted" />
                  Profile
                </Link>
                <Link
                  to="/organization"
                  onClick={() => setUserOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-text hover:bg-surface-hover transition-colors"
                >
                  <Building2 size={15} className="text-text-muted" />
                  Organization
                </Link>
                <Link
                  to="/settings"
                  onClick={() => setUserOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-text hover:bg-surface-hover transition-colors"
                >
                  <Settings size={15} className="text-text-muted" />
                  Settings
                </Link>
              </div>
              <div className="border-t border-border py-1">
                <button
                  type="button"
                  onClick={() => {
                    signOut();
                    setUserOpen(false);
                    navigate("/sign-in");
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-error hover:bg-error/10 transition-colors"
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
