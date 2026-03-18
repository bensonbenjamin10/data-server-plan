import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { HardDrive, ArrowRight } from "lucide-react";

export function SignInPage() {
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) navigate("/", { replace: true });
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <HardDrive size={24} />
          </div>
          <div className="h-1 w-20 rounded-full bg-border overflow-hidden">
            <motion.div
              className="h-full bg-accent rounded-full"
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
            />
          </div>
        </motion.div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitLoading(true);
    try {
      if (mode === "sign-in") {
        await signIn(email, password);
      } else {
        await signUp(email, password, orgName || undefined);
      }
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-accent/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-accent/3 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <HardDrive size={20} />
          </div>
          <span className="font-display font-semibold text-text text-lg tracking-tight">Org Storage</span>
        </div>

        <div className="p-8 border border-border rounded-xl bg-surface shadow-lg">
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: mode === "sign-up" ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: mode === "sign-up" ? -20 : 20 }}
              transition={{ duration: 0.2 }}
            >
              <h1 className="text-xl font-display font-semibold text-text mb-1">
                {mode === "sign-in" ? "Welcome back" : "Create account"}
              </h1>
              <p className="text-sm text-text-muted mb-6">
                {mode === "sign-in"
                  ? "Sign in to access your files"
                  : "Get started with your organization"}
              </p>
            </motion.div>
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3 rounded-lg bg-error/10 text-error text-sm overflow-hidden"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-muted mb-1.5">
                Email
              </label>
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
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-text-muted mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === "sign-up" ? 8 : 1}
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface placeholder:text-text-muted/50 transition-colors"
                placeholder={mode === "sign-up" ? "Min 8 characters" : "Enter your password"}
              />
            </div>
            <AnimatePresence>
              {mode === "sign-up" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <label htmlFor="orgName" className="block text-sm font-medium text-text-muted mb-1.5">
                    Organization name <span className="text-text-muted/50">(optional)</span>
                  </label>
                  <input
                    id="orgName"
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface placeholder:text-text-muted/50 transition-colors"
                    placeholder="My Organization"
                  />
                </motion.div>
              )}
            </AnimatePresence>
            {mode === "sign-in" && (
              <div className="text-right">
                <Link to="/forgot-password" className="text-xs text-text-muted hover:text-accent transition-colors">
                  Forgot password?
                </Link>
              </div>
            )}
            <button
              type="submit"
              disabled={submitLoading}
              className="w-full py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition-all disabled:opacity-50 flex items-center justify-center gap-2 group shadow-sm"
            >
              {submitLoading ? (
                <motion.div
                  className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.6, ease: "linear" }}
                />
              ) : (
                <>
                  {mode === "sign-in" ? "Sign in" : "Create account"}
                  <ArrowRight size={16} className="opacity-60 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>
          <p className="mt-5 text-sm text-text-muted text-center">
            {mode === "sign-in" ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => { setMode("sign-up"); setError(""); }}
                  className="text-accent hover:text-accent-hover font-medium transition-colors"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => { setMode("sign-in"); setError(""); }}
                  className="text-accent hover:text-accent-hover font-medium transition-colors"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
