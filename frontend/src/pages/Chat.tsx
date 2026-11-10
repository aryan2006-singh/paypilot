import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowUp, ArrowDown, SquarePen } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { ChatMessageView, ThinkingBubble, type ChatItem } from "../components/ChatMessage";
import { ChatWelcome } from "../components/ChatWelcome";
import { Button, describeError } from "../components/States";
import { useAgents, agentById } from "../hooks/useAgents";
import { api } from "../api";
import { recheckHealth } from "../hooks/useHealth";

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
    if (atBottom) scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, sending]);

  function push(item: ChatItem) {
    chatHistory = [...chatHistory, item];
    setHistory(chatHistory);
  }

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || sending) return;
    push({ kind: "user", text, time: nowLabel() });
    setInput("");
    setSending(true);
    setAtBottom(true);

    try {
      const data = await api.chat(text, sessionId);
      push({ kind: "bot", time: nowLabel(), data });
    } catch (err) {
      recheckHealth();
      push({
        kind: "bot",
        time: nowLabel(),
        error: true,
        retryText: text,
        data: { agent_used: "general", reply: describeError(err as Error) },
      });
    } finally {
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
          {sending && <ThinkingBubble />}
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
          <button
            type="submit"
            disabled={sending || !input.trim()}
            aria-label="Send message"
            className="brand-gradient grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowUp size={18} strokeWidth={2.4} />
          </button>
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
