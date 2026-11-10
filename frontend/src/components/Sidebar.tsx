import { NavLink } from "react-router-dom";
import { LayoutDashboard, MessageSquare, Layers, Settings, Moon, Sun, Sparkles } from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import { useHealth } from "../hooks/useHealth";

export const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/chat", label: "Chat", icon: MessageSquare, end: false },
  { to: "/agents", label: "Agents", icon: Layers, end: false },
  { to: "/settings", label: "Settings", icon: Settings, end: false },
];

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <div
      aria-hidden
      className="brand-gradient grid shrink-0 place-items-center rounded-[9px] font-bold text-white shadow-[var(--shadow-sm)]"
      style={{ width: size, height: size, fontSize: size * 0.44 }}
    >
      P
    </div>
  );
}

export function StatusDot({ online }: { online: boolean | null }) {
  const color = online === null ? "var(--text-muted)" : online ? "var(--ok)" : "var(--critical)";
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      {online && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-40" style={{ background: color }} />}
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
    </span>
  );
}

export function statusLabel(online: boolean | null) {
  return online === null ? "Checking API…" : online ? "All systems normal" : "API unreachable";
}

/** Desktop sidebar. On small screens the app uses MobileNav instead. */
export function Sidebar() {
  const { theme, toggle } = useTheme();
  const online = useHealth();

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] p-3 max-md:hidden">
      <div className="flex items-center gap-2.5 px-2 pb-5 pt-1.5">
        <BrandMark />
        <div>
          <div className="text-[15px] font-semibold tracking-tight">PayPilot</div>
          <div className="text-[11px] text-[var(--text-muted)]">Payments Ops Console</div>
        </div>
      </div>

      <NavLink
        to="/chat"
        className="brand-gradient mb-4 flex h-9 items-center justify-center gap-2 rounded-[10px] text-[13px] font-semibold text-white shadow-[var(--shadow-sm)] transition-opacity hover:opacity-90"
      >
        <Sparkles size={14} aria-hidden /> Ask PayPilot
      </NavLink>

      <div className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Workspace</div>
      <nav aria-label="Main" className="flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `group relative flex items-center gap-2.5 rounded-[9px] px-3 py-2 text-[13.5px] font-medium transition-colors ${
                isActive
                  ? "bg-[var(--accent-soft)] text-[var(--accent-text)]"
                  : "text-[var(--text-dim)] hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span aria-hidden className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r bg-[var(--accent)]" />}
                <Icon size={16} strokeWidth={2} aria-hidden />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-2 px-1 pb-1">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5" role="status" aria-live="polite">
          <div className="flex items-center gap-2 text-[12px] font-medium">
            <StatusDot online={online} />
            {statusLabel(online)}
          </div>
          {online === false && (
            <div className="mt-1 text-[11px] leading-snug text-[var(--text-muted)]">Free-tier servers sleep when idle. Retrying automatically.</div>
          )}
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] text-[var(--text-dim)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
        >
          {theme === "dark" ? <Sun size={14} aria-hidden /> : <Moon size={14} aria-hidden />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </div>
    </aside>
  );
}
