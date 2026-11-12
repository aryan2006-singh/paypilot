import { useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from "framer-motion";
import { Check, IndianRupee, Wifi } from "lucide-react";

/*
 * An original 3D hero object built only with CSS 3D transforms:
 * a fanned stack of payment cards with thick lime coins rising around it.
 * Scrolling the hero opens the fan, tilts the stack upright and lifts the
 * coins; the mouse adds a small tilt. No WebGL, so it stays light on phones.
 */

const CARD_W = 340;
const CARD_H = 214;

function Card({
  depth,
  spread,
  variant,
}: {
  depth: number;
  spread: MotionValue<number>;
  variant: "lime" | "ink" | "paper";
}) {
  // Each card moves further along Z and Y as the fan opens.
  const z = useTransform(spread, (s) => depth * (14 + s * 70));
  const y = useTransform(spread, (s) => depth * -(6 + s * 26));
  const rot = useTransform(spread, (s) => depth * s * -7);

  const styles = {
    lime: "bg-[#9ef500] text-[#141414]",
    ink: "bg-[#1f1f1f] text-white border border-[#3a3a3a]",
    paper: "bg-[#f3f4ef] text-[#141414]",
  }[variant];

  return (
    <motion.div
      className={`absolute left-0 top-0 overflow-hidden ${styles}`}
      style={{
        width: CARD_W,
        height: CARD_H,
        z,
        y,
        rotateZ: rot,
        borderRadius: 18,
        boxShadow: "0 30px 60px -20px rgba(0,0,0,0.65)",
        transformStyle: "preserve-3d",
      }}
    >
      {variant === "lime" && (
        <div className="flex h-full flex-col justify-between p-6">
          <div className="flex items-start justify-between">
            <span className="font-display text-[22px] font-bold uppercase tracking-[0.02em]">
              PayPilot<span className="text-white">.</span>
            </span>
            <Wifi size={22} className="rotate-90" aria-hidden />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-12 rounded-[6px] bg-[linear-gradient(135deg,#141414_0%,#3a3a3a_100%)] opacity-90" />
            <span className="font-mono text-[13px] font-medium">pay_XYZ789</span>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <div className="font-display text-[10px] font-bold uppercase tracking-[0.14em] opacity-70">Status</div>
              <div className="font-display flex items-center gap-1.5 text-[17px] font-bold uppercase">
                <Check size={16} strokeWidth={3} /> Resolved
              </div>
            </div>
            <div className="font-display text-[30px] font-bold leading-none tracking-[-0.03em]">₹4,999</div>
          </div>
        </div>
      )}
      {variant === "ink" && (
        <div className="flex h-full flex-col justify-between p-6">
          <div className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-[#9ef500]">Refund agent</div>
          <div className="font-mono text-[13px] text-[#acb5b4]">rfnd_7Q2 · processed in 5 days</div>
        </div>
      )}
      {variant === "paper" && (
        <div className="flex h-full flex-col justify-between p-6">
          <div className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-[#5b6160]">Settlement</div>
          <div className="font-mono text-[13px]">stl_44 · matched to ledger</div>
        </div>
      )}
      {/* Light sweep across the face */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.28)_45%,transparent_60%)]" />
    </motion.div>
  );
}

/** A coin with real thickness: a stack of discs with a face on top. */
function Coin({ size, x, y, z, lift, spin, face, delay }: { size: number; x: number; y: number; z: number; lift: MotionValue<number>; spin: MotionValue<number>; face: MotionValue<number>; delay: number }) {
  const ty = useTransform(lift, (l) => y - l * (90 + delay * 60));
  const tz = useTransform(lift, (l) => z + l * 60);
  const rotateY = useTransform(spin, (s) => 25 + s * (300 + delay * 160));
  // Cancel most of the scene's tilt so the coin stands up and faces the viewer.
  const rotateX = useTransform(face, (v) => -v + 12);
  const layers = 9;
  return (
    <motion.div
      className="absolute"
      style={{ left: x, top: 0, width: size, height: size, y: ty, z: tz, rotateX, rotateY, transformStyle: "preserve-3d" }}
    >
      {Array.from({ length: layers }, (_, i) => (
        <div
          key={i}
          className="absolute inset-0 rounded-full"
          style={{
            transform: `translateZ(${i - layers / 2}px)`,
            background: i === layers - 1 ? "#9ef500" : i === 0 ? "#6fae00" : "#5d9200",
            boxShadow: i === layers - 1 ? "inset 0 0 0 4px #b8ff3d, inset 0 0 0 7px #7fc400" : undefined,
          }}
        />
      ))}
      <div
        className="absolute inset-0 grid place-items-center rounded-full text-[#141414]"
        style={{ transform: `translateZ(${layers / 2 + 0.5}px)` }}
      >
        <IndianRupee size={size * 0.46} strokeWidth={2.6} />
      </div>
      <div
        className="absolute inset-0 grid place-items-center rounded-full bg-[#7fc400] text-[#141414]"
        style={{ transform: `translateZ(${-layers / 2 - 0.5}px) rotateY(180deg)` }}
      >
        <IndianRupee size={size * 0.46} strokeWidth={2.6} />
      </div>
    </motion.div>
  );
}

/** `progress` runs 0 to 1 as the hero scrolls; it drives the whole pose. */
export function PaymentStack3D({ progress }: { progress: MotionValue<number> }) {
  // Scroll-linked motion only moves when the visitor scrolls, so it stays on
  // even with "reduce motion"; looping CSS animations are still turned off.
  const reduce = false as boolean;
  const p = useSpring(progress, { stiffness: 80, damping: 20, mass: 0.4 });
  const k = (a: number, b: number) => (reduce ? [(a + b) / 2, (a + b) / 2] : [a, b]);

  // Scroll-driven pose: from lying flat and stacked to upright and fanned out.
  const rotateX = useTransform(p, [0, 1], k(60, 10));
  const rotateZ = useTransform(p, [0, 1], k(-32, -6));
  const spread = useTransform(p, [0, 0.75], k(0.1, 1));
  const lift = useTransform(p, [0, 1], k(0, 1.5));
  const spin = useTransform(p, [0, 1], reduce ? [0, 0] : [0, 1]);
  const scale = useTransform(p, [0, 1], k(0.95, 1.12));
  const sceneY = useTransform(p, [0, 1], k(0, -30));

  // Mouse tilt, smoothed.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const tiltX = useSpring(my, { stiffness: 60, damping: 15 });
  const tiltY = useSpring(mx, { stiffness: 60, damping: 15 });
  const finalRotX = useTransform(() => rotateX.get() + tiltX.get());
  const finalRotY = useTransform(tiltY, (v) => v);

  useEffect(() => {
    if (reduce) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      mx.set((e.clientX / window.innerWidth - 0.5) * 16);
      my.set(-(e.clientY / window.innerHeight - 0.5) * 10);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [mx, my, reduce]);

  return (
    <div aria-hidden className="pointer-events-none select-none" style={{ perspective: 1400 }}>
      <motion.div
        className="relative animate-[pp-float_6s_ease-in-out_infinite]"
        style={{ width: CARD_W, height: CARD_H, y: sceneY, scale, transformStyle: "preserve-3d" }}
      >
        <motion.div
          className="absolute inset-0"
          style={{ rotateX: finalRotX, rotateY: finalRotY, rotateZ, transformStyle: "preserve-3d" }}
        >
          {/* Soft shadow on the "floor" */}
          <div className="absolute left-[8%] top-[30%] h-[80%] w-[84%] rounded-full bg-[#9ef500] opacity-[0.12] blur-3xl" style={{ transform: "translateZ(-80px)" }} />
          <Card depth={0} spread={spread} variant="paper" />
          <Card depth={1} spread={spread} variant="ink" />
          <Card depth={2} spread={spread} variant="lime" />
          <Coin size={74} x={-46} y={40} z={190} lift={lift} spin={spin} delay={0.2} face={finalRotX} />
          <Coin size={56} x={262} y={-36} z={230} lift={lift} spin={spin} delay={0.8} face={finalRotX} />
          <Coin size={44} x={150} y={150} z={260} lift={lift} spin={spin} delay={0.5} face={finalRotX} />
        </motion.div>
      </motion.div>
    </div>
  );
}
