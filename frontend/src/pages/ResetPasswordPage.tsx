import { useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { HardDrive, CheckCircle } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!token) {
      setInvalid(true);
      setValidating(false);
      return;
    }
    fetch(`${API_BASE}/auth/reset-password/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          setInvalid(true);
        } else {
          const data = await res.json();
          setEmail(data.email || "");
        }
      })
      .catch(() => setInvalid(true))
      .finally(() => setValidating(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Reset failed");
      }
      setSuccess(true);
      setTimeout(() => navigate("/sign-in", { replace: true }), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-text-muted">Validating reset link...</div>
      </div>
    );
  }

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
              <h1 className="text-xl font-display font-semibold text-text mb-2">Invalid reset link</h1>
              <p className="text-sm text-text-muted mb-4">This link is invalid or has expired.</p>
              <Link to="/forgot-password" className="text-sm text-accent hover:text-accent-hover font-medium">Request a new one</Link>
            </div>
          ) : success ? (
            <div className="text-center">
              <CheckCircle size={32} className="text-green-500 mx-auto mb-3" />
              <h1 className="text-xl font-display font-semibold text-text mb-2">Password reset!</h1>
              <p className="text-sm text-text-muted">Redirecting to sign in...</p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-display font-semibold text-text mb-1">Choose new password</h1>
              {email && <p className="text-sm text-text-muted mb-6">For <strong>{email}</strong></p>}

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && <div className="p-3 rounded-lg bg-error/10 text-error text-sm">{error}</div>}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-text-muted mb-1.5">New password</label>
                  <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface transition-colors"
                    placeholder="Min 8 characters" />
                </div>
                <div>
                  <label htmlFor="confirm" className="block text-sm font-medium text-text-muted mb-1.5">Confirm password</label>
                  <input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface transition-colors"
                    placeholder="Repeat password" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition-all disabled:opacity-50">
                  {loading ? "Resetting..." : "Reset password"}
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
