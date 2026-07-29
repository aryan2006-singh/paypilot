import { motion } from "framer-motion";
import { PageHeader } from "../components/PageHeader";
import { useAgents } from "../hooks/useAgents";

export function Agents() {
  const agents = useAgents();

  return (
    <div>
      <PageHeader
        title="Agents"
        subtitle="Five specialists behind a keyword router: RAG-grounded policy context plus live MCP tool calls."
      />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3.5">
        {(agents ?? []).map((agent, i) => (
          <motion.div
            key={agent.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4.5"
          >
            <div className="mb-2.5 flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: agent.color }} />
              <strong className="text-[14.5px]">{agent.label}</strong>
            </div>
            <p className="mb-3 text-[13px] leading-relaxed text-[var(--text-dim)]">{agent.description}</p>
            <div className="border-l-2 border-[var(--border)] pl-2.5 text-[12px] italic text-[var(--text-muted)]">
              "{agent.example}"
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
