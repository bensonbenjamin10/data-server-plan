import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export function Dashboard() {
  return (
    <div className="p-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-3xl font-display font-semibold text-text mb-2">
          Welcome to Org Data Storage
        </h1>
        <p className="text-text-muted mb-8">
          Upload, organize, and retrieve your organization&apos;s files securely.
        </p>
        <Link
          to="/files"
          className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover transition-colors shadow-sm"
        >
          Go to Files
        </Link>
      </motion.div>
    </div>
  );
}
