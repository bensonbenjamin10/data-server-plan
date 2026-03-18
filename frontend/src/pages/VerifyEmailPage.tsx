import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { HardDrive, CheckCircle, XCircle } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("No verification token provided");
      return;
    }
    fetch(`${API_BASE}/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Verification failed");
        }
        setStatus("success");
      })
      .catch((err) => {
        setStatus("error");
        setError(err.message);
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <HardDrive size={20} />
          </div>
          <span className="font-display font-semibold text-text text-lg tracking-tight">Org Storage</span>
        </div>

        <div className="p-8 border border-border rounded-xl bg-surface shadow-lg text-center">
          {status === "verifying" && (
            <p className="text-text-muted">Verifying your email...</p>
          )}
          {status === "success" && (
            <>
              <CheckCircle size={40} className="text-green-500 mx-auto mb-4" />
              <h1 className="text-xl font-display font-semibold text-text mb-2">Email verified!</h1>
              <p className="text-sm text-text-muted mb-6">Your email has been confirmed. You now have full access.</p>
              <Link to="/" className="text-sm text-accent hover:text-accent-hover font-medium">Go to dashboard</Link>
            </>
          )}
          {status === "error" && (
            <>
              <XCircle size={40} className="text-error mx-auto mb-4" />
              <h1 className="text-xl font-display font-semibold text-text mb-2">Verification failed</h1>
              <p className="text-sm text-text-muted mb-6">{error}</p>
              <Link to="/" className="text-sm text-accent hover:text-accent-hover font-medium">Go to dashboard</Link>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
