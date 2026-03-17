import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SearchBar } from "./SearchBar";
import { useAuth } from "@/lib/auth-context";

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
    <header className="h-14 border-b border-border bg-surface flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-4">
        <SearchBar />
        {orgs.length > 0 && (
          <div className="relative" ref={orgRef}>
            <button
              type="button"
              onClick={() => setOrgOpen(!orgOpen)}
              className="px-4 py-2 rounded-lg border border-border bg-surface-hover text-text text-sm font-medium hover:bg-surface-hover/80 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
            >
              {org?.name || "Select org"}
            </button>
            {orgOpen && (
              <div className="absolute top-full left-0 mt-1 py-1 rounded-lg border border-border bg-surface shadow-dropdown min-w-[180px] z-10">
                {orgs.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      switchOrg(o.id);
                      setOrgOpen(false);
                      navigate("/files");
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-surface-hover ${
                      org?.id === o.id ? "bg-accent/10 text-accent font-medium" : "text-text"
                    }`}
                  >
                    {o.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <nav className="flex items-center gap-4">
        <div className="relative" ref={userRef}>
          <button
            type="button"
            onClick={() => setUserOpen(!userOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-full bg-surface-hover hover:bg-surface-hover/80 text-text focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
          >
            <span className="w-8 h-8 rounded-full bg-accent/80 flex items-center justify-center text-white text-sm font-medium">
              {user?.email?.[0]?.toUpperCase() || "?"}
            </span>
          </button>
          {userOpen && (
            <div className="absolute top-full right-0 mt-1 py-1 rounded-lg border border-border bg-surface shadow-dropdown min-w-[180px] z-10">
              <div className="px-4 py-2 text-sm text-text-muted border-b border-border">
                {user?.email}
              </div>
              <button
                type="button"
                onClick={() => {
                  signOut();
                  setUserOpen(false);
                  navigate("/sign-in");
                }}
                className="w-full px-4 py-2 text-left text-sm text-error hover:bg-error/10"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
