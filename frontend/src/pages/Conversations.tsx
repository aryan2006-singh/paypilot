import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { History, MessageSquare, Trash2 } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { AgentChip } from "../components/Chips";
import { Button, EmptyState, ErrorState, Skeleton } from "../components/States";
import { useAgents, agentById } from "../hooks/useAgents";
import { useAsync } from "../hooks/useAsync";
import { api } from "../api";
import { fullTime, timeAgo } from "../lib/format";

export function Conversations() {
  const agents = useAgents();
  const navigate = useNavigate();
  const list = useAsync(() => api.conversations(100));
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<Error | null>(null);

  async function remove(id: string) {
    setDeleting(id);
    setDeleteError(null);
    try {
      await api.deleteConversation(id);
      list.reload();
    } catch (e) {
      setDeleteError(e as Error);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      <PageHeader title="History" subtitle="Conversations saved on the server. Open one to continue where you left off.">
        <Button size="sm" icon={MessageSquare} onClick={() => navigate("/app/chat")}>
          New chat
        </Button>
      </PageHeader>

      {deleteError && (
        <div className="mb-4">
          <ErrorState error={deleteError} compact />
        </div>
      )}

      <Card bodyClassName="p-0">
        {list.error && !list.data ? (
          <div className="p-5">
            <ErrorState error={list.error} onRetry={list.reload} />
          </div>
        ) : list.loading && !list.data ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : list.data && list.data.length === 0 ? (
          <EmptyState
            icon={History}
            title="No conversations yet"
            body="Ask PayPilot something and it will show up here."
            action={
              <Link to="/app/chat" className="brand-gradient inline-flex h-9 items-center rounded-lg px-3.5 text-[13px] font-semibold text-white">
                Start a chat
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {list.data?.map((c) => {
              const agent = c.last_agent ? agentById(agents, c.last_agent) : undefined;
              return (
                <li key={c.id} className="flex items-center gap-3 px-5 py-3.5 max-sm:px-4">
                  <Link to={`/app/chat?c=${encodeURIComponent(c.id)}`} className="min-w-0 flex-1 rounded-lg outline-offset-4">
                    <div className="truncate text-[14px] font-medium">{c.title || "Untitled conversation"}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--text-muted)]">
                      {agent && <AgentChip label={agent.label} color={agent.color} />}
                      <span>{c.message_count} messages</span>
                      <span title={fullTime(c.updated_at)}>{timeAgo(c.updated_at)}</span>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    disabled={deleting === c.id}
                    aria-label={`Delete conversation ${c.title}`}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--critical)] disabled:opacity-50"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
