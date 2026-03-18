import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { HardDrive, Users, CheckCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, setTokenDirect } = useAuth();
  const token = searchParams.get("token") || "";

  const [invite, setInvite] = useState<{ orgName: string; role: string; email: string; existingUser: boolean } | null>(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) {
      setInvalid(true);
      setValidating(false);
      return;
    }
    fetch(`${API_BASE}/auth/invite/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          setInvalid(true);
        } else {
          setInvite(await res.json());
        }
      })
      .catch(() => setInvalid(true))
      .finally(() => setValidating(false));
  }, [token]);

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body: { token: string; password?: string } = { token };
      if (!invite?.existingUser && !user) {
        body.password = password;
      }
      const res = await fetch(`${API_BASE}/auth/accept-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to accept invitation");
      }
      const data = await res.json();
      setTokenDirect(data.token, data.user, { id: data.org.id, name: data.org.name, role: invite?.role });
      setAccepted(true);
      setTimeout(() => navigate("/", { replace: true }), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-text-muted">Validating invitation...</div>
      </div>
    );
  }

  const needsPassword = !invite?.existingUser && !user;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-sm"
      >
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <HardDrive size={20} />
          </div>
          <span className="font-display font-semibold text-text text-lg tracking-tight">Org Storage</span>
        </div>

        <div className="p-8 border border-border rounded-xl bg-surface shadow-lg">
          {invalid ? (
            <div className="text-center">
              <h1 className="text-xl font-display font-semibold text-text mb-2">Invalid invitation</h1>
              <p className="text-sm text-text-muted">This invitation link is invalid or has expired.</p>
            </div>
          ) : accepted ? (
            <div className="text-center">
              <CheckCircle size={32} className="text-green-500 mx-auto mb-3" />
              <h1 className="text-xl font-display font-semibold text-text mb-2">Welcome!</h1>
              <p className="text-sm text-text-muted">You've joined <strong>{invite?.orgName}</strong>. Redirecting...</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <Users size={20} />
                </div>
                <div>
                  <h1 className="text-lg font-display font-semibold text-text">Join {invite?.orgName}</h1>
                  <p className="text-sm text-text-muted">You'll be added as <strong>{invite?.role}</strong></p>
                </div>
              </div>

              <form onSubmit={handleAccept} className="space-y-4">
                {error && <div className="p-3 rounded-lg bg-error/10 text-error text-sm">{error}</div>}

                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1.5">Email</label>
                  <input type="email" value={invite?.email || ""} disabled
                    className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background/50 text-text-muted text-sm" />
                </div>

                {needsPassword && (
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-text-muted mb-1.5">Create password</label>
                    <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                      required minLength={8}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface transition-colors"
                      placeholder="Min 8 characters" />
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition-all disabled:opacity-50">
                  {loading ? "Joining..." : "Accept & Join"}
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
