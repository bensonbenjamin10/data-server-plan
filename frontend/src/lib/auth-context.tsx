import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const TOKEN_KEY = "auth_token";

export interface OrgInfo {
  id: string;
  name: string;
  role?: string;
}

export interface AuthState {
  user: { id: string; email: string } | null;
  org: OrgInfo | null;
  orgs: OrgInfo[];
  token: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  getToken: () => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, orgName?: string) => Promise<void>;
  signOut: () => void;
  switchOrg: (orgId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [orgs, setOrgs] = useState<OrgInfo[]>([]);
  const [token, setTokenState] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY)
  );
  const [loading, setLoading] = useState(true);

  const setToken = useCallback((t: string | null) => {
    if (t) {
      localStorage.setItem(TOKEN_KEY, t);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    setTokenState(t);
  }, []);

  const getToken = useCallback(async () => token, [token]);

  const fetchMe = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setToken(null);
        setUser(null);
        setOrg(null);
        setOrgs([]);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setUser(data.user || { id: data.userId, email: "" });
      setOrg(data.org ? { id: data.org.id, name: data.org.name } : null);
      setOrgs(
        (data.orgs || []).map((o: OrgInfo) => ({
          id: o.id,
          name: o.name,
          role: o.role,
        }))
      );
    } catch {
      setToken(null);
      setUser(null);
      setOrg(null);
      setOrgs([]);
    } finally {
      setLoading(false);
    }
  }, [token, setToken]);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await fetch(`${API_BASE}/auth/sign-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Sign in failed");
      }
      const data = await res.json();
      setToken(data.token);
      setUser(data.user);
      setOrg(data.org ? { id: data.org.id, name: data.org.name } : null);
      setOrgs(
        (data.orgs || []).map((o: OrgInfo) => ({
          id: o.id,
          name: o.name,
          role: o.role,
        }))
      );
    },
    [setToken]
  );

  const signUp = useCallback(
    async (email: string, password: string, orgName?: string) => {
      const res = await fetch(`${API_BASE}/auth/sign-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, orgName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Sign up failed");
      }
      const data = await res.json();
      setToken(data.token);
      setUser(data.user);
      setOrg(data.org ? { id: data.org.id, name: data.org.name } : null);
      setOrgs([{ id: data.org.id, name: data.org.name }]);
    },
    [setToken]
  );

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
    setOrg(null);
    setOrgs([]);
  }, [setToken]);

  const switchOrg = useCallback(
    async (orgId: string) => {
      if (!token) return;
      const res = await fetch(`${API_BASE}/auth/switch-org`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orgId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Switch org failed");
      }
      const data = await res.json();
      setToken(data.token);
      const orgInfo = orgs.find((o) => o.id === orgId);
      if (orgInfo) setOrg({ id: orgInfo.id, name: orgInfo.name });
    },
    [token, orgs, setToken]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      org,
      orgs,
      token,
      loading,
      getToken,
      signIn,
      signUp,
      signOut,
      switchOrg,
    }),
    [user, org, orgs, token, loading, getToken, signIn, signUp, signOut, switchOrg]
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
