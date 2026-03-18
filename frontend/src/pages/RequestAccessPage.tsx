import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Send, Clock, CheckCircle, XCircle } from "lucide-react";
import { useApi } from "@/lib/api-context";

export function RequestAccessPage() {
  const api = useApi();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedOrg, setSelectedOrg] = useState<{ id: string; name: string } | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [myRequests, setMyRequests] = useState<Array<{ id: string; orgName: string; status: string; createdAt: string }>>([]);

  useEffect(() => {
    api.getMyAccessRequests().then((data) => setMyRequests(data.requests)).catch(() => {});
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      api.searchOrgs(query).then((data) => setResults(data.organizations)).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrg) return;
    setError("");
    setLoading(true);
    try {
      await api.requestOrgAccess(selectedOrg.id, message || undefined);
      setSuccess(true);
      const data = await api.getMyAccessRequests();
      setMyRequests(data.requests);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request");
    } finally {
      setLoading(false);
    }
  }

  const statusIcon = (status: string) => {
    if (status === "pending") return <Clock size={14} className="text-yellow-500" />;
    if (status === "approved") return <CheckCircle size={14} className="text-green-500" />;
    return <XCircle size={14} className="text-error" />;
  };

  return (
    <div className="max-w-lg mx-auto py-12 px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-display font-semibold text-text mb-1">Join an Organization</h1>
        <p className="text-text-muted mb-8">Search for an organization and request access.</p>

        {success ? (
          <div className="p-6 border border-border rounded-xl bg-surface text-center">
            <CheckCircle size={32} className="text-green-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-text mb-2">Request submitted!</h2>
            <p className="text-sm text-text-muted mb-4">
              The admins of <strong>{selectedOrg?.name}</strong> have been notified. You'll receive an email when they respond.
            </p>
            <button onClick={() => { setSuccess(false); setSelectedOrg(null); setMessage(""); setQuery(""); }}
              className="text-sm text-accent hover:text-accent-hover font-medium">
              Submit another request
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="p-3 rounded-lg bg-error/10 text-error text-sm">{error}</div>}

            <div className="relative">
              <label className="block text-sm font-medium text-text-muted mb-1.5">Search organizations</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={selectedOrg ? selectedOrg.name : query}
                  onChange={(e) => { setQuery(e.target.value); setSelectedOrg(null); }}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface transition-colors"
                  placeholder="Type at least 2 characters..."
                />
              </div>
              {results.length > 0 && !selectedOrg && (
                <div className="absolute z-10 mt-1 w-full border border-border rounded-lg bg-surface shadow-lg max-h-48 overflow-y-auto">
                  {results.map((org) => (
                    <button key={org.id} type="button" onClick={() => { setSelectedOrg(org); setResults([]); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-text hover:bg-background transition-colors">
                      {org.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-muted mb-1.5">
                Message <span className="text-text-muted/50">(optional)</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                maxLength={500}
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface transition-colors resize-none"
                placeholder="Why would you like to join?"
              />
            </div>

            <button type="submit" disabled={loading || !selectedOrg}
              className="w-full py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              <Send size={16} />
              {loading ? "Submitting..." : "Request Access"}
            </button>
          </form>
        )}

        {myRequests.length > 0 && (
          <div className="mt-10">
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Your requests</h2>
            <div className="space-y-2">
              {myRequests.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 border border-border rounded-lg bg-surface">
                  <div>
                    <span className="text-sm font-medium text-text">{r.orgName}</span>
                    <span className="text-xs text-text-muted ml-2">{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium capitalize">
                    {statusIcon(r.status)}
                    <span className="text-text-muted">{r.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
