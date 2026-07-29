import { motion } from "framer-motion";
import type { AgentMeta } from "../types";

export function AgentBarChart({ agents, counts }: { agents: AgentMeta[]; counts: Record<string, number> }) {
  const max = Math.max(1, ...Object.values(counts));
  return (
    <div className="flex flex-col gap-3">
      {agents.map((agent) => {
        const count = counts[agent.id] ?? 0;
        return (
          <div key={agent.id} className="flex items-center gap-3">
            <div className="w-[120px] shrink-0 text-[12.5px] text-[var(--text-dim)]">{agent.label}</div>
            <div className="h-2.5 flex-1 overflow-hidden rounded-md bg-[var(--surface-3)]">
              <motion.div
                className="h-full rounded-md"
                style={{ background: agent.color }}
                initial={{ width: 0 }}
                animate={{ width: `${(count / max) * 100}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
            <div className="w-9 shrink-0 text-right text-[12.5px] tabular-nums">{count}</div>
          </div>
        );
      })}
    </div>
  );
}
