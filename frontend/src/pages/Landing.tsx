import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Bot,
  BookOpenText,
  Check,
  Copy,
  Gauge,
  GitBranch,
  History,
  KeyRound,
  Menu,
  Plus,
  ShieldCheck,
  Sparkles,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import { api } from "../api";
import { useAsync } from "../hooks/useAsync";
import { useAgentsState } from "../hooks/useAgents";
import { useHealth } from "../hooks/useHealth";
import { StatusDot, Wordmark } from "../components/Sidebar";
import { AGENT_ICONS } from "../components/ChatWelcome";
import { LiveDemo } from "../components/landing/LiveDemo";
import type { ApiInfo, Stats } from "../types";

/* ----------------------------------------------------------------------------
 * Building blocks
 * ------------------------------------------------------------------------- */

const SECTIONS = [
  { id: "features", label: "Features" },
  { id: "agents", label: "Agents" },
  { id: "how", label: "How it works" },
  { id: "developers", label: "Developers" },
  { id: "faq", label: "FAQ" },
];

const WRAP = "mx-auto w-full max-w-[1280px] px-8 max-md:px-4";

// Hash routing owns the URL fragment, so in-page links scroll instead of navigating.
function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-display flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
      <span aria-hidden className="h-2 w-2 bg-[var(--accent)]" />
      {children}
    </div>
  );
}

function SectionTitle({ eyebrow, title, body, className = "" }: { eyebrow: string; title: React.ReactNode; body?: string; className?: string }) {
  return (
    <div className={className}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-5 max-w-[900px] text-[56px] font-bold leading-[1.02] tracking-[-0.025em] max-lg:text-[44px] max-md:text-[34px]">{title}</h2>
      {body && <p className="mt-5 max-w-[620px] text-[17px] leading-relaxed text-[var(--text-dim)] max-md:text-[15.5px]">{body}</p>}
    </div>
  );
}

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: [0.2, 0.7, 0.2, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const BTN = "font-display inline-flex h-12 items-center gap-2.5 px-6 text-[13.5px] font-bold uppercase tracking-[0.06em] transition-all";

function PrimaryLink({ to, children, className = "" }: { to: string; children: React.ReactNode; className?: string }) {
  return (
    <Link to={to} className={`${BTN} bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-2)] hover:shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_25%,transparent)] ${className}`}>
      {children}
    </Link>
  );
}

function SecondaryLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className={`${BTN} border border-[var(--border-strong)] text-[var(--text)] hover:border-[var(--text)]`}>
      {children}
    </Link>
  );
}

/* ----------------------------------------------------------------------------
 * Navigation
 * ------------------------------------------------------------------------- */

function Nav() {
  const [open, setOpen] = useState(false);
  const go = (id: string) => {
    setOpen(false);
    scrollToSection(id);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_86%,transparent)] backdrop-blur-lg">
      <div className={`${WRAP} flex h-[76px] items-center gap-8 max-md:h-16`}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="grid h-10 w-10 place-items-center text-[var(--text)] lg:hidden"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="PayPilot home">
          <Wordmark className="text-[24px] max-md:text-[20px]" />
        </button>

        <nav aria-label="Sections" className="flex items-center gap-1 max-lg:hidden">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(s.id)}
              className="font-display px-3 py-2 text-[12.5px] font-bold uppercase tracking-[0.08em] text-[var(--text-dim)] transition-colors hover:text-[var(--accent)]"
            >
              {s.label}
            </button>
          ))}
        </nav>

        <Link
          to="/app"
          className="font-display ml-auto inline-flex h-11 items-center gap-2 bg-[var(--accent)] px-5 text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--on-accent)] transition-colors hover:bg-[var(--accent-2)] max-md:h-10 max-md:px-4 max-md:text-[12px]"
        >
          Open console
        </Link>
      </div>

      {open && (
        <nav aria-label="Sections" className="border-t border-[var(--border)] px-4 pb-5 pt-2 lg:hidden">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(s.id)}
              className="font-display flex w-full items-center justify-between border-b border-[var(--border)] py-4 text-left text-[20px] font-bold uppercase"
            >
              {s.label} <ArrowRight size={18} className="text-[var(--accent)]" />
            </button>
          ))}
        </nav>
      )}
    </header>
  );
}

/* ----------------------------------------------------------------------------
 * Hero: giant wordmark, rotating badge, live demo
 * ------------------------------------------------------------------------- */

function StatusBadge({ info }: { info: ApiInfo | null }) {
  const online = useHealth(30000);
  const label =
    online === null ? "Connecting to the API…"
    : !online ? "API is waking up"
    : info ? `v${info.version} live${info.llm_enabled ? " · AI replies on" : ""}`
    : "API online";
  return (
    <span className="font-display inline-flex items-center gap-2 border border-[var(--border-strong)] px-3 py-1.5 text-[11.5px] font-bold uppercase tracking-[0.08em] text-[var(--text-dim)]">
      <StatusDot online={online} />
      {label}
    </span>
  );
}

/** A circular, slowly spinning stamp that sits on the wordmark. */
function SpinBadge({ agentCount }: { agentCount: number | null }) {
  const text = `${agentCount ?? 5} specialist agents · one router · live answers · `;
  return (
    <div className="relative grid h-[168px] w-[168px] place-items-center max-lg:h-[120px] max-lg:w-[120px] max-md:h-[80px] max-md:w-[80px]">
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full animate-[spin_18s_linear_infinite]" aria-hidden>
        <defs>
          <path id="pp-circle" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
        </defs>
        <circle cx="100" cy="100" r="99" fill="var(--accent)" />
        <text fontFamily="Space Grotesk, sans-serif" fontWeight="700" fontSize="15.5" letterSpacing="1.5" fill="#141414">
          <textPath href="#pp-circle">{text.toUpperCase()}</textPath>
        </text>
      </svg>
      <div className="relative grid h-[44%] w-[44%] place-items-center rounded-full bg-[#141414] text-[var(--accent)]">
        <Sparkles className="h-[46%] w-[46%]" aria-hidden />
      </div>
    </div>
  );
}

function Hero({ info, agentCount }: { info: ApiInfo | null; agentCount: number | null }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const wordY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -120]);
  const badgeRotate = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 90]);

  return (
    <section ref={ref} className="relative overflow-hidden">
      <div aria-hidden className="grid-lines pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(80%_70%_at_50%_10%,black,transparent)]" />
      <div className={`${WRAP} pt-14 max-md:pt-8`}>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-wrap items-start justify-between gap-6">
          <p className="max-w-[560px] text-[20px] leading-snug text-[var(--text-dim)] max-md:text-[16.5px]">
            Ask any payment question in plain English. PayPilot routes it to the right agent, checks live data and your
            policies, and answers with the evidence attached.
          </p>
          <StatusBadge info={info} />
        </motion.div>

        <motion.div style={{ y: wordY }} className="relative mt-10 max-md:mt-8">
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }}
            className="select-none text-[clamp(64px,16.6vw,232px)] font-bold uppercase leading-[0.82] tracking-[-0.045em]"
          >
            PayPilot<span className="text-[var(--accent)]">.</span>
            <span className="sr-only"> AI operations for payments teams</span>
          </motion.h1>
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
            style={{ rotate: badgeRotate }}
            className="absolute -top-[9%] right-[2%] max-md:-top-[105%] max-md:right-0"
          >
            <SpinBadge agentCount={agentCount} />
          </motion.div>
        </motion.div>
      </div>

      <div className={`${WRAP} grid grid-cols-[1fr_1.1fr] items-end gap-16 pb-24 pt-16 max-lg:grid-cols-1 max-lg:gap-12 max-md:pb-16 max-md:pt-10`}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.25 }}>
          <h2 className="text-[44px] font-bold leading-[1.02] tracking-[-0.02em] max-md:text-[32px]">
            Payment ops,
            <br />
            <span className="text-[var(--accent)]">on autopilot.</span>
          </h2>
          <ul className="mt-7 space-y-3 text-[15px] text-[var(--text-dim)]">
            {["Payments, refunds, fraud and reconciliation", "Answers stream in real time", "Every answer shows its sources"].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="grid h-5 w-5 shrink-0 place-items-center bg-[var(--accent)] text-[var(--on-accent)]">
                  <Check size={13} strokeWidth={3} />
                </span>
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-9 flex flex-wrap gap-3">
            <PrimaryLink to="/app/chat">
              Start a conversation <ArrowRight size={16} />
            </PrimaryLink>
            <SecondaryLink to="/app">View dashboard</SecondaryLink>
          </div>
          <button
            type="button"
            onClick={() => scrollToSection("numbers")}
            className="font-display mt-14 inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)] hover:text-[var(--text)] max-lg:hidden"
          >
            <ArrowDown size={15} className="animate-bounce" /> Scroll down
          </button>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.35 }}>
          <LiveDemo />
        </motion.div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------
 * Lime marquee band
 * ------------------------------------------------------------------------- */

const MARQUEE = ["Failed payments", "Refund status", "Settlement reconciliation", "Fraud scoring", "Policy answers", "Conversation memory"];

function Marquee() {
  const row = [...MARQUEE, ...MARQUEE];
  return (
    <div aria-hidden className="overflow-hidden border-y border-[var(--accent)] bg-[var(--accent)] py-4 text-[var(--on-accent)]">
      <div className="marquee flex w-max">
        {[0, 1].map((k) => (
          <div key={k} className="flex shrink-0">
            {row.map((t, i) => (
              <span key={`${k}-${i}`} className="font-display flex items-center gap-8 px-4 text-[22px] font-bold uppercase tracking-[-0.01em] max-md:text-[17px]">
                {t} <Plus size={18} strokeWidth={3} />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Statement + live numbers (all from the API; hidden when unreachable)
 * ------------------------------------------------------------------------- */

function formatUptime(s: number) {
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86400)} d`;
}

function Numbers({ info, stats, agentCount }: { info: ApiInfo | null; stats: Stats | null; agentCount: number | null }) {
  const items: { label: string; value: string; hint: string }[] = [];
  if (stats) items.push({ label: "Questions answered", value: stats.total.toLocaleString(), hint: stats.last_24h != null ? `${stats.last_24h} in the last 24 hours` : "since the last restart" });
  if (agentCount != null) items.push({ label: "Specialist agents", value: String(agentCount), hint: "plus a router that picks between them" });
  if (stats?.avg_latency_ms != null) items.push({ label: "Average answer time", value: `${(stats.avg_latency_ms / 1000).toFixed(1)}s`, hint: "measured on this server" });
  if (info) items.push({ label: "Payment data", value: info.razorpay_mode === "live" ? "Live" : "Sandbox", hint: info.razorpay_mode === "live" ? "connected to Razorpay" : "deterministic test data" });
  if (info && items.length < 4) items.push({ label: "Uptime", value: formatUptime(info.uptime_s), hint: `${info.environment} · v${info.version}` });

  return (
    <section id="numbers" className="scroll-mt-20 py-32 max-md:py-20">
      <div className={WRAP}>
        <Reveal>
          <SectionTitle
            eyebrow="Payments ops, anywhere"
            title={
              <>
                Every payment question,{" "}
                <span className="text-[var(--accent)]">answered with evidence.</span>
              </>
            }
            body="Stop jumping between the Razorpay dashboard, a policy wiki and a spreadsheet. PayPilot pulls them together, explains the answer and shows the data it used."
          />
        </Reveal>

        {items.length > 0 && (
          <div className="mt-20 grid grid-cols-4 gap-5 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {items.slice(0, 4).map((it, i) => (
              <Reveal key={it.label} delay={i * 0.08}>
                <div className="flex h-full min-h-[200px] flex-col justify-between bg-white p-7 text-[#141414] transition-transform hover:-translate-y-1 max-md:min-h-[160px]">
                  <div className="font-display flex items-center justify-between text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#5b6160]">
                    {it.label}
                    <span aria-hidden className="h-2.5 w-2.5 bg-[#9ef500]" />
                  </div>
                  <div>
                    <div className="font-display text-[52px] font-bold leading-none tracking-[-0.03em] tabular-nums max-md:text-[44px]">{it.value}</div>
                    <div className="mt-2 text-[13.5px] text-[#5b6160]">{it.hint}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------
 * Features (ruled grid)
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
    <section id="features" className="scroll-mt-20 border-t border-[var(--border)] py-32 max-md:py-20">
      <div className={WRAP}>
        <Reveal>
          <SectionTitle eyebrow="Features" title="Everything a payments desk asks, in one place." />
        </Reveal>
        <div className="mt-16 grid grid-cols-3 border-l border-t border-[var(--border)] max-lg:grid-cols-2 max-sm:grid-cols-1">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 0.07} className="border-b border-r border-[var(--border)]">
              <div className="group relative h-full p-9 transition-colors hover:bg-[var(--surface)] max-md:p-6">
                <div className="flex items-start justify-between">
                  <div className="grid h-14 w-14 place-items-center rounded-full bg-[var(--surface-3)] text-[var(--accent)] transition-colors group-hover:bg-[var(--accent)] group-hover:text-[var(--on-accent)]">
                    <f.icon size={22} />
                  </div>
                  <span className="font-mono text-[12px] text-[var(--text-muted)]">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mt-10 text-[24px] font-bold tracking-[-0.01em]">{f.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-dim)]">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------
 * Agents (from /api/agents), shown as an icon grid
 * ------------------------------------------------------------------------- */

function Agents() {
  const { agents, error, retry } = useAgentsState();
  return (
    <section id="agents" className="scroll-mt-20 border-t border-[var(--border)] py-32 max-md:py-20">
      <div className={WRAP}>
        <Reveal>
          <SectionTitle
            eyebrow="The team"
            title={
              <>
                Five agents. <span className="text-[var(--accent)]">One job each.</span>
              </>
            }
            body="These are the agents running on this server right now. Pick one to ask it a question."
          />
        </Reveal>
        {error && !agents ? (
          <div className="mt-12 text-[15px] text-[var(--text-muted)]">
            Couldn't load the agents from the API.{" "}
            <button type="button" onClick={retry} className="font-medium text-[var(--accent)] hover:underline">
              Try again
            </button>
          </div>
        ) : (
          <div className="mt-16 grid grid-cols-3 gap-px bg-[var(--border)] max-lg:grid-cols-2 max-sm:grid-cols-1">
            {(agents ?? Array.from({ length: 5 }, () => null)).map((agent, i) =>
              agent ? (
                <Reveal key={agent.id} delay={(i % 3) * 0.07} className="bg-[var(--bg)]">
                  <AgentTile {...agent} icon={AGENT_ICONS[agent.id] ?? Bot} />
                </Reveal>
              ) : (
                <div key={i} className="bg-[var(--bg)] p-8">
                  <div className="skeleton h-[200px]" />
                </div>
              ),
            )}
            {agents && (
              <Reveal delay={0.14} className="bg-[var(--bg)]">
                <div className="flex h-full flex-col p-8 max-md:p-6">
                  <div className="grid h-[72px] w-[72px] place-items-center rounded-full border-2 border-dashed border-[var(--border-strong)] text-[var(--accent)]">
                    <GitBranch size={26} />
                  </div>
                  <h3 className="mt-8 text-[24px] font-bold">Plus a router</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-dim)]">
                    Classifies every question by intent and pulls out IDs like <code className="inline-code">pay_…</code> and{" "}
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

function AgentTile({ label, color, description, example, tools, icon: Icon }: { label: string; color: string; description: string; example: string; tools?: string[]; icon: LucideIcon }) {
  return (
    <Link to={`/app/chat?q=${encodeURIComponent(example)}`} className="group flex h-full flex-col p-8 transition-colors hover:bg-[var(--surface)] max-md:p-6">
      <div className="flex items-start justify-between">
        <div
          className="grid h-[72px] w-[72px] place-items-center rounded-full bg-[var(--surface-3)] transition-transform duration-300 group-hover:scale-110"
          style={{ color }}
        >
          <Icon size={28} />
        </div>
        <ArrowUpRight size={22} className="text-[var(--text-muted)] transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
      </div>
      <h3 className="mt-8 text-[24px] font-bold">{label}</h3>
      <p className="mt-3 flex-1 text-[15px] leading-relaxed text-[var(--text-dim)]">{description}</p>
      {tools && tools.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-1.5">
          {tools.map((t) => (
            <code key={t} className="inline-code">
              {t}
            </code>
          ))}
        </div>
      )}
      <div className="mt-6 border-t border-[var(--border)] pt-4 text-[13.5px] text-[var(--text-muted)] transition-colors group-hover:text-[var(--text)]">
        “{example}”
      </div>
    </Link>
  );
}

/* ----------------------------------------------------------------------------
 * How it works (big outlined numerals)
 * ------------------------------------------------------------------------- */

const STEPS = [
  { n: "01", title: "Ask in plain English", body: "Type a question the way you'd ask a colleague. Mention a payment or settlement ID if you have one." },
  { n: "02", title: "PayPilot routes and looks up", body: "The router picks a specialist, which fetches live data through its tools and pulls the relevant policy passages." },
  { n: "03", title: "Get an answer with evidence", body: "The reply streams in with the agent's name, the raw tool data and the policy text it relied on, ready to check." },
];

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 border-t border-[var(--border)] py-32 max-md:py-20">
      <div className={WRAP}>
        <Reveal>
          <SectionTitle eyebrow="How it works" title="From question to verified answer in seconds." />
        </Reveal>
        <ol className="mt-16 grid grid-cols-3 gap-10 max-lg:grid-cols-1 max-lg:gap-12">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.1}>
              <li className="border-t-2 border-[var(--accent)] pt-6">
                <div
                  className="font-display text-[120px] font-bold leading-[0.85] tracking-[-0.04em] text-transparent max-md:text-[88px]"
                  style={{ WebkitTextStroke: "1.5px var(--border-strong)" }}
                >
                  {s.n}
                </div>
                <h3 className="mt-6 text-[26px] font-bold tracking-[-0.01em]">{s.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-dim)]">{s.body}</p>
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
    <section id="developers" className="scroll-mt-20 border-t border-[var(--border)] py-32 max-md:py-20">
      <div className={`${WRAP} grid grid-cols-[1fr_1.15fr] items-center gap-16 max-lg:grid-cols-1`}>
        <Reveal>
          <SectionTitle eyebrow="Developers" title="A clean REST API behind every screen." />
          <p className="mt-5 text-[17px] leading-relaxed text-[var(--text-dim)]">
            Everything in the console is built on a public, documented API. Plug PayPilot into your support desk, Slack bot or
            internal tools.
          </p>
          <ul className="mt-8 space-y-4 text-[15px]">
            {[
              { icon: Sparkles, text: <><code className="inline-code">POST /chat/stream</code> streams agent steps and tokens as server-sent events</> },
              { icon: History, text: <><code className="inline-code">/api/conversations</code> lists, reopens and deletes saved chats</> },
              { icon: KeyRound, text: <>API keys via <code className="inline-code">X-API-Key</code>, per-client rate limits and request IDs on every response</> },
            ].map((item, i) => (
              <li key={i} className="flex gap-3">
                <item.icon size={18} className="mt-0.5 shrink-0 text-[var(--accent)]" />
                <span className="leading-relaxed text-[var(--text-dim)]">{item.text}</span>
              </li>
            ))}
          </ul>
          <a
            href={`${origin}/api/docs`}
            target="_blank"
            rel="noreferrer"
            className="font-display mt-9 inline-flex items-center gap-2 border-b-2 border-[var(--accent)] pb-1 text-[13.5px] font-bold uppercase tracking-[0.06em] hover:text-[var(--accent)]"
          >
            Open the API reference <ArrowUpRight size={16} />
          </a>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="overflow-hidden border border-[var(--border-strong)] bg-[#0c0c0c]">
            <div className="flex items-center gap-1 border-b border-[var(--border)] px-2 py-2">
              {(["curl", "js", "python"] as Lang[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  aria-pressed={lang === l}
                  className={`font-display px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.06em] transition-colors ${lang === l ? "bg-[var(--accent)] text-[var(--on-accent)]" : "text-[var(--text-muted)] hover:text-white"}`}
                >
                  {l === "curl" ? "cURL" : l === "js" ? "JavaScript" : "Python"}
                </button>
              ))}
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); })}
                className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-[var(--text-muted)] hover:text-white"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="overflow-x-auto p-6 text-[13px] leading-[1.75] text-[#e8ece9]">
              <code>{code}</code>
            </pre>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------
 * FAQ, final CTA, footer
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
    <section id="faq" className="scroll-mt-20 border-t border-[var(--border)] py-32 max-md:py-20">
      <div className={`${WRAP} grid grid-cols-[1fr_1.4fr] gap-16 max-lg:grid-cols-1 max-lg:gap-10`}>
        <Reveal>
          <SectionTitle eyebrow="FAQ" title="Questions, answered." />
        </Reveal>
        <div className="border-t border-[var(--border)]">
          {items.map((it) => (
            <details key={it.q} className="group border-b border-[var(--border)] py-7">
              <summary className="font-display flex cursor-pointer list-none items-center justify-between gap-6 text-[21px] font-bold max-md:text-[18px] [&::-webkit-details-marker]:hidden">
                {it.q}
                <span className="grid h-9 w-9 shrink-0 place-items-center border border-[var(--border-strong)] text-[var(--accent)] transition-transform group-open:rotate-45">
                  <Plus size={18} />
                </span>
              </summary>
              <p className="mt-4 max-w-[640px] text-[15.5px] leading-relaxed text-[var(--text-dim)]">{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="border-t border-[var(--border)] py-32 max-md:py-20">
      <div className={`${WRAP} text-center`}>
        <Reveal>
          <h2 className="mx-auto max-w-[1000px] text-[88px] font-bold uppercase leading-[0.92] tracking-[-0.035em] max-lg:text-[64px] max-md:text-[40px]">
            Let's fix your <span className="text-[var(--accent)]">payment ops.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-[17px] text-[var(--text-dim)]">No setup needed. Open the console and ask about any payment, refund or settlement.</p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <PrimaryLink to="/app/chat" className="h-14 px-8 text-[15px]">
              Let's talk <ArrowRight size={18} />
            </PrimaryLink>
            <SecondaryLink to="/app">See the dashboard</SecondaryLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Footer({ info }: { info: ApiInfo | null }) {
  const origin = (import.meta.env.VITE_API_URL as string | undefined) || window.location.origin;
  const link = "font-display text-[12.5px] font-bold uppercase tracking-[0.08em] text-[var(--text-dim)] hover:text-[var(--accent)]";
  return (
    <footer className="overflow-hidden border-t border-[var(--border)]">
      <div className={`${WRAP} flex flex-wrap items-center justify-between gap-6 py-10`}>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-7 gap-y-3">
          <Link to="/app" className={link}>Dashboard</Link>
          <Link to="/app/chat" className={link}>Chat</Link>
          <Link to="/app/agents" className={link}>Agents</Link>
          <a href={`${origin}/api/docs`} target="_blank" rel="noreferrer" className={link}>API reference</a>
          <a href="https://github.com/aryan2006-singh/paypilot" target="_blank" rel="noreferrer" className={link}>GitHub</a>
        </nav>
        <div className="text-[13px] text-[var(--text-muted)]">
          © {new Date().getFullYear()} PayPilot · AI operations for payments teams{info ? ` · v${info.version}` : ""}
        </div>
      </div>
      <div aria-hidden className={`${WRAP} select-none`}>
        <div className="font-display -mb-[0.2em] text-[clamp(64px,17vw,240px)] font-bold uppercase leading-[0.8] tracking-[-0.045em] text-[var(--surface-3)]">
          PayPilot<span className="text-[var(--accent)]">.</span>
        </div>
      </div>
    </footer>
  );
}

/* ----------------------------------------------------------------------------
 * Page (always dark, like a product site; the console follows the theme)
 * ------------------------------------------------------------------------- */

export function Landing() {
  const info = useAsync(api.info, { pollMs: 60000 });
  // Stats need a key when auth is on; the cards simply hide if they fail.
  const stats = useAsync(api.stats, { pollMs: 30000 });
  const { agents } = useAgentsState();

  useEffect(() => {
    document.title = "PayPilot · AI operations for payments teams";
    return () => {
      document.title = "PayPilot · Payments Ops Console";
    };
  }, []);

  return (
    <div className="dark min-h-dvh bg-[var(--bg)] text-[var(--text)] [color-scheme:dark]">
      <a
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          scrollToSection("numbers");
        }}
        className="fixed left-3 top-3 z-50 -translate-y-20 bg-[var(--accent)] px-3 py-2 text-[13px] font-medium text-[var(--on-accent)] focus:translate-y-0"
      >
        Skip to content
      </a>
      <Nav />
      <main>
        <Hero info={info.data} agentCount={agents?.length ?? null} />
        <Marquee />
        <Numbers info={info.data} stats={stats.error ? null : stats.data} agentCount={agents?.length ?? null} />
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
