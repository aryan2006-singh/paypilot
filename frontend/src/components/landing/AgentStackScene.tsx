import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useMotionValueEvent, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import { ArrowUpRight, Bot, type LucideIcon } from "lucide-react";
import { useAgentsState } from "../../hooks/useAgents";
import { AGENT_ICONS } from "../ChatWelcome";
import type { AgentMeta } from "../../types";

/*
 * Pinned scroll scene: the five agent cards fly in one at a time from the
 * lower right and settle into a fan on the right side of the screen, while
 * the heading on the left counts through them.
 */

function useIsLarge() {
  const q = "(min-width: 1024px)";
  const [large, setLarge] = useState(() => typeof matchMedia === "function" && matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q);
    const on = () => setLarge(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return large;
}

function AgentCard({
  agent,
  index,
  count,
  progress,
  large,
  reduce,
}: {
  agent: AgentMeta;
  index: number;
  count: number;
  progress: MotionValue<number>;
  large: boolean;
  reduce: boolean;
}) {
  const Icon: LucideIcon = AGENT_ICONS[agent.id] ?? Bot;
  // Each card gets its own slice of the scroll.
  const slice = 0.86 / count;
  const start = 0.04 + index * slice;
  const end = start + slice * 1.05;
  const t = useTransform(progress, [start, end], [reduce ? 1 : 0, 1], { clamp: true });

  // Final fanned position (relative to the stack origin).
  const mid = (count - 1) / 2;
  const fx = large ? index * 86 : index * 16;
  const fy = large ? Math.abs(index - mid) * 14 - index * 10 : index * 14;
  const fr = large ? (index - mid) * 4 : (index - mid) * 2;

  const x = useTransform(t, [0, 1], [large ? 760 : 260, fx]);
  const y = useTransform(t, [0, 1], [large ? 520 : 520, fy]);
  const rotate = useTransform(t, [0, 1], [large ? 24 : 14, fr]);
  const rotateY = useTransform(t, [0, 0.7, 1], [-40, -8, 0]);
  const opacity = useTransform(t, [0, 0.15, 1], [0, 1, 1]);

  return (
    <motion.div
      className="absolute left-0 top-0 will-change-transform"
      style={{ x, y, rotate, rotateY, opacity, zIndex: index + 1, transformPerspective: 1200 }}
    >
      <Link
        to={`/app/chat?q=${encodeURIComponent(agent.example)}`}
        className="group block w-[360px] overflow-hidden border border-[#141414] bg-white text-[#141414] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.85)] max-lg:w-[270px]"
      >
        <div className="flex items-center justify-between bg-[#9ef500] px-6 py-4 max-lg:px-4 max-lg:py-3">
          <span className="font-display text-[14px] font-bold uppercase tracking-[0.06em] max-lg:text-[12.5px]">{agent.label}</span>
          <span className="font-mono text-[11px] font-medium">0{index + 1}</span>
        </div>
        <p className="px-6 py-5 text-[15px] leading-relaxed max-lg:px-4 max-lg:py-3 max-lg:text-[13px]">{agent.description}</p>
        <div className="relative mx-3 mb-3 grid h-[200px] place-items-center overflow-hidden bg-[#141414] max-lg:h-[130px]">
          <div aria-hidden className="grid-lines absolute inset-0 opacity-60" />
          <div className="relative grid h-[96px] w-[96px] place-items-center rounded-full bg-[#9ef500] text-[#141414] shadow-[0_0_0_10px_rgba(158,245,0,0.12),0_0_0_22px_rgba(158,245,0,0.06)] transition-transform duration-300 group-hover:scale-110 max-lg:h-[64px] max-lg:w-[64px]">
            <Icon className="h-[44%] w-[44%]" strokeWidth={2.2} />
          </div>
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 border border-[#2b2b2b] bg-[#1a1a1a] px-3 py-2 font-mono text-[11.5px] text-[#acb5b4] max-lg:hidden">
            <span className="truncate">“{agent.example}”</span>
            <ArrowUpRight size={14} className="shrink-0 text-[#9ef500]" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function AgentStackScene() {
  const ref = useRef<HTMLElement>(null);
  // Scroll-linked motion only moves when the visitor scrolls, so it stays on
  // even with "reduce motion"; looping CSS animations are still turned off.
  const reduce = false as boolean;
  const large = useIsLarge();
  const { agents, error, retry } = useAgentsState();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const progress = useSpring(scrollYProgress, { stiffness: 110, damping: 26, mass: 0.35 });
  const list = agents ?? [];
  const count = Math.max(list.length, 1);

  // Which agent is "current" for the counter on the left.
  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const i = Math.min(count - 1, Math.max(0, Math.floor((v - 0.04) / (0.86 / count))));
    setActive(i);
  });
  const bar = useTransform(scrollYProgress, [0.04, 0.92], ["0%", "100%"]);
  const current = list[active];

  return (
    <section id="agents" ref={ref} className="relative scroll-mt-20 border-t border-[var(--border)]" style={{ height: reduce ? "auto" : `${120 + count * 70}vh` }}>
      <div className={`${reduce ? "" : "sticky top-[76px] h-[calc(100dvh-76px)] max-md:top-16 max-md:h-[calc(100dvh-64px)]"} overflow-hidden`}>
        <div className="mx-auto grid h-full w-full max-w-[1280px] grid-cols-[0.9fr_1.1fr] items-center gap-10 px-8 max-lg:grid-cols-1 max-lg:grid-rows-[auto_1fr] max-lg:items-start max-lg:gap-4 max-lg:px-4 max-lg:pt-8">
          <div>
            <div className="font-display flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
              <span aria-hidden className="h-2 w-2 bg-[var(--accent)]" /> The team
            </div>
            <h2 className="mt-5 text-[64px] font-bold leading-[0.98] tracking-[-0.03em] max-lg:text-[40px] max-md:text-[32px]">
              {list.length || 5} agents.
              <br />
              <span className="text-[var(--accent)]">One job each.</span>
            </h2>
            <p className="mt-5 max-w-[460px] text-[17px] leading-relaxed text-[var(--text-dim)] max-lg:hidden">
              A router reads every question and hands it to the right specialist. Scroll to meet them, or click a card to ask
              it something.
            </p>
            {list.length > 0 && (
              <div className="mt-10 max-w-[420px] max-lg:mt-5">
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-[28px] font-bold uppercase max-lg:text-[18px]">{current?.label}</span>
                  <span className="font-mono text-[13px] text-[var(--text-muted)]">
                    0{active + 1} / 0{list.length}
                  </span>
                </div>
                <div className="mt-3 h-[3px] w-full bg-[var(--border)]">
                  <motion.div className="h-full bg-[var(--accent)]" style={{ width: bar }} />
                </div>
              </div>
            )}
            {error && !agents && (
              <p className="mt-8 text-[15px] text-[var(--text-muted)]">
                Couldn't load the agents.{" "}
                <button type="button" onClick={retry} className="font-medium text-[var(--accent)] hover:underline">
                  Try again
                </button>
              </p>
            )}
          </div>

          <div className="relative h-[560px] max-lg:mx-auto max-lg:h-[420px] max-lg:w-[340px]" style={{ perspective: 1400 }}>
            <div className="absolute left-0 top-[6%] max-lg:left-[2%] max-lg:top-0">
              {list.map((a, i) => (
                <AgentCard key={a.id} agent={a} index={i} count={list.length} progress={progress} large={large} reduce={reduce} />
              ))}
              {!agents && !error && <div className="skeleton h-[460px] w-[360px] max-lg:h-[330px] max-lg:w-[270px]" />}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
