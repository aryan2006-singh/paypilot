export function AgentChip({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-3)] py-[3px] pl-1.5 pr-2.5 text-[11.5px] font-semibold">
      <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

export function StatusChip({ kind }: { kind: "demo" | "live" }) {
  const isDemo = kind === "demo";
  return (
    <span
      className="rounded-full px-2 py-[2px] text-[10.5px] font-bold uppercase tracking-wide"
      style={
        isDemo
          ? { background: "color-mix(in srgb, var(--warn) 16%, transparent)", color: "var(--warn)", border: "1px solid color-mix(in srgb, var(--warn) 32%, transparent)" }
          : { background: "color-mix(in srgb, var(--ok) 16%, transparent)", color: "var(--ok)", border: "1px solid color-mix(in srgb, var(--ok) 32%, transparent)" }
      }
    >
      {isDemo ? "Demo" : "Live"}
    </span>
  );
}

export function Pill({ ok, yesLabel = "Yes", noLabel = "No" }: { ok: boolean; yesLabel?: string; noLabel?: string }) {
  return (
    <span
      className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
      style={
        ok
          ? { background: "color-mix(in srgb, var(--ok) 16%, transparent)", color: "var(--ok)" }
          : { background: "color-mix(in srgb, var(--critical) 16%, transparent)", color: "var(--critical)" }
      }
    >
      {ok ? yesLabel : noLabel}
    </span>
  );
}
