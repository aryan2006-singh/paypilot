import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Skeleton } from "./States";

export function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tone = "var(--accent)",
  loading = false,
  delay = 0,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon?: LucideIcon;
  tone?: string;
  loading?: boolean;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="truncate text-[12.5px] font-medium text-[var(--text-muted)]">{label}</div>
        {Icon && (
          <div
            className="grid h-7 w-7 place-items-center rounded-lg"
            style={{ background: `color-mix(in srgb, ${tone} 12%, transparent)`, color: tone }}
          >
            <Icon size={14} aria-hidden />
          </div>
        )}
      </div>
      {loading ? (
        <>
          <Skeleton className="mt-3 h-7 w-16" />
          <Skeleton className="mt-2 h-3 w-24" />
        </>
      ) : (
        <>
          <div className="mt-2 truncate text-[26px] font-semibold max-sm:text-[21px] leading-tight tracking-tight tabular-nums">{value}</div>
          <div className="mt-1 text-[12px] text-[var(--text-muted)]">{sub}</div>
        </>
      )}
    </motion.div>
  );
}
