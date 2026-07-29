import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle }: { title: string; subtitle: string; children?: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mb-6"
    >
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-[13.5px] text-[var(--text-dim)]">{subtitle}</p>
    </motion.div>
  );
}
