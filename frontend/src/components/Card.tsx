import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function Card({
  title,
  description,
  actions,
  children,
  delay = 0,
  className = "",
  bodyClassName = "p-5",
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  delay?: number;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)] ${className}`}
    >
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-3.5">
          <div className="min-w-0">
            {title && <h2 className="text-[14px] font-semibold tracking-tight">{title}</h2>}
            {description && <p className="mt-0.5 text-[12.5px] text-[var(--text-muted)]">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </motion.section>
  );
}
