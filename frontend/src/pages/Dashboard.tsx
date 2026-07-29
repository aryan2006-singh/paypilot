import { useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { StatTile } from "../components/StatTile";
import { Card } from "../components/Card";
import { AgentBarChart } from "../components/AgentBarChart";
import { AgentChip, StatusChip } from "../components/Chips";
import { useAgents, agentById } from "../hooks/useAgents";
import { api } from "../api";
import type { ActivityEntry, Stats } from "../types";

function timeAgo(unixSeconds: number): string {
  const diff = Date.now() / 1000 - unixSeconds;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function Dashboard() {
  const agents = useAgents();
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[] | null>(null);

  useEffect(() => {
    Promise.all([api.stats(), api.activity(10)]).then(([s, a]) => {
      setStats(s);
      setActivity(a);
    });
  }, []);

  const mostActive = stats
    ? Object.entries(stats.by_agent).sort((a, b) => b[1] - a[1])[0]
    : undefined;
  const mostActiveMeta = mostActive && mostActive[1] > 0 ? agentById(agents, mostActive[0]) : undefined;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Live overview of routed queries across the payments ops agents." />

      <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        <StatTile label="Total queries" value={stats?.total ?? "—"} sub="this session" delay={0} />
        <StatTile label="Live tool calls" value={stats?.live_count ?? "—"} sub="real Razorpay data" delay={0.05} />
        <StatTile label="Demo tool calls" value={stats?.mock_count ?? "—"} sub="mock fallback data" delay={0.1} />
        <StatTile
          label="Most active agent"
          value={mostActiveMeta ? mostActiveMeta.label : "—"}
          sub={mostActive && mostActive[1] > 0 ? `${mostActive[1]} queries` : "no activity yet"}
          delay={0.15}
        />
      </div>

      <Card title="Chats by agent" delay={0.1}>
        {agents ? (
          <AgentBarChart agents={agents} counts={stats?.by_agent ?? {}} />
        ) : (
          <div className="py-6 text-center text-[13px] text-[var(--text-muted)]">Loading…</div>
        )}
      </Card>

      <Card title="Recent activity" delay={0.15}>
        {!activity || activity.length === 0 ? (
          <div className="py-6 text-center text-[13px] text-[var(--text-muted)]">
            No queries yet — try the Chat tab.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  {["Time", "Agent", "Message", "Entity", "Source"].map((h) => (
                    <th key={h} className="border-b border-[var(--border)] px-2.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activity.map((entry, i) => {
                  const meta = agentById(agents, entry.agent_used);
                  return (
                    <tr key={i}>
                      <td className="border-b border-[var(--border)] px-2.5 py-2 text-[var(--text-dim)] last:border-0">{timeAgo(entry.timestamp)}</td>
                      <td className="border-b border-[var(--border)] px-2.5 py-2 last:border-0">
                        <AgentChip label={meta?.label ?? entry.agent_used} color={meta?.color ?? "#888"} />
                      </td>
                      <td className="max-w-[320px] truncate border-b border-[var(--border)] px-2.5 py-2 text-[var(--text)] last:border-0">{entry.message}</td>
                      <td className="border-b border-[var(--border)] px-2.5 py-2 text-[var(--text-dim)] last:border-0">{entry.entity_id ?? "—"}</td>
                      <td className="border-b border-[var(--border)] px-2.5 py-2 last:border-0">
                        {entry.mock === true ? <StatusChip kind="demo" /> : entry.mock === false ? <StatusChip kind="live" /> : <span className="text-[var(--text-muted)]">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
