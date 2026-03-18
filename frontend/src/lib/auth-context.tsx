import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export interface OrgInfo {
  id: string;
  name: string;
  role?: string;
}

export interface AuthState {
  user: { id: string; email: string; emailVerified?: boolean } | null;
  org: OrgInfo | null;
  orgs: OrgInfo[];
  orgRole: string | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  getToken: () => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, orgName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  switchOrg: (orgId: string) => Promise<void>;
  setTokenDirect: (token: string, user: { id: string; email: string }, org: OrgInfo) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const REFRESH_INTERVAL_MS = 13 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthState["user"]>(null);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [orgs, setOrgs] = useState<OrgInfo[]>([]);
  const [orgRole, setOrgRole] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleRefresh() {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      silentRefresh();
    }, REFRESH_INTERVAL_MS);
  }

  const silentRefresh = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        setToken(null);
        setUser(null);
        setOrg(null);
        setOrgs([]);
        setOrgRole(null);
        return null;
      }
      const data = await res.json();
      setToken(data.token);
      setUser(data.user || null);
      if (data.org) setOrg({ id: data.org.id, name: data.org.name });
      if (data.orgs) {
        const orgList = data.orgs.map((o: OrgInfo) => ({ id: o.id, name: o.name, role: o.role }));
        setOrgs(orgList);
        const current = orgList.find((o: OrgInfo) => o.id === data.org?.id);
        setOrgRole(current?.role || null);
      }
      scheduleRefresh();
      return data.token;
    } catch {
      setToken(null);
      setUser(null);
      setOrg(null);
      setOrgs([]);
      setOrgRole(null);
      return null;
    }
  }, []);

  useEffect(() => {
    silentRefresh().finally(() => setLoading(false));
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  const getToken = useCallback(async (): Promise<string | null> => {
    if (token) return token;
    return silentRefresh();
  }, [token, silentRefresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/sign-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Sign in failed");
    }
    const data = await res.json();
    setToken(data.token);
    setUser(data.user);
    if (data.org) setOrg({ id: data.org.id, name: data.org.name });
    const orgList = (data.orgs || []).map((o: OrgInfo) => ({ id: o.id, name: o.name, role: o.role }));
    setOrgs(orgList);
    const current = orgList.find((o: OrgInfo) => o.id === data.org?.id);
    setOrgRole(current?.role || null);
    scheduleRefresh();
  }, []);

  const signUp = useCallback(async (email: string, password: string, orgName?: string) => {
    const res = await fetch(`${API_BASE}/auth/sign-up`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password, orgName }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Sign up failed");
    }
    const data = await res.json();
    setToken(data.token);
    setUser(data.user);
    if (data.org) {
      setOrg({ id: data.org.id, name: data.org.name });
      setOrgs([{ id: data.org.id, name: data.org.name, role: "admin" }]);
      setOrgRole("admin");
    }
    scheduleRefresh();
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/auth/sign-out`, {
        method: "POST",
        credentials: "include",
      });
    } catch {}
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    setToken(null);
    setUser(null);
    setOrg(null);
    setOrgs([]);
    setOrgRole(null);
  }, []);

  const switchOrg = useCallback(async (orgId: string) => {
    if (!token) return;
    const res = await fetch(`${API_BASE}/auth/switch-org`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      credentials: "include",
      body: JSON.stringify({ orgId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Switch org failed");
    }
    const data = await res.json();
    setToken(data.token);
    const orgInfo = orgs.find((o) => o.id === orgId);
    if (orgInfo) {
      setOrg({ id: orgInfo.id, name: orgInfo.name });
      setOrgRole(orgInfo.role || null);
    }
  }, [token, orgs]);

  const setTokenDirect = useCallback((newToken: string, newUser: { id: string; email: string }, newOrg: OrgInfo) => {
    setToken(newToken);
    setUser(newUser);
    setOrg(newOrg);
    setOrgs((prev) => {
      const exists = prev.find((o) => o.id === newOrg.id);
      if (exists) return prev;
      return [...prev, newOrg];
    });
    setOrgRole(newOrg.role || null);
    scheduleRefresh();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      org,
      orgs,
      orgRole,
      token,
      loading,
      getToken,
      signIn,
      signUp,
      signOut,
      switchOrg,
      setTokenDirect,
    }),
    [user, org, orgs, orgRole, token, loading, getToken, signIn, signUp, signOut, switchOrg, setTokenDirect]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
