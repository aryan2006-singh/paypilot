import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  BookOpenText,
  Check,
  ChevronDown,
  Copy,
  Gauge,
  GitBranch,
  History,
  KeyRound,
  Menu,
  Moon,
  Radio,
  ShieldCheck,
  Sparkles,
  Sun,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import { api } from "../api";
import { useAsync } from "../hooks/useAsync";
import { useAgentsState } from "../hooks/useAgents";
import { useHealth } from "../hooks/useHealth";
import { useTheme } from "../hooks/useTheme";
import { BrandMark, StatusDot } from "../components/Sidebar";
import { AGENT_ICONS } from "../components/ChatWelcome";
import { LiveDemo } from "../components/landing/LiveDemo";
import type { ApiInfo, Stats } from "../types";

/* ----------------------------------------------------------------------------
 * Small building blocks
 * ------------------------------------------------------------------------- */

const SECTIONS = [
  { id: "features", label: "Features" },
  { id: "agents", label: "Agents" },
  { id: "how", label: "How it works" },
  { id: "developers", label: "Developers" },
  { id: "faq", label: "FAQ" },
];

// Hash routing owns the URL fragment, so in-page links scroll instead of navigating.
function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-text)]">{children}</div>;
}

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-3 text-[34px] font-semibold leading-[1.15] tracking-tight max-md:text-[27px]">{title}</h2>
      {body && <p className="mt-4 text-[16px] leading-relaxed text-[var(--text-dim)] max-md:text-[15px]">{body}</p>}
    </div>
  );
}

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function PrimaryLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="brand-gradient inline-flex h-11 items-center gap-2 rounded-xl px-5 text-[14.5px] font-semibold text-white shadow-[0_10px_30px_-10px_var(--accent)] transition-transform hover:-translate-y-px"
    >
      {children}
    </Link>
  );
}

function SecondaryLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-5 text-[14.5px] font-semibold transition-colors hover:border-[var(--accent)]"
    >
      {children}
    </Link>
  );
}

/* ----------------------------------------------------------------------------
 * Navigation
 * ------------------------------------------------------------------------- */

function Nav() {
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = (id: string) => {
    setOpen(false);
    scrollToSection(id);
  };

  return (
    <header
      className={`sticky top-0 z-40 transition-colors ${
        scrolled || open ? "border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] backdrop-blur-lg" : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1180px] items-center gap-6 px-6 max-md:px-4">
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-2.5" aria-label="PayPilot home">
          <BrandMark size={30} />
          <span className="text-[16px] font-semibold tracking-tight">PayPilot</span>
        </button>

        <nav aria-label="Sections" className="flex items-center gap-1 max-md:hidden">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(s.id)}
              className="rounded-lg px-3 py-2 text-[13.5px] font-medium text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
            >
              {s.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            className="grid h-9 w-9 place-items-center rounded-lg text-[var(--text-dim)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <Link
            to="/app"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--text)] px-3.5 text-[13px] font-semibold text-[var(--bg)] transition-opacity hover:opacity-90 max-sm:hidden"
          >
            Open console <ArrowRight size={14} />
          </Link>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="grid h-9 w-9 place-items-center rounded-lg text-[var(--text-dim)] hover:bg-[var(--surface-3)] md:hidden"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <nav aria-label="Sections" className="border-t border-[var(--border)] px-4 pb-4 pt-2 md:hidden">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(s.id)}
              className="block w-full rounded-lg px-3 py-3 text-left text-[15px] font-medium text-[var(--text-dim)] hover:bg-[var(--surface-3)]"
            >
              {s.label}
            </button>
          ))}
          <Link to="/app" className="brand-gradient mt-2 flex h-11 items-center justify-center gap-2 rounded-xl text-[14.5px] font-semibold text-white">
            Open console <ArrowRight size={15} />
          </Link>
        </nav>
      )}
    </header>
  );
}

/* ----------------------------------------------------------------------------
 * Hero
 * ------------------------------------------------------------------------- */

function StatusBadge({ info }: { info: ApiInfo | null }) {
  const online = useHealth(30000);
  const label =
    online === null ? "Connecting to the API…"
    : !online ? "API is waking up"
    : info ? `v${info.version} live${info.llm_enabled ? " · AI replies on" : ""}`
    : "API online";
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] py-1 pl-2.5 pr-3 text-[12.5px] font-medium text-[var(--text-dim)] shadow-[var(--shadow-sm)]">
      <StatusDot online={online} />
      {label}
    </span>
  );
}

function Hero({ info }: { info: ApiInfo | null }) {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_20%_0%,color-mix(in_srgb,var(--accent)_16%,transparent),transparent),radial-gradient(40%_40%_at_100%_10%,color-mix(in_srgb,var(--accent-2)_14%,transparent),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35] [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]"
      />
      <div className="mx-auto grid max-w-[1180px] grid-cols-[1.05fr_1fr] items-center gap-14 px-6 pb-20 pt-16 max-lg:grid-cols-1 max-lg:gap-12 max-md:px-4 max-md:pb-14 max-md:pt-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <StatusBadge info={info} />
          <h1 className="mt-6 text-[56px] font-semibold leading-[1.04] tracking-[-0.03em] max-lg:text-[48px] max-md:text-[38px]">
            Payment questions,
            <br />
            <span className="bg-[linear-gradient(135deg,var(--accent),var(--accent-2))] bg-clip-text text-transparent">answered by specialists.</span>
          </h1>
          <p className="mt-6 max-w-[540px] text-[17px] leading-relaxed text-[var(--text-dim)] max-md:text-[15.5px]">
            PayPilot is an AI operations assistant for payments teams. Ask in plain English and it routes your question to the
            right agent, checks live Razorpay data and your policy docs, and answers with the evidence attached.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <PrimaryLink to="/app/chat">
              Start a conversation <ArrowRight size={16} />
            </PrimaryLink>
            <SecondaryLink to="/app">View the dashboard</SecondaryLink>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-[var(--text-muted)]">
            {["Payments, refunds, fraud and reconciliation", "Answers stream in real time", "Every answer shows its sources"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check size={14} className="text-[var(--ok)]" /> {t}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.1 }}>
          <LiveDemo />
        </motion.div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------
 * Live numbers (all from the API; hidden when the API can't be reached)
 * ------------------------------------------------------------------------- */

function formatUptime(s: number) {
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86400)} d`;
}

function LiveNumbers({ info, stats, agentCount }: { info: ApiInfo | null; stats: Stats | null; agentCount: number | null }) {
  const items: { label: string; value: string; hint: string }[] = [];
  if (stats) items.push({ label: "Questions answered", value: stats.total.toLocaleString(), hint: stats.last_24h != null ? `${stats.last_24h} in the last 24 hours` : "since the last restart" });
  if (agentCount != null) items.push({ label: "Specialist agents", value: String(agentCount), hint: "plus a router that picks between them" });
  if (stats?.avg_latency_ms != null) items.push({ label: "Average answer time", value: `${(stats.avg_latency_ms / 1000).toFixed(1)}s`, hint: "measured on this server" });
  if (info) items.push({ label: "Payment data", value: info.razorpay_mode === "live" ? "Live" : "Sandbox", hint: info.razorpay_mode === "live" ? "connected to Razorpay" : "deterministic test data" });
  if (info && items.length < 4) items.push({ label: "Uptime", value: formatUptime(info.uptime_s), hint: `${info.environment} · v${info.version}` });

  if (!items.length) return null;
  return (
    <section aria-label="Live numbers from this server" className="border-y border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto grid max-w-[1180px] grid-cols-4 divide-x divide-[var(--border)] px-6 max-lg:grid-cols-2 max-lg:divide-x-0 max-md:px-4">
        {items.slice(0, 4).map((it) => (
          <div key={it.label} className="px-6 py-7 first:pl-0 max-lg:px-0 max-lg:py-5">
            <div className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              <Radio size={12} className="text-[var(--ok)]" aria-hidden /> {it.label}
            </div>
            <div className="mt-2 text-[30px] font-semibold tabular-nums tracking-tight">{it.value}</div>
            <div className="mt-0.5 text-[12.5px] text-[var(--text-muted)]">{it.hint}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------
 * Features
 * ------------------------------------------------------------------------- */

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Workflow, title: "Smart routing", body: "A router reads each question and hands it to the payments, refunds, reconciliation, fraud or general agent, so you never pick a tool yourself." },
  { icon: Gauge, title: "Live payment data", body: "Agents call Razorpay through typed tools to fetch payment status, refunds and settlements. Without keys they fall back to clearly labelled sandbox data." },
  { icon: BookOpenText, title: "Grounded in your policies", body: "Each answer is checked against your refund, payment and reconciliation policy docs, and the passage it relied on is shown next to the reply." },
  { icon: ShieldCheck, title: "Fraud scoring", body: "A rule-based risk score looks at amount, international cards and CVV checks, then explains which signals pushed a payment into review." },
  { icon: History, title: "Conversation memory", body: "Follow-ups like “and its refund?” remember the payment you were talking about. Every conversation is saved and can be reopened later." },
  { icon: Sparkles, title: "Streaming answers", body: "Watch the agent route, look up data and write its reply in real time, with every step visible instead of a spinner." },
];

function Features() {
  return (
    <section id="features" className="scroll-mt-20 py-24 max-md:py-16">
      <div className="mx-auto max-w-[1180px] px-6 max-md:px-4">
        <SectionHeading
          eyebrow="Features"
          title="Everything a payments ops desk asks, in one place"
          body="Stop jumping between the Razorpay dashboard, a policy wiki and a spreadsheet. PayPilot pulls them together and explains the answer."
        />
        <div className="mt-14 grid grid-cols-3 gap-5 max-lg:grid-cols-2 max-sm:grid-cols-1">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.05}>
              <div className="group h-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-md)]">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)]">
                  <f.icon size={19} />
                </div>
                <h3 className="mt-5 text-[16px] font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-dim)]">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------
 * Agents (from /api/agents)
 * ------------------------------------------------------------------------- */

function Agents() {
  const { agents, error, retry } = useAgentsState();
  return (
    <section id="agents" className="scroll-mt-20 border-y border-[var(--border)] bg-[var(--surface-2)] py-24 max-md:py-16">
      <div className="mx-auto max-w-[1180px] px-6 max-md:px-4">
        <SectionHeading
          eyebrow="The team"
          title="Five agents, each with one job"
          body="These are the agents running on this server right now. Click any example to ask it yourself."
        />
        {error && !agents ? (
          <div className="mt-10 text-center text-[14px] text-[var(--text-muted)]">
            Couldn't load the agents from the API.{" "}
            <button type="button" onClick={retry} className="font-medium text-[var(--accent-text)] hover:underline">
              Try again
            </button>
          </div>
        ) : (
          <div className="mt-14 grid grid-cols-3 gap-5 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {(agents ?? Array.from({ length: 5 }, () => null)).map((agent, i) =>
              agent ? (
                <Reveal key={agent.id} delay={i * 0.05} className={i === 0 ? "lg:col-span-1" : ""}>
                  <AgentCard {...agent} icon={AGENT_ICONS[agent.id] ?? Bot} />
                </Reveal>
              ) : (
                <div key={i} className="skeleton h-[220px] rounded-2xl" />
              ),
            )}
            {agents && (
              <Reveal delay={0.25}>
                <div className="flex h-full flex-col justify-center rounded-2xl border border-dashed border-[var(--border-strong)] p-6">
                  <GitBranch size={20} className="text-[var(--accent-text)]" />
                  <h3 className="mt-4 text-[16px] font-semibold">Plus a router</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-dim)]">
                    Classifies every question by intent and extracts IDs like <code className="inline-code">pay_…</code> and{" "}
                    <code className="inline-code">stl_…</code> before any agent runs.
                  </p>
                </div>
              </Reveal>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function AgentCard({ label, color, description, example, tools, icon: Icon }: { label: string; color: string; description: string; example: string; tools?: string[]; icon: LucideIcon }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>
          <Icon size={19} />
        </div>
        <h3 className="text-[16px] font-semibold tracking-tight">{label}</h3>
      </div>
      <p className="mt-4 flex-1 text-[14px] leading-relaxed text-[var(--text-dim)]">{description}</p>
      {tools && tools.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {tools.map((t) => (
            <code key={t} className="inline-code">
              {t}
            </code>
          ))}
        </div>
      )}
      <Link
        to={`/app/chat?q=${encodeURIComponent(example)}`}
        className="mt-5 flex items-center justify-between gap-2 rounded-xl bg-[var(--surface-3)] px-3.5 py-2.5 text-[13px] text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
      >
        <span className="truncate">“{example}”</span>
        <ArrowRight size={14} className="shrink-0" />
      </Link>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * How it works
 * ------------------------------------------------------------------------- */

const STEPS = [
  { n: "01", title: "Ask in plain English", body: "Type a question the way you'd ask a colleague. Mention a payment or settlement ID if you have one." },
  { n: "02", title: "PayPilot routes and looks up", body: "The router picks a specialist, which fetches live data through its tools and pulls the relevant policy passages." },
  { n: "03", title: "Get an answer with evidence", body: "The reply streams in with the agent's name, the raw tool data and the policy text it relied on, ready to check." },
];

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 py-24 max-md:py-16">
      <div className="mx-auto max-w-[1180px] px-6 max-md:px-4">
        <SectionHeading eyebrow="How it works" title="From question to verified answer in seconds" />
        <ol className="relative mt-14 grid grid-cols-3 gap-6 max-lg:grid-cols-1">
          <div aria-hidden className="absolute left-[16%] right-[16%] top-6 h-px bg-[linear-gradient(90deg,transparent,var(--border-strong),transparent)] max-lg:hidden" />
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.08}>
              <li className="relative text-center max-lg:text-left">
                <div className="brand-gradient relative mx-auto grid h-12 w-12 place-items-center rounded-2xl text-[14px] font-semibold text-white shadow-[0_10px_30px_-12px_var(--accent)] max-lg:mx-0">
                  {s.n}
                </div>
                <h3 className="mt-5 text-[17px] font-semibold tracking-tight">{s.title}</h3>
                <p className="mx-auto mt-2 max-w-[320px] text-[14px] leading-relaxed text-[var(--text-dim)] max-lg:mx-0 max-lg:max-w-none">{s.body}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------
 * Developers
 * ------------------------------------------------------------------------- */

type Lang = "curl" | "js" | "python";

function snippets(origin: string, needsKey: boolean): Record<Lang, string> {
  const keyCurl = needsKey ? ` \\\n  -H "X-API-Key: $PAYPILOT_KEY"` : "";
  const keyJs = needsKey ? `,\n    "X-API-Key": process.env.PAYPILOT_KEY` : "";
  const keyPy = needsKey ? `, "X-API-Key": os.environ["PAYPILOT_KEY"]` : "";
  return {
    curl: `curl ${origin}/chat \\
  -H "Content-Type: application/json"${keyCurl} \\
  -d '{"message": "Why did payment pay_XYZ789 fail?"}'`,
    js: `const res = await fetch("${origin}/chat", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"${keyJs}
  },
  body: JSON.stringify({ message: "Where is my refund for pay_ABC123?" }),
});
const { reply, agent_used, session_id } = await res.json();`,
    python: `import os, requests

r = requests.post(
    "${origin}/chat",
    headers={"Content-Type": "application/json"${keyPy}},
    json={"message": "Does settlement stl_44 match our ledger?"},
)
print(r.json()["reply"])`,
  };
}

function Developers({ info }: { info: ApiInfo | null }) {
  const [lang, setLang] = useState<Lang>("curl");
  const [copied, setCopied] = useState(false);
  const origin = (import.meta.env.VITE_API_URL as string | undefined) || window.location.origin;
  const code = snippets(origin, !!info?.auth_required)[lang];

  return (
    <section id="developers" className="scroll-mt-20 border-y border-[var(--border)] bg-[var(--surface-2)] py-24 max-md:py-16">
      <div className="mx-auto grid max-w-[1180px] grid-cols-[1fr_1.15fr] items-center gap-14 px-6 max-lg:grid-cols-1 max-md:px-4">
        <div>
          <Eyebrow>Developers</Eyebrow>
          <h2 className="mt-3 text-[34px] font-semibold leading-[1.15] tracking-tight max-md:text-[27px]">A clean REST API behind every screen</h2>
          <p className="mt-4 text-[16px] leading-relaxed text-[var(--text-dim)]">
            Everything in the console is built on a public, documented API. Plug PayPilot into your support desk, Slack bot or
            internal tools.
          </p>
          <ul className="mt-7 space-y-3.5 text-[14px]">
            {[
              { icon: Sparkles, text: <><code className="inline-code">POST /chat/stream</code> streams agent steps and tokens as server-sent events</> },
              { icon: History, text: <><code className="inline-code">/api/conversations</code> lists, reopens and deletes saved chats</> },
              { icon: KeyRound, text: <>API keys via <code className="inline-code">X-API-Key</code>, per-client rate limits and request IDs on every response</> },
            ].map((item, i) => (
              <li key={i} className="flex gap-3">
                <item.icon size={17} className="mt-0.5 shrink-0 text-[var(--accent-text)]" />
                <span className="leading-relaxed text-[var(--text-dim)]">{item.text}</span>
              </li>
            ))}
          </ul>
          <a
            href={`${origin}/docs`}
            target="_blank"
            rel="noreferrer"
            className="mt-8 inline-flex items-center gap-1.5 text-[14px] font-semibold text-[var(--accent-text)] hover:underline"
          >
            Open the interactive API reference <ArrowRight size={15} />
          </a>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#262a36] bg-[#0d0f15] shadow-[var(--shadow-md)]">
          <div className="flex items-center gap-1 border-b border-[#262a36] px-2 py-2">
            {(["curl", "js", "python"] as Lang[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                className={`rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors ${lang === l ? "bg-[#1d2130] text-white" : "text-[#8a8fa3] hover:text-white"}`}
              >
                {l === "curl" ? "cURL" : l === "js" ? "JavaScript" : "Python"}
              </button>
            ))}
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); })}
              className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] text-[#8a8fa3] hover:text-white"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="overflow-x-auto p-5 text-[13px] leading-[1.7] text-[#e3e6ef]">
            <code>{code}</code>
          </pre>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------
 * FAQ + CTA + footer
 * ------------------------------------------------------------------------- */

function Faq({ info }: { info: ApiInfo | null }) {
  const items = [
    {
      q: "Is the data real?",
      a: info?.razorpay_mode === "live"
        ? "Yes. This server is connected to Razorpay, so payment, refund and settlement lookups return real records from the connected account."
        : "This server isn't connected to a Razorpay account yet, so lookups return deterministic sandbox records and are labelled “Demo”. Add Razorpay keys and the same questions return live data.",
    },
    {
      q: "Who writes the answers?",
      a: info?.llm_enabled
        ? `Answers are written by ${info.llm_model ?? "an LLM"} from the tool data and policy passages, then streamed to you. The raw data is always shown so you can verify it.`
        : "Answers are built from the tool data and your policy passages. When an LLM key is configured on the server, a model writes them in natural language from the same evidence.",
    },
    { q: "Does it remember earlier questions?", a: "Yes. Each conversation is saved on the server, so follow-ups keep their context and you can reopen any chat from History in the console." },
    {
      q: "How is access controlled?",
      a: info?.auth_required
        ? "This server requires an API key. Enter it once in the console's Settings and it stays in your browser."
        : "API keys are supported but switched off on this server. When an admin sets keys, every request (including from this site) needs one, and requests are rate limited per client.",
    },
  ];
  return (
    <section id="faq" className="scroll-mt-20 py-24 max-md:py-16">
      <div className="mx-auto max-w-[760px] px-6 max-md:px-4">
        <SectionHeading eyebrow="FAQ" title="Questions, answered" />
        <div className="mt-12 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          {items.map((it) => (
            <details key={it.q} className="group px-6 py-5 max-md:px-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
                {it.q}
                <ChevronDown size={17} className="shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--text-dim)]">{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="px-6 pb-24 max-md:px-4 max-md:pb-16">
      <div className="brand-gradient relative mx-auto max-w-[1180px] overflow-hidden rounded-3xl px-10 py-16 text-center text-white max-md:px-6 max-md:py-12">
        <div aria-hidden className="absolute inset-0 opacity-20 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="relative">
          <h2 className="text-[34px] font-semibold tracking-tight max-md:text-[26px]">Ask your first question</h2>
          <p className="mx-auto mt-3 max-w-lg text-[16px] text-white/85">No setup needed. Open the console and ask about any payment, refund or settlement.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/app/chat" className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-[14.5px] font-semibold text-[#2d2580] transition-transform hover:-translate-y-px">
              Open chat <ArrowRight size={16} />
            </Link>
            <Link to="/app" className="inline-flex h-11 items-center rounded-xl border border-white/40 px-5 text-[14.5px] font-semibold text-white hover:bg-white/10">
              See the dashboard
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer({ info }: { info: ApiInfo | null }) {
  const origin = (import.meta.env.VITE_API_URL as string | undefined) || window.location.origin;
  return (
    <footer className="border-t border-[var(--border)]">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-6 px-6 py-10 max-md:px-4">
        <div className="flex items-center gap-2.5">
          <BrandMark size={26} />
          <div>
            <div className="text-[14px] font-semibold">PayPilot</div>
            <div className="text-[12px] text-[var(--text-muted)]">AI operations for payments teams{info ? ` · v${info.version}` : ""}</div>
          </div>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-[var(--text-dim)]">
          <Link to="/app" className="hover:text-[var(--text)]">Dashboard</Link>
          <Link to="/app/chat" className="hover:text-[var(--text)]">Chat</Link>
          <Link to="/app/agents" className="hover:text-[var(--text)]">Agents</Link>
          <a href={`${origin}/docs`} target="_blank" rel="noreferrer" className="hover:text-[var(--text)]">API reference</a>
          <a href="https://github.com/aryan2006-singh/paypilot" target="_blank" rel="noreferrer" className="hover:text-[var(--text)]">GitHub</a>
        </nav>
      </div>
    </footer>
  );
}

/* ----------------------------------------------------------------------------
 * Page
 * ------------------------------------------------------------------------- */

export function Landing() {
  const info = useAsync(api.info, { pollMs: 60000 });
  // Stats need a key when auth is on; the section simply hides if they fail.
  const stats = useAsync(api.stats, { pollMs: 30000 });
  const { agents } = useAgentsState();

  useEffect(() => {
    document.title = "PayPilot · AI operations for payments teams";
    return () => {
      document.title = "PayPilot · Payments Ops Console";
    };
  }, []);

  return (
    <div className="min-h-dvh">
      <a
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          scrollToSection("features");
        }}
        className="fixed left-3 top-3 z-50 -translate-y-20 rounded-lg bg-[var(--surface)] px-3 py-2 text-[13px] font-medium shadow-[var(--shadow-md)] focus:translate-y-0"
      >
        Skip to content
      </a>
      <Nav />
      <main>
        <Hero info={info.data} />
        <LiveNumbers info={info.data} stats={stats.error ? null : stats.data} agentCount={agents?.length ?? null} />
        <Features />
        <Agents />
        <HowItWorks />
        <Developers info={info.data} />
        <Faq info={info.data} />
        <FinalCta />
      </main>
      <Footer info={info.data} />
    </div>
  );
}
