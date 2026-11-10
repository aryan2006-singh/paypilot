import { motion } from "framer-motion";
import { CreditCard, RotateCcw, Scale, ShieldAlert, LifeBuoy, Bot, type LucideIcon } from "lucide-react";
import type { AgentMeta } from "../types";
import { BrandMark } from "./Sidebar";
import { Skeleton } from "./States";

const ICONS: Record<string, LucideIcon> = {
  payments: CreditCard,
  refunds: RotateCcw,
  reconciliation: Scale,
  fraud: ShieldAlert,
  general: LifeBuoy,
};

/** Empty-conversation screen: what PayPilot does, plus one-tap starters. */
export function ChatWelcome({ agents, onPick, disabled }: { agents: AgentMeta[] | null; onPick: (text: string) => void; disabled?: boolean }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center py-6 text-center">
      <BrandMark size={44} />
      <h2 className="mt-4 text-[19px] font-semibold tracking-tight">How can I help with payments today?</h2>
      <p className="mt-1.5 max-w-md text-[13.5px] leading-relaxed text-[var(--text-dim)]">
        I route your question to the right specialist, check policy docs, and look up live data. Mention an ID like{" "}
        <code className="inline-code">pay_ABC123</code> or <code className="inline-code">stl_44</code>.
      </p>

      <div className="mt-6 grid w-full max-w-[720px] grid-cols-2 gap-2.5 text-left max-sm:grid-cols-1">
        {agents
          ? agents.map((agent, i) => {
              const Icon = ICONS[agent.id] ?? Bot;
              return (
                <motion.button
                  key={agent.id}
                  type="button"
                  disabled={disabled}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.04 }}
                  onClick={() => onPick(agent.example)}
                  className="group flex items-start gap-3 rounded-xl text-left border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 transition-colors hover:border-[var(--accent)] hover:bg-[var(--surface-2)] disabled:opacity-50"
                >
                  <span
                    className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                    style={{ background: `color-mix(in srgb, ${agent.color} 14%, transparent)`, color: agent.color }}
                  >
                    <Icon size={14} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11.5px] font-semibold text-[var(--text-muted)]">{agent.label}</span>
                    <span className="mt-0.5 block text-[13.5px] leading-snug text-[var(--text)]">{agent.example}</span>
                  </span>
                </motion.button>
              );
            })
          : [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[62px] rounded-xl" />)}
      </div>
    </div>
  );
}
