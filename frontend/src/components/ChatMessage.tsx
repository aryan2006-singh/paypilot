import { Fragment, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Wrench, Copy, Check } from "lucide-react";
import type { AgentMeta, ChatResponse } from "../types";
import { StatusChip } from "./Chips";

export interface UserMessage {
  kind: "user";
  text: string;
  time: string;
}

export interface BotMessage {
  kind: "bot";
  time: string;
  data: Partial<ChatResponse> & { reply: string; agent_used: string };
}

export type ChatItem = UserMessage | BotMessage;

function KvGrid({ obj }: { obj: Record<string, unknown> }) {
  const entries = Object.entries(obj).filter(([k]) => k !== "mock" && k !== "fallback_reason");
  return (
    <div className="grid grid-cols-[max-content_1fr] gap-x-3.5 gap-y-1.5 font-mono text-[12.5px]">
      {entries.map(([k, v]) => (
        <Fragment key={k}>
          <div className="text-[var(--text-muted)]">{k}</div>
          <div className="break-all text-[var(--text)]">
            {typeof v === "object" ? JSON.stringify(v) : String(v)}
          </div>
        </Fragment>
      ))}
    </div>
  );
}

export function ChatMessageView({ item, agentMeta }: { item: ChatItem; agentMeta?: AgentMeta }) {
  const [copied, setCopied] = useState(false);

  if (item.kind === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="ml-auto flex max-w-[92%] flex-row-reverse gap-2.5"
      >
        <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[11px] font-bold text-[var(--text-dim)]">
          U
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="text-right text-[11px] text-[var(--text-muted)]">{item.time}</div>
          <div className="rounded-2xl rounded-tr-sm bg-[var(--surface-3)] px-3.5 py-2.5 text-[14.5px] leading-relaxed">
            {item.text}
          </div>
        </div>
      </motion.div>
    );
  }

  const { data } = item;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex max-w-[92%] gap-2.5">
      <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#6d5efc] to-[#9b8cff] text-[11px] font-bold text-white">
        P
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-3)] py-[3px] pl-1.5 pr-2.5 text-[11.5px] font-semibold">
            <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: agentMeta?.color ?? "#888" }} />
            {agentMeta?.label ?? data.agent_used}
          </span>
          {data.entity_id && <span className="text-[11px] text-[var(--text-muted)]">{data.entity_id}</span>}
          <span className="text-[11px] text-[var(--text-muted)]">{item.time}</span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(data, null, 2));
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
            className="ml-auto flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy JSON"}
          </button>
        </div>

        <div className="rounded-2xl rounded-tl-sm border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[14.5px] leading-relaxed">
          {data.reply}
        </div>

        {data.policy_context && (
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
            <div className="flex items-center gap-1.5 border-b border-[var(--border)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              <FileText size={12} /> Policy context
            </div>
            <div className="px-3 py-2.5 text-[13px] italic leading-relaxed text-[var(--text-dim)]">
              {data.policy_context}
            </div>
          </div>
        )}

        {data.tool_result && (
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
            <div className="flex items-center gap-1.5 border-b border-[var(--border)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              <Wrench size={12} /> Live tool result
              {data.tool_result.mock && <span className="ml-auto"><StatusChip kind="demo" /></span>}
            </div>
            <div className="px-3 py-2.5 text-[13px]">
              {data.tool_result.error ? (
                <div className="text-[13px]" style={{ color: "var(--critical)" }}>{data.tool_result.error}</div>
              ) : (
                <>
                  <KvGrid obj={data.tool_result} />
                  {data.tool_result.fallback_reason && (
                    <div className="mt-1.5 text-[11px] text-[var(--text-muted)]">
                      ℹ️ Live call unavailable, showing mock data — {data.tool_result.fallback_reason}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
