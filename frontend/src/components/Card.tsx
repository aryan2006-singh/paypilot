import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function Card({ title, children, delay = 0 }: { title?: string; children: ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="mb-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
    >
      {title && (
        <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">{title}</h2>
      )}
      {children}
    </motion.div>
  );
}
