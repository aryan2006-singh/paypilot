import { motion } from "framer-motion";

export function StatTile({ label, value, sub, delay = 0 }: { label: string; value: string | number; sub: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
    >
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      <div className="mt-1 text-[11.5px] text-[var(--text-muted)]">{sub}</div>
    </motion.div>
  );
}
