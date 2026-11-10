import { Fragment, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Wrench, Copy, Check, User, AlertTriangle, RotateCw, ChevronRight, Braces, CircleCheck, CircleAlert, Loader2 } from "lucide-react";
import type { AgentMeta, AgentStep, ChatResponse } from "../types";
import { StatusChip } from "./Chips";
import { BrandMark } from "./Sidebar";

export interface UserMessage {
  kind: "user";
  text: string;
  time: string;
}

export interface BotMessage {
  kind: "bot";
  time: string;
  /** Request failed; `data.reply` holds a readable error message. */
  error?: boolean;
  /** The user text to resend when the person presses Retry. */
  retryText?: string;
  /** Agent steps received from /chat/stream, in order. */
  steps?: AgentStep[];
  /** The reply is still streaming in. */
  streaming?: boolean;
  /** The person pressed Stop; `data.reply` holds whatever had arrived. */
  stopped?: boolean;
  data: Omit<Partial<ChatResponse>, "agent_used"> & { reply: string; agent_used: string };
}

export type ChatItem = UserMessage | BotMessage;

function KvGrid({ obj }: { obj: Record<string, unknown> }) {
  const entries = Object.entries(obj).filter(([k]) => k !== "mock" && k !== "fallback_reason");
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 font-mono text-[12.5px]">
      {entries.map(([k, v]) => (
        <Fragment key={k}>
          <dt className="text-[var(--text-muted)]">{k}</dt>
          <dd className="break-all text-[var(--text)]">{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1200);
    });
  };
  return { copied, copy };
}

function IconAction({ onClick, label, done, icon: Icon }: { onClick: () => void; label: string; done: boolean; icon: typeof Copy }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[11.5px] text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
    >
      {done ? <Check size={12} aria-hidden /> : <Icon size={12} aria-hidden />}
      {done ? "Copied" : label}
    </button>
  );
}

/** Collapsible panel for the supporting evidence under a reply. */
function Details({ icon: Icon, title, badge, defaultOpen, children }: { icon: typeof Copy; title: string; badge?: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <details open={defaultOpen} className="group/d overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-[11.5px] font-semibold uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--text)] [&::-webkit-details-marker]:hidden">
        <ChevronRight size={13} className="transition-transform group-open/d:rotate-90" aria-hidden />
        <Icon size={12} aria-hidden /> {title}
        {badge && <span className="ml-auto">{badge}</span>}
      </summary>
      <div className="border-t border-[var(--border)] px-3 py-2.5">{children}</div>
    </details>
  );
}

function StepIcon({ status }: { status: AgentStep["status"] }) {
  if (status === "running") return <Loader2 size={13} className="animate-spin text-[var(--accent)]" aria-label="In progress" />;
  if (status === "error") return <CircleAlert size={13} style={{ color: "var(--critical)" }} aria-label="Failed" />;
  return <CircleCheck size={13} style={{ color: "var(--ok)" }} aria-label="Done" />;
}

function StepRows({ steps }: { steps: AgentStep[] }) {
  return (
    <ol className="space-y-1 text-[12.5px]">
      {steps.map((step) => (
        <motion.li key={step.id} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-2">
          <span className="mt-[3px] shrink-0">
            <StepIcon status={step.status} />
          </span>
          <span className={step.status === "running" ? "text-[var(--text)]" : "text-[var(--text-dim)]"}>
            {step.label}
            {step.detail && <span className="text-[var(--text-muted)]"> · {step.detail}</span>}
          </span>
        </motion.li>
      ))}
    </ol>
  );
}

export function ThinkingBubble() {
  return (
    <div className="flex gap-3" aria-label="PayPilot is thinking">
      <BrandMark size={30} />
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--text-muted)]" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}

export function ChatMessageView({ item, agentMeta, onRetry }: { item: ChatItem; agentMeta?: AgentMeta; onRetry?: () => void }) {
  const { copied, copy } = useCopy();

  if (item.kind === "user") {
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="ml-auto flex max-w-[85%] flex-row-reverse gap-3 max-sm:max-w-[92%]">
        <div aria-hidden className="mt-0.5 grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-dim)]">
          <User size={15} />
        </div>
        <div className="flex min-w-0 flex-col items-end gap-1">
          <div className="text-[11px] text-[var(--text-muted)]">
            <span className="sr-only">You, </span>
            {item.time}
          </div>
          <div className="whitespace-pre-wrap break-words rounded-2xl rounded-tr-md bg-[var(--accent-soft)] px-4 py-2.5 text-[14.5px] leading-relaxed">
            {item.text}
          </div>
        </div>
      </motion.div>
    );
  }

  const { data, steps, streaming, stopped } = item;

  if (item.error) {
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex max-w-[85%] gap-3 max-sm:max-w-full" role="alert">
        <div
          aria-hidden
          className="mt-0.5 grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px]"
          style={{ background: "color-mix(in srgb, var(--critical) 14%, transparent)", color: "var(--critical)" }}
        >
          <AlertTriangle size={15} />
        </div>
        <div
          className="flex min-w-0 flex-1 items-start gap-3 rounded-2xl rounded-tl-md border px-4 py-3"
          style={{ borderColor: "color-mix(in srgb, var(--critical) 30%, var(--border))", background: "color-mix(in srgb, var(--critical) 6%, var(--surface))" }}
        >
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-medium">Couldn't get an answer</div>
            <div className="mt-0.5 text-[13px] leading-relaxed text-[var(--text-dim)]">{data.reply}</div>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[12.5px] font-medium hover:bg-[var(--surface-2)]"
            >
              <RotateCw size={13} aria-hidden /> Retry
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="group flex max-w-[85%] gap-3 max-sm:max-w-full">
      <BrandMark size={30} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="sr-only">PayPilot, </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-3)] py-[3px] pl-2 pr-2.5 text-[11.5px] font-semibold">
            <span aria-hidden className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: agentMeta?.color ?? "#888" }} />
            {agentMeta?.label ?? (data.agent_used || (streaming ? "Routing…" : "PayPilot"))}
          </span>
          {data.entity_id && <code className="inline-code !text-[11px]">{data.entity_id}</code>}
          <span className="text-[11px] text-[var(--text-muted)]">{item.time}</span>
        </div>

        {steps && steps.length > 0 &&
          (streaming ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2" aria-live="polite">
              <div className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Working</div>
              <StepRows steps={steps} />
            </div>
          ) : (
            <Details icon={CircleCheck} title={`Agent steps (${steps.length})`}>
              <StepRows steps={steps} />
            </Details>
          ))}

        {(data.reply || !streaming) && (
          <div className="whitespace-pre-wrap break-words rounded-2xl rounded-tl-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[14.5px] leading-relaxed shadow-[var(--shadow-sm)]">
            {data.reply || (stopped ? <span className="text-[var(--text-muted)]">No reply yet.</span> : null)}
            {streaming && (
              <span aria-hidden className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-[var(--text-muted)]" />
            )}
          </div>
        )}

        {stopped && (
          <div className="flex items-center gap-2 text-[12.5px] text-[var(--text-muted)]">
            Stopped before the reply finished.
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-[12px] font-medium text-[var(--text)] hover:bg-[var(--surface-2)]"
              >
                <RotateCw size={12} aria-hidden /> Retry
              </button>
            )}
          </div>
        )}

        {!streaming && data.tool_result && (
          <Details
            icon={Wrench}
            title="Tool result"
            defaultOpen
            badge={data.tool_result.error ? undefined : <StatusChip kind={data.tool_result.mock ? "demo" : "live"} />}
          >
            {data.tool_result.error ? (
              <div className="text-[13px]" style={{ color: "var(--critical)" }}>
                {data.tool_result.error}
              </div>
            ) : (
              <>
                <KvGrid obj={data.tool_result} />
                {data.tool_result.fallback_reason && (
                  <div className="mt-2 text-[11.5px] text-[var(--text-muted)]">
                    Live call unavailable, showing demo data: {data.tool_result.fallback_reason}
                  </div>
                )}
              </>
            )}
          </Details>
        )}

        {!streaming && data.policy_context && (
          <Details icon={FileText} title="Policy context">
            <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--text-dim)]">{data.policy_context}</div>
          </Details>
        )}

        {!streaming && !stopped && <div className="flex gap-0.5 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100 max-md:opacity-100">
          <IconAction icon={Copy} label="Copy" done={copied === "reply"} onClick={() => copy("reply", data.reply)} />
          <IconAction icon={Braces} label="Copy JSON" done={copied === "json"} onClick={() => copy("json", JSON.stringify(data, null, 2))} />
        </div>}
      </div>
    </motion.div>
  );
}
