import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowUp, ArrowDown, Square, SquarePen } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { ChatMessageView, type BotMessage, type ChatItem } from "../components/ChatMessage";
import { ChatWelcome } from "../components/ChatWelcome";
import { Button, describeError } from "../components/States";
import { useAgents, agentById } from "../hooks/useAgents";
import { api } from "../api";
import { recheckHealth } from "../hooks/useHealth";
import type { AgentStep } from "../types";

const MAX_CHARS = 2000; // mirrors ChatRequest.message max_length on the API

function newSessionId() {
  return "web-" + Math.random().toString(36).slice(2, 10);
}

// Module-level so the conversation survives navigating away and back (SPA, no reload).
let sessionId = newSessionId();
let chatHistory: ChatItem[] = [];

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function Chat() {
  const agents = useAgents();
  const [params, setParams] = useSearchParams();
  const [history, setHistory] = useState<ChatItem[]>(chatHistory);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Prefill from links like #/chat?q=... (Agents "Try it", Dashboard "Ask again").
  useEffect(() => {
    const q = params.get("q");
    if (q) {
      setInput(q.slice(0, MAX_CHARS));
      setParams({}, { replace: true });
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        el?.focus();
        el?.setSelectionRange(el.value.length, el.value.length);
      });
    }
  }, [params, setParams]);

  useEffect(() => {
    textareaRef.current?.focus();
    return () => abortRef.current?.abort();
  }, []);

  // Grow the composer with its content, up to a cap.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [input]);

  const scrollToBottom = (smooth = true) => {
    const el = scrollRef.current;
    el?.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  useEffect(() => {
    // Jump instantly while streaming: a smooth scroll racing per-token updates
    // fires onScroll mid-animation and would drop out of follow mode.
    if (atBottom) scrollToBottom(!sending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, sending]);

  function push(item: ChatItem) {
    chatHistory = [...chatHistory, item];
    setHistory(chatHistory);
  }

  /** Replace the bot message at `index` with `update(previous)`. */
  function patch(index: number, update: (prev: BotMessage) => BotMessage) {
    const prev = chatHistory[index];
    if (prev?.kind !== "bot") return;
    chatHistory = chatHistory.map((item, i) => (i === index ? update(prev) : item));
    setHistory(chatHistory);
  }

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || sending) return;
    push({ kind: "user", text, time: nowLabel() });
    setInput("");
    setSending(true);
    setAtBottom(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const index = chatHistory.length;
    push({ kind: "bot", time: nowLabel(), streaming: true, steps: [], data: { agent_used: "", reply: "" } });

    const upsertStep = (steps: AgentStep[] = [], step: AgentStep) =>
      steps.some((s) => s.id === step.id) ? steps.map((s) => (s.id === step.id ? step : s)) : [...steps, step];
    const fail = (message: string) =>
      patch(index, (m) => ({ ...m, streaming: false, error: true, retryText: text, data: { agent_used: "general", reply: message } }));

    try {
      let finished = false;
      await api.chatStream(
        text,
        sessionId,
        (event) => {
          switch (event.type) {
            case "step": {
              const { type: _type, ...step } = event;
              patch(index, (m) => ({ ...m, steps: upsertStep(m.steps, step) }));
              break;
            }
            case "meta":
              patch(index, (m) => ({
                ...m,
                data: { ...m.data, agent_used: event.agent_used, intent: event.intent, entity_id: event.entity_id },
              }));
              break;
            case "token":
              patch(index, (m) => ({ ...m, data: { ...m.data, reply: m.data.reply + event.text } }));
              break;
            case "done":
              finished = true;
              patch(index, (m) => ({ ...m, streaming: false, data: event.response }));
              break;
            case "error":
              finished = true;
              fail(`The agent hit an error: ${event.message}`);
              break;
          }
        },
        controller.signal,
      );
      if (!finished) throw new Error("The connection closed before the reply finished.");
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        patch(index, (m) => ({
          ...m,
          streaming: false,
          stopped: true,
          retryText: text,
          steps: m.steps?.map((s) => (s.status === "running" ? { ...s, status: "done" } : s)),
        }));
      } else {
        recheckHealth();
        fail(describeError(err as Error));
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function newChat() {
    chatHistory = [];
    sessionId = newSessionId();
    setHistory([]);
    setInput("");
    textareaRef.current?.focus();
  }

  const empty = history.length === 0;
  const over = input.length > MAX_CHARS * 0.9;

  return (
    <div className="flex h-full flex-col">
      <PageHeader compact title="Chat" subtitle="Ask about a payment, refund, settlement, or general policy question.">
        {!empty && (
          <Button size="sm" icon={SquarePen} onClick={newChat} disabled={sending}>
            New chat
          </Button>
        )}
      </PageHeader>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
          }}
          role="log"
          aria-live="polite"
          aria-label="Conversation"
          className="h-full space-y-5 overflow-y-auto pb-4 pr-1"
        >
          {empty ? (
            <ChatWelcome agents={agents} onPick={send} disabled={sending} />
          ) : (
            history.map((item, i) => (
              <ChatMessageView
                key={i}
                item={item}
                agentMeta={item.kind === "bot" && !item.error ? agentById(agents, item.data.agent_used) : undefined}
                onRetry={item.kind === "bot" && item.retryText && !sending ? () => send(item.retryText!) : undefined}
              />
            ))
          )}
        </div>

        {!atBottom && !empty && (
          <button
            type="button"
            onClick={() => scrollToBottom()}
            aria-label="Jump to latest message"
            className="absolute bottom-3 left-1/2 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-dim)] shadow-[var(--shadow-md)] hover:text-[var(--text)]"
          >
            <ArrowDown size={15} />
          </button>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[var(--shadow-md)] transition-colors focus-within:border-[var(--accent)]"
      >
        <label htmlFor="chat-input" className="sr-only">
          Message PayPilot
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id="chat-input"
            ref={textareaRef}
            rows={1}
            value={input}
            maxLength={MAX_CHARS}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask about a payment or refund…"
            className="max-h-[180px] min-h-[40px] flex-1 resize-none bg-transparent px-2.5 py-2 text-[14.5px] leading-snug max-md:text-[16px] outline-none placeholder:text-[var(--text-muted)] focus-visible:outline-none"
          />
          {sending ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              aria-label="Stop generating"
              title="Stop"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] transition-colors hover:border-[var(--accent)]"
            >
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Send message"
              className="brand-gradient grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowUp size={18} strokeWidth={2.4} />
            </button>
          )}
        </div>
        <div className={`flex items-center justify-between px-2.5 pb-0.5 pt-1 text-[11px] text-[var(--text-muted)] ${over ? "" : "max-sm:hidden"}`}>
          <span className="max-sm:hidden">
            <kbd className="kbd">Enter</kbd> to send · <kbd className="kbd">Shift</kbd> + <kbd className="kbd">Enter</kbd> for a new line
          </span>
          <span className={`ml-auto tabular-nums ${over ? "" : "invisible"}`} style={over ? { color: "var(--warn)" } : undefined}>
            {input.length}/{MAX_CHARS}
          </span>
        </div>
      </form>
    </div>
  );
}
