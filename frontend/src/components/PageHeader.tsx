import { useEffect, type ReactNode } from "react";

export function PageHeader({ title, subtitle, children, compact = false }: { title: string; subtitle: string; children?: ReactNode; compact?: boolean }) {
  useEffect(() => {
    document.title = `${title} · PayPilot`;
  }, [title]);

  return (
    <div className={`mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 ${compact ? "max-md:mb-3 max-md:flex-nowrap max-md:items-center" : ""}`}>
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-tight max-md:text-[19px]">{title}</h1>
        <p className={`mt-1 text-[13.5px] text-[var(--text-dim)] ${compact ? "max-md:hidden" : ""}`}>{subtitle}</p>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
