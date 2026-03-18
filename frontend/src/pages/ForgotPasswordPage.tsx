import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { HardDrive, ArrowLeft, Mail } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Request failed");
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-accent/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-accent/3 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-sm"
      >
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <HardDrive size={20} />
          </div>
          <span className="font-display font-semibold text-text text-lg tracking-tight">Org Storage</span>
        </div>

        <div className="p-8 border border-border rounded-xl bg-surface shadow-lg">
          {sent ? (
            <div className="text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent mx-auto mb-4">
                <Mail size={24} />
              </div>
              <h1 className="text-xl font-display font-semibold text-text mb-2">Check your email</h1>
              <p className="text-sm text-text-muted mb-6">
                If an account exists with <strong>{email}</strong>, we've sent a password reset link.
              </p>
              <Link to="/sign-in" className="text-sm text-accent hover:text-accent-hover font-medium transition-colors">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-display font-semibold text-text mb-1">Reset password</h1>
              <p className="text-sm text-text-muted mb-6">
                Enter your email and we'll send you a reset link.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 rounded-lg bg-error/10 text-error text-sm">{error}</div>
                )}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-text-muted mb-1.5">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface placeholder:text-text-muted/50 transition-colors"
                    placeholder="you@example.com"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition-all disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Send reset link"}
                </button>
              </form>
              <div className="mt-5 text-center">
                <Link to="/sign-in" className="text-sm text-text-muted hover:text-text inline-flex items-center gap-1.5 transition-colors">
                  <ArrowLeft size={14} /> Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
