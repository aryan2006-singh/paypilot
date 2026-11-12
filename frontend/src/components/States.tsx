import type { ReactNode } from "react";
import { AlertTriangle, RotateCw, type LucideIcon } from "lucide-react";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}

/** Maps low-level fetch errors to something a person can act on. */
export function describeError(error: Error): string {
  const msg = error.message || "";
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return "Can't reach the PayPilot API. If the server was asleep it can take up to a minute to wake up.";
  }
  return msg;
}

export function ErrorState({ error, onRetry, compact = false }: { error: Error; onRetry?: () => void; compact?: boolean }) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl border px-4 ${compact ? "py-3" : "py-4"}`}
      style={{
        borderColor: "color-mix(in srgb, var(--critical) 30%, var(--border))",
        background: "color-mix(in srgb, var(--critical) 6%, var(--surface))",
      }}
    >
      <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: "var(--critical)" }} />
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-medium">Something went wrong</div>
        <div className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--text-dim)]">{describeError(error)}</div>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} icon={RotateCw}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]">
        <Icon size={20} />
      </div>
      <div className="text-[14px] font-semibold">{title}</div>
      {body && <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-[var(--text-muted)]">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  icon?: LucideIcon;
  spin?: boolean;
};

export function Button({ variant = "secondary", size = "md", icon: Icon, spin, className = "", children, ...rest }: ButtonProps) {
  const base =
    "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-medium transition-[background,border-color,color,opacity] disabled:cursor-not-allowed disabled:opacity-50";
  const sizes = size === "sm" ? "h-8 px-2.5 text-[12.5px]" : "h-10 px-4 text-[13.5px]";
  const variants = {
    primary: "brand-gradient text-white shadow-[var(--shadow-sm)] hover:opacity-90",
    secondary:
      "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-dim)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
    ghost: "text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--text)]",
  }[variant];
  return (
    <button type="button" className={`${base} ${sizes} ${variants} ${className}`} {...rest}>
      {Icon && <Icon size={size === "sm" ? 13 : 15} className={spin ? "animate-spin" : ""} aria-hidden />}
      {children}
    </button>
  );
}
