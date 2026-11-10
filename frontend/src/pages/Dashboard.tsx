import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Activity, MessageSquare, RotateCw, Zap, FlaskConical, Trophy, ArrowUpRight, Inbox } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { StatTile } from "../components/StatTile";
import { Card } from "../components/Card";
import { AgentBarChart } from "../components/AgentBarChart";
import { AgentChip, StatusChip } from "../components/Chips";
import { Button, EmptyState, ErrorState, Skeleton } from "../components/States";
import { useAgents, agentById } from "../hooks/useAgents";
import { useAsync } from "../hooks/useAsync";
import { api } from "../api";
import { fullTime, pct, timeAgo } from "../lib/format";
import type { ActivityEntry, Stats } from "../types";

const POLL_MS = 15000;

function SourceChip({ mock }: { mock: boolean | null }) {
  if (mock === true) return <StatusChip kind="demo" />;
  if (mock === false) return <StatusChip kind="live" />;
  return <span className="text-[12px] text-[var(--text-muted)]">No tool</span>;
}

function SourceSplit({ stats }: { stats: Stats }) {
  const tools = stats.live_count + stats.mock_count;
  const none = Math.max(0, stats.total - tools);
  const parts = [
    { label: "Live", value: stats.live_count, color: "var(--ok)" },
    { label: "Demo", value: stats.mock_count, color: "var(--warn)" },
    { label: "No tool call", value: none, color: "var(--border-strong)" },
  ];
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-[var(--surface-3)]" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")}>
        {stats.total > 0 && parts.map((p) => <div key={p.label} style={{ width: pct(p.value, stats.total), background: p.color }} />)}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px]">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-1.5 text-[var(--text-dim)]">
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.label}
            <span className="font-semibold tabular-nums text-[var(--text)]">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="space-y-3 p-5">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-3 flex-1" />
        </div>
      ))}
    </div>
  );
}

export function Dashboard() {
  const agents = useAgents();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<string>("all");
  const stats = useAsync(api.stats, { pollMs: POLL_MS });
  const activity = useAsync(() => api.activity(25), { pollMs: POLL_MS });

  const refresh = () => {
    stats.reload();
    activity.reload();
  };

  const mostActive = stats.data ? Object.entries(stats.data.by_agent).sort((a, b) => b[1] - a[1])[0] : undefined;
  const mostActiveMeta = mostActive && mostActive[1] > 0 ? agentById(agents, mostActive[0]) : undefined;
  const toolCalls = stats.data ? stats.data.live_count + stats.data.mock_count : 0;

  const rows = useMemo(
    () => (activity.data ?? []).filter((e) => filter === "all" || e.agent_used === filter),
    [activity.data, filter],
  );

  const openInChat = (entry: ActivityEntry) => navigate(`/chat?q=${encodeURIComponent(entry.message)}`);
  const refreshing = stats.refreshing || activity.refreshing;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Live overview of routed queries across the payments ops agents.">
        {stats.updatedAt && (
          <span className="text-[12px] text-[var(--text-muted)]" aria-live="polite">
            Updated {timeAgo(stats.updatedAt / 1000)}
          </span>
        )}
        <Button size="sm" icon={RotateCw} spin={refreshing} onClick={refresh} disabled={refreshing}>
          Refresh
        </Button>
        <Link
          to="/chat"
          className="brand-gradient inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold text-white hover:opacity-90"
        >
          <MessageSquare size={13} aria-hidden /> New query
        </Link>
      </PageHeader>

      {stats.error && !stats.data && (
        <div className="mb-5">
          <ErrorState error={stats.error} onRetry={refresh} />
        </div>
      )}

      <div className="mb-5 grid grid-cols-4 gap-3 max-lg:grid-cols-2">
        <StatTile label="Total queries" value={stats.data?.total ?? "—"} sub="since the server started" icon={Activity} loading={stats.loading} delay={0} />
        <StatTile
          label="Live tool calls"
          value={stats.data?.live_count ?? "—"}
          sub={toolCalls ? `${pct(stats.data!.live_count, toolCalls)} of tool calls` : "real Razorpay data"}
          icon={Zap}
          tone="var(--ok)"
          loading={stats.loading}
          delay={0.04}
        />
        <StatTile
          label="Demo tool calls"
          value={stats.data?.mock_count ?? "—"}
          sub={toolCalls ? `${pct(stats.data!.mock_count, toolCalls)} of tool calls` : "mock fallback data"}
          icon={FlaskConical}
          tone="var(--warn)"
          loading={stats.loading}
          delay={0.08}
        />
        <StatTile
          label="Most active agent"
          value={mostActiveMeta ? mostActiveMeta.label : "—"}
          sub={mostActive && mostActive[1] > 0 ? `${mostActive[1]} ${mostActive[1] === 1 ? "query" : "queries"}` : "no activity yet"}
          icon={Trophy}
          tone={mostActiveMeta?.color ?? "var(--accent)"}
          loading={stats.loading}
          delay={0.12}
        />
      </div>

      <div className="mb-5 grid grid-cols-[1.6fr_1fr] gap-5 max-lg:grid-cols-1">
        <Card title="Queries by agent" description="Where the router sent each question." delay={0.08}>
          {agents && stats.data ? (
            <AgentBarChart agents={agents} counts={stats.data.by_agent} />
          ) : (
            <div className="space-y-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-3" />
              ))}
            </div>
          )}
        </Card>
        <Card title="Data source" description="Live Razorpay data versus demo fallback." delay={0.1}>
          {stats.data ? <SourceSplit stats={stats.data} /> : <Skeleton className="h-10" />}
          {stats.data && stats.data.mock_count > 0 && stats.data.live_count === 0 && (
            <p className="mt-4 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-[12px] leading-relaxed text-[var(--text-muted)]">
              All tool calls used demo data. Add Razorpay keys to switch to live data. <Link className="font-medium text-[var(--accent-text)] hover:underline" to="/settings">View settings</Link>
            </p>
          )}
        </Card>
      </div>

      <Card
        title="Recent activity"
        description="The latest questions and how they were handled. Select one to ask it again."
        delay={0.12}
        bodyClassName=""
        actions={
          agents && (
            <label className="flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
              <span className="max-sm:sr-only">Agent</span>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-[12.5px] text-[var(--text)]"
              >
                <option value="all">All agents</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
          )
        }
      >
        {activity.loading ? (
          <ActivitySkeleton />
        ) : activity.error && !activity.data ? (
          <div className="p-5">
            <ErrorState error={activity.error} onRetry={activity.reload} compact />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={filter === "all" ? "No queries yet" : "No queries for this agent"}
            body={filter === "all" ? "Ask PayPilot about a payment, refund or settlement and it will show up here." : "Try another agent, or show all agents."}
            action={
              filter === "all" ? (
                <Link to="/chat" className="brand-gradient inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold text-white">
                  <MessageSquare size={14} aria-hidden /> Start a chat
                </Link>
              ) : (
                <Button size="sm" onClick={() => setFilter("all")}>Show all agents</Button>
              )
            }
          />
        ) : (
          <>
            {/* Table on larger screens */}
            <div className="overflow-x-auto max-md:hidden">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-[var(--surface-2)]">
                    {["Time", "Agent", "Message", "Entity", "Source", ""].map((h, i) => (
                      <th
                        key={i}
                        scope="col"
                        className="border-b border-[var(--border)] px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((entry, i) => {
                    const meta = agentById(agents, entry.agent_used);
                    return (
                      <tr key={`${entry.timestamp}-${i}`} className="group border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]">
                        <td className="whitespace-nowrap px-4 py-2.5 text-[var(--text-muted)]" title={fullTime(entry.timestamp)}>
                          {timeAgo(entry.timestamp)}
                        </td>
                        <td className="px-4 py-2.5">
                          <AgentChip label={meta?.label ?? entry.agent_used} color={meta?.color ?? "#888"} />
                        </td>
                        <td className="max-w-[380px] truncate px-4 py-2.5" title={entry.message}>
                          {entry.message}
                        </td>
                        <td className="px-4 py-2.5">
                          {entry.entity_id ? <code className="inline-code">{entry.entity_id}</code> : <span className="text-[var(--text-muted)]">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <SourceChip mock={entry.mock} />
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => openInChat(entry)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-[var(--text-muted)] opacity-0 transition-opacity hover:bg-[var(--surface-3)] hover:text-[var(--text)] focus-visible:opacity-100 group-hover:opacity-100"
                            aria-label={`Ask again: ${entry.message}`}
                          >
                            Ask again <ArrowUpRight size={12} aria-hidden />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Stacked list on phones */}
            <ul className="hidden divide-y divide-[var(--border)] max-md:block">
              {rows.map((entry, i) => {
                const meta = agentById(agents, entry.agent_used);
                return (
                  <li key={`${entry.timestamp}-${i}`}>
                    <button type="button" onClick={() => openInChat(entry)} className="w-full px-4 py-3 text-left active:bg-[var(--surface-2)]">
                      <div className="flex items-center gap-2">
                        <AgentChip label={meta?.label ?? entry.agent_used} color={meta?.color ?? "#888"} />
                        <SourceChip mock={entry.mock} />
                        <span className="ml-auto text-[11.5px] text-[var(--text-muted)]">{timeAgo(entry.timestamp)}</span>
                      </div>
                      <div className="mt-1.5 line-clamp-2 text-[13.5px]">{entry.message}</div>
                      {entry.entity_id && <code className="inline-code mt-1.5 inline-block">{entry.entity_id}</code>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
