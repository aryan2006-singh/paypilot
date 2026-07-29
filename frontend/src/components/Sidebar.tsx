import { NavLink } from "react-router-dom";
import { LayoutDashboard, MessageSquare, Layers, Settings, Moon, Sun } from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import { useHealth } from "../hooks/useHealth";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/chat", label: "Chat", icon: MessageSquare, end: false },
  { to: "/agents", label: "Agents", icon: Layers, end: false },
  { to: "/settings", label: "Settings", icon: Settings, end: false },
];

export function Sidebar() {
  const { theme, toggle } = useTheme();
  const online = useHealth();

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] p-3 max-md:w-[76px]">
      <div className="flex items-center gap-2.5 px-2 pb-5 pt-1">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-gradient-to-br from-[#6d5efc] to-[#9b8cff] text-sm font-bold text-white">
          P
        </div>
        <div className="max-md:hidden">
          <div className="text-[14.5px] font-semibold tracking-tight">PayPilot</div>
          <div className="text-[10.5px] text-[var(--text-muted)]">Payments Ops Console</div>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-[9px] px-3 py-2 text-[13.5px] font-medium transition-colors max-md:justify-center ${
                isActive
                  ? "bg-[color-mix(in_srgb,#6d5efc_14%,transparent)] text-[#9b8cff]"
                  : "text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
              }`
            }
          >
            <Icon size={16} strokeWidth={2} />
            <span className="max-md:hidden">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto px-2 pb-1">
        <div className="mb-2 flex items-center gap-1.5 text-[11.5px] text-[var(--text-muted)]">
          <span
            className={`h-[7px] w-[7px] shrink-0 rounded-full ${
              online === null
                ? "bg-[var(--text-muted)]"
                : online
                  ? "bg-[var(--ok)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--ok)_20%,transparent)]"
                  : "bg-[var(--critical)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--critical)_20%,transparent)]"
            }`}
          />
          <span className="max-md:hidden">
            {online === null ? "Checking…" : online ? "Online" : "Offline"}
          </span>
        </div>
        <button
          onClick={toggle}
          className="flex w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-2 text-[12px] text-[var(--text-dim)] transition-colors hover:border-[#6d5efc] hover:text-[var(--text)] max-md:justify-center"
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          <span className="max-md:hidden">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
        </button>
      </div>
    </aside>
  );
}
