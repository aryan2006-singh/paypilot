import { NavLink } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import { useHealth } from "../hooks/useHealth";
import { BrandMark, NAV_ITEMS, StatusDot, statusLabel } from "./Sidebar";

/** Compact top bar for phones and small tablets. */
export function MobileTopBar() {
  const { theme, toggle } = useTheme();
  const online = useHealth();
  return (
    <header className="sticky top-0 z-20 hidden items-center gap-2.5 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_85%,transparent)] px-4 py-2.5 backdrop-blur-md max-md:flex">
      <BrandMark size={28} />
      <div className="flex-1 text-[15px] font-semibold tracking-tight">PayPilot</div>
      <span className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-muted)]" role="status" title={statusLabel(online)}>
        <StatusDot online={online} />
        {online === false ? "Offline" : online ? "Online" : ""}
      </span>
      <button
        type="button"
        onClick={toggle}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        className="grid h-9 w-9 place-items-center rounded-lg text-[var(--text-dim)] hover:bg-[var(--surface-3)]"
      >
        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </header>
  );
}

/** Bottom tab bar for phones: thumb-reachable, 44px+ touch targets. */
export function MobileTabBar() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 hidden border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur-md max-md:flex"
    >
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium ${
              isActive ? "text-[var(--accent-text)]" : "text-[var(--text-muted)]"
            }`
          }
        >
          <Icon size={19} aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
