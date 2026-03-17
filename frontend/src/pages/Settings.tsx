import { motion } from "framer-motion";

export function Settings() {
  return (
    <div className="p-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-display font-semibold text-text mb-4">
          Settings
        </h1>
        <p className="text-text-muted">
          Organization and account settings can be managed here.
        </p>
      </motion.div>
    </div>
  );
}
