import { useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import { Check, CreditCard, IndianRupee, Wifi } from "lucide-react";

/*
 * Pinned scroll scene: a phone slides in from the right, a PayPilot payment
 * card glides over to meet it, and on contact the payment resolves. The
 * phone screen plays a short chat (question, agent working, answer) in step
 * with the scroll.
 */

const STAGES = [
  { title: "Ask from anywhere.", body: "Type the question on your phone, the way you'd ask a teammate." },
  { title: "PayPilot looks it up.", body: "The payments agent checks Razorpay and your policies in real time." },
  { title: "Resolved in seconds.", body: "You get the answer, the reason and the next step, with the data attached." },
];

function Bubble({ me, children }: { me?: boolean; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className={`max-w-[88%] px-3 py-2 text-[12.5px] leading-snug ${me ? "self-end bg-[#9ef500] text-[#141414]" : "self-start bg-[#262626] text-white"}`}
    >
      {children}
    </motion.div>
  );
}

function PhoneScreen({ stage }: { stage: number }) {
  return (
    <div className="flex h-full flex-col bg-[#0f0f0f] px-3 pb-4 pt-9">
      <div className="mb-3 flex items-center justify-between border-b border-[#262626] pb-2.5">
        <span className="font-display text-[13px] font-bold uppercase">
          PayPilot<span className="text-[#9ef500]">.</span>
        </span>
        <span className="flex items-center gap-1 text-[10px] text-[#acb5b4]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#6fdc4a]" /> Live
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2.5">
        <AnimatePresence>
          <Bubble me key="q">Why did pay_XYZ789 fail?</Bubble>
          {stage >= 1 && (
            <motion.div key="work" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="self-start text-[10.5px] text-[#7d8685]">
              <span className="font-display font-bold uppercase tracking-[0.08em] text-[#9ef500]">Payments agent</span>
              {stage === 1 ? " · checking Razorpay…" : " · checked Razorpay and policy"}
            </motion.div>
          )}
          {stage === 1 && (
            <motion.div key="dots" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-1 self-start bg-[#262626] px-3 py-2.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#acb5b4]" style={{ animationDelay: `${i * 0.12}s` }} />
              ))}
            </motion.div>
          )}
          {stage >= 2 && (
            <Bubble key="a">
              The bank declined it for <b>insufficient funds</b>. No money was taken. I've sent the customer a retry link.
            </Bubble>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {stage >= 2 && (
          <motion.div
            key="ok"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="font-display flex items-center justify-center gap-2 bg-[#9ef500] py-3 text-[13px] font-bold uppercase tracking-[0.06em] text-[#141414]"
          >
            <Check size={16} strokeWidth={3} /> Resolved · ₹4,999
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PhonePayScene() {
  const ref = useRef<HTMLElement>(null);
  // Scroll-linked motion only moves when the visitor scrolls, so it stays on
  // even with "reduce motion"; looping CSS animations are still turned off.
  const reduce = false as boolean;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const p = useSpring(scrollYProgress, { stiffness: 100, damping: 24, mass: 0.35 });
  const r = (a: number, b: number) => (reduce ? [b, b] : [a, b]);

  // Phone slides in from the right and straightens up.
  const phoneX = useTransform(p, [0, 0.35], r(520, 0));
  const phoneY = useTransform(p, [0, 0.35], r(160, 0));
  const phoneRot = useTransform(p, [0, 0.35, 1], reduce ? [-6, -6, -6] : [18, -6, -4]);

  // The payment card glides toward the phone and taps it.
  const cardX = useTransform(p, [0.3, 0.55, 0.7, 1], reduce ? [120, 120, 120, 120] : [-120, 120, 90, 90]);
  const cardY = useTransform(p, [0.25, 0.55], r(80, 0));
  const cardRotY = useTransform(p, [0.25, 0.55], r(-35, 18));
  const cardRotZ = useTransform(p, [0.25, 0.55], r(-18, -8));
  const cardOpacity = useTransform(p, [0.3, 0.4], [reduce ? 1 : 0, 1]);

  // Contact pulse and coins.
  const pulse = useTransform(p, [0.52, 0.72], [0, 1]);
  const pulseScale = useTransform(pulse, [0, 1], [0.4, 2.6]);
  const pulseOpacity = useTransform(pulse, [0, 0.2, 1], [0, 0.9, 0]);
  const coinsT = useTransform(p, [0.55, 0.85], [reduce ? 1 : 0, 1]);

  const [stage, setStage] = useState(reduce ? 2 : 0);
  useMotionValueEvent(scrollYProgress, "change", (v) => setStage(v < 0.4 ? 0 : v < 0.62 ? 1 : 2));

  return (
    <section ref={ref} className="relative border-t border-[var(--border)]" style={{ height: reduce ? "auto" : "300vh" }}>
      <div className={`${reduce ? "py-20" : "sticky top-[76px] h-[calc(100dvh-76px)] max-md:top-16 max-md:h-[calc(100dvh-64px)]"} overflow-hidden`}>
        <div aria-hidden className="grid-lines pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(60%_60%_at_60%_50%,black,transparent)]" />
        <div className="relative mx-auto grid h-full w-full max-w-[1280px] grid-cols-[0.85fr_1.15fr] items-center gap-6 px-8 max-lg:grid-cols-1 max-lg:grid-rows-[auto_1fr] max-lg:items-start max-lg:px-4 max-lg:pt-8">
          <div className="relative z-10">
            <div className="font-display flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
              <span aria-hidden className="h-2 w-2 bg-[var(--accent)]" /> In your pocket
            </div>
            <div className="relative mt-5 min-h-[230px] max-lg:min-h-[130px]">
              <AnimatePresence mode="wait">
                <motion.div key={stage} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} transition={{ duration: 0.35 }}>
                  <h2 className="text-[64px] font-bold leading-[0.98] tracking-[-0.03em] max-lg:text-[38px] max-md:text-[30px]">{STAGES[stage].title}</h2>
                  <p className="mt-5 max-w-[420px] text-[17px] leading-relaxed text-[var(--text-dim)] max-lg:mt-3 max-lg:text-[14.5px]">{STAGES[stage].body}</p>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="mt-6 flex gap-2 max-lg:mt-2">
              {STAGES.map((_, i) => (
                <span key={i} className={`h-[3px] w-12 transition-colors ${i <= stage ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`} />
              ))}
            </div>
          </div>

          <div aria-hidden className="relative h-full min-h-[480px] max-lg:min-h-0" style={{ perspective: 1400 }}>
            <div className="absolute left-1/2 top-1/2 h-0 w-0 max-lg:left-[40%] max-lg:top-[46%] max-md:scale-[0.72] max-lg:scale-[0.85]">
              {/* Contact pulse */}
              <motion.div
                className="absolute -left-[90px] -top-[90px] h-[180px] w-[180px] rounded-full border-2 border-[#9ef500]"
                style={{ x: 40, y: 10, scale: pulseScale, opacity: pulseOpacity }}
              />

              {/* Phone */}
              <motion.div className="absolute -left-[20px] -top-[290px]" style={{ x: phoneX, y: phoneY, rotate: phoneRot }}>
                <div className="relative h-[580px] w-[290px] rounded-[44px] bg-[#e9ece6] p-[10px] shadow-[0_50px_100px_-30px_rgba(0,0,0,0.9)]">
                  <div className="relative h-full w-full overflow-hidden rounded-[36px] bg-black">
                    <div className="absolute left-1/2 top-2.5 z-10 h-[22px] w-[90px] -translate-x-1/2 rounded-full bg-black" />
                    <PhoneScreen stage={stage} />
                  </div>
                </div>
              </motion.div>

              {/* Payment card */}
              <motion.div
                className="absolute -left-[300px] -top-[60px]"
                style={{ x: cardX, y: cardY, rotateY: cardRotY, rotateZ: cardRotZ, opacity: cardOpacity, transformPerspective: 1000 }}
              >
                <div className="relative flex h-[170px] w-[270px] flex-col justify-between overflow-hidden rounded-[16px] bg-[#9ef500] p-5 text-[#141414] shadow-[0_40px_70px_-25px_rgba(0,0,0,0.9)]">
                  <div className="flex items-start justify-between">
                    <span className="font-display text-[18px] font-bold uppercase">
                      PayPilot<span className="text-white">.</span>
                    </span>
                    <Wifi size={18} className="rotate-90" />
                  </div>
                  <div className="flex items-center gap-2">
                    <CreditCard size={18} />
                    <span className="font-mono text-[12px]">pay_XYZ789</span>
                  </div>
                  <div className="font-display text-[26px] font-bold leading-none">₹4,999</div>
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.3)_45%,transparent_60%)]" />
                </div>
              </motion.div>

              {/* Coins burst on contact */}
              {[
                { dx: -190, dy: -230, s: 58 },
                { dx: -70, dy: -320, s: 44 },
                { dx: -260, dy: -120, s: 38 },
              ].map((c, i) => (
                <Burst key={i} t={coinsT} {...c} i={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Burst({ t, dx, dy, s, i }: { t: MotionValue<number>; dx: number; dy: number; s: number; i: number }) {
  const x = useTransform(t, [0, 1], [-80, dx]);
  const y = useTransform(t, [0, 1], [20, dy]);
  const scale = useTransform(t, [0, 0.3, 1], [0.2, 1, 1]);
  const opacity = useTransform(t, [0, 0.15, 1], [0, 1, 1]);
  const rotate = useTransform(t, [0, 1], [0, 220 + i * 90]);
  return (
    <motion.div className="absolute left-0 top-0" style={{ x, y, scale, opacity, rotate }}>
      <div
        className="grid place-items-center rounded-full bg-[#9ef500] text-[#141414] shadow-[inset_0_0_0_4px_#b8ff3d,inset_0_0_0_7px_#7fc400,0_6px_0_#5d9200,0_14px_30px_-10px_rgba(0,0,0,0.8)]"
        style={{ width: s, height: s }}
      >
        <IndianRupee size={s * 0.46} strokeWidth={2.6} />
      </div>
    </motion.div>
  );
}
