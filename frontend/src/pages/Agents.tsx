import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { CreditCard, RotateCcw, Scale, ShieldAlert, LifeBuoy, ArrowRight, BookOpen, Wrench, Bot, type LucideIcon } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { EmptyState, ErrorState, Skeleton } from "../components/States";
import { useAgentsState } from "../hooks/useAgents";

// Presentation details the API doesn't send: an icon, and which policy docs
// (RAG namespace) and MCP tool each agent uses. Mirrors agents/graph.py.
const AGENT_UI: Record<string, { icon: LucideIcon; rag: boolean; tool?: string }> = {
  payments: { icon: CreditCard, rag: true, tool: "get_payment_status" },
  refunds: { icon: RotateCcw, rag: true, tool: "get_refund_status" },
  reconciliation: { icon: Scale, rag: true, tool: "match_settlement" },
  fraud: { icon: ShieldAlert, rag: false, tool: "score_risk" },
  general: { icon: LifeBuoy, rag: true },
};

function Tag({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] text-[var(--text-muted)]">
      <Icon size={11} aria-hidden />
      {children}
    </span>
  );
}

export function Agents() {
  const { agents, error, retry } = useAgentsState();

  return (
    <div>
      <PageHeader
        title="Agents"
        subtitle="Five specialists behind a keyword router: RAG-grounded policy context plus live MCP tool calls."
      />

      {error && !agents ? (
        <ErrorState error={error} onRetry={retry} />
      ) : !agents ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <Skeleton className="h-9 w-9 rounded-xl" />
              <Skeleton className="mt-4 h-4 w-28" />
              <Skeleton className="mt-3 h-3" />
              <Skeleton className="mt-2 h-3 w-4/5" />
            </div>
          ))}
        </div>
      ) : agents.length === 0 ? (
        <EmptyState icon={Bot} title="No agents configured" body="The API returned no agents." />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {agents.map((agent, i) => {
            const ui = AGENT_UI[agent.id] ?? { icon: Bot, rag: false };
            const Icon = ui.icon;
            return (
              <motion.article
                key={agent.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                className="group flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-md)]"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                    style={{ background: `color-mix(in srgb, ${agent.color} 14%, transparent)`, color: agent.color }}
                  >
                    <Icon size={17} aria-hidden />
                  </div>
                  <h2 className="text-[15px] font-semibold tracking-tight">{agent.label}</h2>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-[var(--text-dim)]">{agent.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {ui.rag && <Tag icon={BookOpen}>Policy docs</Tag>}
                  {ui.tool && <Tag icon={Wrench}>{ui.tool}</Tag>}
                </div>
                <div className="mt-auto pt-4">
                  <Link
                    to={`/app/chat?q=${encodeURIComponent(agent.example)}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-left transition-colors hover:border-[var(--accent)]"
                  >
                    <span className="min-w-0">
                      <span className="block text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Try it</span>
                      <span className="mt-0.5 block truncate text-[12.5px] text-[var(--text)]">{agent.example}</span>
                    </span>
                    <ArrowRight size={15} className="shrink-0 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}
    </div>
  );
}
