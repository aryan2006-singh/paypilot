import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { ChatMessageView, type ChatItem } from "../components/ChatMessage";
import { useAgents, agentById } from "../hooks/useAgents";
import { api } from "../api";

const sessionId = "web-" + Math.random().toString(36).slice(2, 10);

// Module-level so conversation survives navigating away and back (SPA, no reload).
const chatHistory: ChatItem[] = [];

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function Chat() {
  const agents = useAgents();
  const [history, setHistory] = useState<ChatItem[]>(chatHistory);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [history, typing]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  function push(item: ChatItem) {
    chatHistory.push(item);
    setHistory([...chatHistory]);
  }

  async function send(text: string) {
    if (!text.trim() || sending) return;
    push({ kind: "user", text, time: nowLabel() });
    setInput("");
    setSending(true);
    setTyping(true);

    try {
      const data = await api.chat(text, sessionId);
      push({ kind: "bot", time: nowLabel(), data });
    } catch (err) {
      push({
        kind: "bot",
        time: nowLabel(),
        data: { agent_used: "general", reply: `Error: ${(err as Error).message}` },
      });
    } finally {
      setTyping(false);
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Chat" subtitle="Ask about a payment, refund, settlement, or general policy question." />

      <div ref={scrollRef} className="mb-3 flex-1 space-y-4 overflow-y-auto pr-1">
        {history.length === 0 && (
          <ChatMessageView
            item={{
              kind: "bot",
              time: nowLabel(),
              data: {
                agent_used: "general",
                reply:
                  "Hi — I can help with payments, refunds, reconciliation, and fraud checks. Try one of the examples below, or ask about a payment ID like pay_ABC123.",
              },
            }}
          />
        )}
        {history.map((item, i) => (
          <ChatMessageView key={i} item={item} agentMeta={item.kind === "bot" ? agentById(agents, item.data.agent_used) : undefined} />
        ))}
        {typing && (
          <div className="flex max-w-[92%] gap-2.5">
            <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#6d5efc] to-[#9b8cff] text-[11px] font-bold text-white">
              P
            </div>
            <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--text-muted)]"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {(agents ?? []).map((agent) => (
          <button
            key={agent.id}
            onClick={() => send(agent.example)}
            className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[12.5px] text-[var(--text-dim)] transition-colors hover:border-[#6d5efc] hover:text-[var(--text)]"
          >
            {agent.label}: {agent.example}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2.5"
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Ask about a payment, refund, or settlement… (Enter to send)"
          className="max-h-[120px] flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-[14.5px] leading-snug outline-none transition-colors focus:border-[#6d5efc]"
        />
        <button
          type="submit"
          disabled={sending}
          className="flex h-[42px] items-center gap-1.5 rounded-xl bg-gradient-to-br from-[#6d5efc] to-[#9b8cff] px-5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Send size={15} /> Send
        </button>
      </form>
    </div>
  );
}
