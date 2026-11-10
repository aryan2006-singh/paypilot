import { motion } from "framer-motion";
import type { AgentMeta } from "../types";
import { pct } from "../lib/format";

export function AgentBarChart({ agents, counts }: { agents: AgentMeta[]; counts: Record<string, number> }) {
  const max = Math.max(1, ...Object.values(counts));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <ul className="flex flex-col gap-3.5" aria-label="Queries per agent">
      {agents.map((agent) => {
        const count = counts[agent.id] ?? 0;
        return (
          <li key={agent.id} className="grid grid-cols-[110px_1fr_64px] items-center gap-3 max-sm:grid-cols-[104px_1fr_58px] max-sm:gap-2.5">
            <div className="flex items-center gap-2 truncate text-[13px] text-[var(--text-dim)]">
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: agent.color }} />
              {agent.label}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-3)]">
              <motion.div
                className="h-full rounded-full"
                style={{ background: agent.color }}
                initial={{ width: 0 }}
                animate={{ width: `${(count / max) * 100}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
            <div className="text-right text-[13px] tabular-nums">
              <span className="font-semibold">{count}</span>
              <span className="ml-1.5 text-[11.5px] text-[var(--text-muted)]">{pct(count, total)}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
