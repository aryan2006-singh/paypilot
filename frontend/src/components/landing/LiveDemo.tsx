import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUp, CircleAlert, CircleCheck, Loader2, Square } from "lucide-react";
import { api } from "../../api";
import { useAgents, agentById } from "../../hooks/useAgents";
import { describeError } from "../States";
import { AgentChip, StatusChip } from "../Chips";
import { Markdown } from "../Markdown";
import { BrandMark } from "../Sidebar";
import type { AgentStep, ToolResult } from "../../types";

interface DemoState {
  question: string;
  steps: AgentStep[];
  agent: string | null;
  reply: string;
  streaming: boolean;
  error: string | null;
  tool: ToolResult | null;
}

const MAX_CHARS = 2000;
const demoSession = "site-" + Math.random().toString(36).slice(2, 10);

/**
 * The hero's "try it" panel. Every answer here comes from the real
 * /chat/stream endpoint, so a visitor sees the actual agents at work.
 */
export function LiveDemo() {
  const agents = useAgents();
  const [input, setInput] = useState("");
  const [state, setState] = useState<DemoState | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state]);

  const busy = !!state?.streaming;

  async function ask(raw: string) {
    const question = raw.trim().slice(0, MAX_CHARS);
    if (!question || busy) return;
    setInput("");
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ question, steps: [], agent: null, reply: "", streaming: true, error: null, tool: null });
    const update = (fn: (s: DemoState) => DemoState) => setState((s) => (s ? fn(s) : s));

    try {
      let finished = false;
      await api.chatStream(
        question,
        demoSession,
        (event) => {
          switch (event.type) {
            case "step": {
              const { type: _t, ...step } = event;
              update((s) => ({
                ...s,
                steps: s.steps.some((x) => x.id === step.id) ? s.steps.map((x) => (x.id === step.id ? step : x)) : [...s.steps, step],
              }));
              break;
            }
            case "meta":
              update((s) => ({ ...s, agent: event.agent_used }));
              break;
            case "token":
              update((s) => ({ ...s, reply: s.reply + event.text }));
              break;
            case "done":
              finished = true;
              update((s) => ({
                ...s,
                streaming: false,
                reply: event.response.reply,
                agent: event.response.agent_used,
                tool: event.response.tool_result,
              }));
              break;
            case "error":
              finished = true;
              update((s) => ({ ...s, streaming: false, error: event.message }));
              break;
          }
        },
        controller.signal,
      );
      if (!finished) throw new Error("The connection closed before the reply finished.");
    } catch (err) {
      const e = err as Error;
      update((s) => ({
        ...s,
        streaming: false,
        error: e.name === "AbortError" ? (s.reply ? null : "Stopped.") : describeError(e),
      }));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  const agentMeta = state?.agent ? agentById(agents, state.agent) : undefined;
  const examples = agents?.map((a) => a.example).slice(0, 4) ?? [];

  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none absolute -inset-10 bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--accent)_10%,transparent),transparent)] blur-2xl" />
      <div className="relative overflow-hidden border border-[var(--border-strong)] bg-[var(--surface)] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]">
        <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5">
          <span className="flex gap-1.5" aria-hidden>
            <span className="h-2 w-2 bg-[var(--accent)]" />
            <span className="h-2 w-2 bg-[var(--border-strong)]" />
            <span className="h-2 w-2 bg-[var(--border-strong)]" />
          </span>
          <span className="font-display ml-2 text-[11.5px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">Try PayPilot live</span>
          <span className="ml-auto bg-[var(--accent-soft)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--accent-text)]">
            Real API
          </span>
        </div>

        <div ref={bodyRef} className="h-[300px] overflow-y-auto px-4 py-4 max-sm:h-[280px]" aria-live="polite">
          {!state ? (
            <div className="flex h-full flex-col justify-center">
              <div className="flex items-center gap-2.5">
                <BrandMark size={28} />
                <div className="text-[14px] font-semibold">Ask a payments question</div>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-dim)]">
                Pick an example or type your own. Your question goes to the same agents the console uses.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                {examples.length
                  ? examples.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => ask(ex)}
                        className="group flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-left text-[13px] transition-colors hover:border-[var(--accent)]"
                      >
                        <span className="truncate">{ex}</span>
                        <ArrowRight size={14} className="shrink-0 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5" />
                      </button>
                    ))
                  : [0, 1, 2].map((i) => <div key={i} className="skeleton h-10 rounded-xl" />)}
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[var(--accent)] px-3.5 py-2 text-[13.5px] text-[var(--on-accent)]">{state.question}</div>
              </div>

              {state.steps.length > 0 && (
                <ol className="space-y-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
                  {state.steps.map((s) => (
                    <li key={s.id} className="flex items-start gap-2 text-[12.5px]">
                      {s.status === "running" ? (
                        <Loader2 size={13} className="mt-0.5 shrink-0 animate-spin text-[var(--accent)]" />
                      ) : s.status === "error" ? (
                        <CircleAlert size={13} className="mt-0.5 shrink-0 text-[var(--critical)]" />
                      ) : (
                        <CircleCheck size={13} className="mt-0.5 shrink-0 text-[var(--ok)]" />
                      )}
                      <span className="text-[var(--text-dim)]">
                        {s.label}
                        {s.detail && <span className="text-[var(--text-muted)]"> · {s.detail}</span>}
                      </span>
                    </li>
                  ))}
                </ol>
              )}

              {(state.reply || state.error || agentMeta) && (
                <div className="flex gap-2.5">
                  <BrandMark size={24} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      {agentMeta && <AgentChip label={agentMeta.label} color={agentMeta.color} />}
                      {state.tool && typeof state.tool.mock === "boolean" && <StatusChip kind={state.tool.mock ? "demo" : "live"} />}
                    </div>
                    {state.reply && (
                      <div className="text-[13.5px] leading-relaxed">
                        <Markdown>{state.reply}</Markdown>
                        {state.streaming && <span className="inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-[var(--accent)] align-middle" />}
                      </div>
                    )}
                    {state.error && <p className="text-[13px] text-[var(--critical)]">{state.error}</p>}
                  </div>
                </div>
              )}

              {!state.streaming && (
                <div className="flex flex-wrap items-center gap-3 pt-1 text-[12.5px]">
                  <Link to={`/app/chat?q=${encodeURIComponent(state.question)}`} className="font-medium text-[var(--accent-text)] hover:underline">
                    Continue in the console
                  </Link>
                  <button type="button" onClick={() => setState(null)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
                    Ask something else
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="flex items-center gap-2 border-t border-[var(--border)] p-2.5"
        >
          <label htmlFor="demo-input" className="sr-only">
            Ask PayPilot
          </label>
          <input
            id="demo-input"
            value={input}
            maxLength={MAX_CHARS}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. Why did pay_XYZ789 fail?"
            className="h-10 min-w-0 flex-1 rounded-lg bg-[var(--surface-2)] px-3 text-[14px] outline-none placeholder:text-[var(--text-muted)] max-md:text-[16px]"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              aria-label="Stop"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)]"
            >
              <Square size={13} fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              aria-label="Send"
              disabled={!input.trim()}
              className="brand-gradient grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white transition-opacity disabled:opacity-40"
            >
              <ArrowUp size={16} />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
