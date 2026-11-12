import { Monitor, Moon, Sun, Copy, Check } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Pill } from "../components/Chips";
import { ErrorState, Skeleton } from "../components/States";
import { useAsync } from "../hooks/useAsync";
import { useTheme, type ThemePref } from "../hooks/useTheme";
import { api, auth } from "../api";

function Row({ label, hint, right }: { label: string; hint?: string; right: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] py-3.5 first:pt-0 last:border-0 last:pb-0 max-sm:flex-col max-sm:items-start max-sm:gap-2">
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium">{label}</div>
        {hint && <div className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--text-muted)]">{hint}</div>}
      </div>
      <div className="shrink-0">{right}</div>
    </div>
  );
}

const THEME_OPTIONS: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function ThemePicker() {
  const { pref, setPref } = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5">
      {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = pref === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPref(value)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-medium transition-colors ${
              active ? "bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-sm)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            <Icon size={13} aria-hidden /> {label}
          </button>
        );
      })}
    </div>
  );
}

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5">
      <code className="inline-code">{value}</code>
      <button
        type="button"
        aria-label="Copy"
        onClick={() => {
          navigator.clipboard?.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          });
        }}
        className="grid h-7 w-7 place-items-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </span>
  );
}

function ApiKeyCard({ required }: { required: boolean | undefined }) {
  const saved = useSyncExternalStore(auth.subscribe, auth.get);
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<"idle" | "checking" | "bad">("idle");

  async function save() {
    const key = draft.trim();
    if (!key) return;
    setState("checking");
    try {
      const ok = await api.checkKey(key);
      if (ok) {
        auth.set(key);
        setDraft("");
        setState("idle");
      } else setState("bad");
    } catch {
      setState("bad");
    }
  }

  return (
    <Card title="API key" description={required ? "This server requires a key." : "Optional: this server currently accepts requests without a key."}>
      <Row
        label="Status"
        hint="Stored in this browser only and sent as X-API-Key."
        right={<Pill ok={!!saved || required === false} yesLabel={saved ? "Key saved" : "Not needed"} noLabel="Key needed" />}
      />
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label htmlFor="api-key" className="sr-only">
          API key
        </label>
        <input
          id="api-key"
          type="password"
          autoComplete="off"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setState("idle");
          }}
          placeholder={saved ? "Replace saved key" : "Paste your API key"}
          className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-[13px] outline-none focus:border-[var(--accent)] max-md:text-[16px]"
        />
        <button type="submit" disabled={!draft.trim() || state === "checking"} className="brand-gradient h-9 rounded-lg px-3.5 text-[13px] font-semibold text-white disabled:opacity-50">
          {state === "checking" ? "Checking…" : "Save"}
        </button>
        {saved && (
          <button type="button" onClick={() => auth.set("")} className="h-9 rounded-lg border border-[var(--border)] px-3 text-[13px] hover:border-[var(--accent)]">
            Remove
          </button>
        )}
      </form>
      {state === "bad" && <p role="alert" className="mt-2 text-[12.5px] text-[var(--critical)]">The server rejected that key.</p>}
    </Card>
  );
}

export function Settings() {
  const config = useAsync(api.config);
  const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) || window.location.origin;

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="How this deployment is configured. Read-only: no secrets are ever sent to the browser."
      />

      <div className="grid grid-cols-2 gap-5 max-lg:grid-cols-1">
        <Card title="Appearance" description="Saved in this browser only.">
          <Row label="Theme" hint="System follows your device setting." right={<ThemePicker />} />
        </Card>

        <Card title="Connection" description="Where this console sends requests.">
          <Row label="API endpoint" right={<CopyValue value={apiUrl} />} />
        </Card>

        <ApiKeyCard required={config.data?.auth_required} />

        {config.error && !config.data ? (
          <div className="col-span-full">
            <ErrorState error={config.error} onRetry={config.reload} />
          </div>
        ) : !config.data ? (
          [0, 1].map((i) => (
            <Card key={i} title={i === 0 ? "Razorpay integration" : "RAG indexes"}>
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-4 h-4 w-1/2" />
            </Card>
          ))
        ) : (
          <>
            <Card title="Razorpay integration" description="Live payment data source for the agents' tools.">
              <Row
                label="Live API keys"
                hint="When off, tool calls return deterministic demo data instead of failing."
                right={<Pill ok={config.data.razorpay_configured} yesLabel="Configured" noLabel="Demo mode" />}
              />
              {config.data.llm_configured !== undefined && (
                <Row
                  label="AI-written replies"
                  hint={config.data.llm_model ? `Model: ${config.data.llm_model}` : "Set ANTHROPIC_API_KEY on the server to enable."}
                  right={<Pill ok={config.data.llm_configured} yesLabel="On" noLabel="Templates" />}
                />
              )}
              <Row label="Key ID" right={<code className="inline-code">{config.data.razorpay_key_id_masked}</code>} />
            </Card>

            <Card title="RAG indexes" description="Policy documents each agent can ground its answers in.">
              {Object.entries(config.data.rag_index_ready).map(([namespace, ready]) => (
                <Row
                  key={namespace}
                  label={namespace.charAt(0).toUpperCase() + namespace.slice(1)}
                  right={<Pill ok={ready} yesLabel="Built" noLabel="Missing" />}
                />
              ))}
            </Card>

            <Card title="Routable intents" description="The router sends every message to one of these." className="col-span-full">
              <div className="flex flex-wrap gap-2">
                {config.data.intents.map((intent) => (
                  <span key={intent} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 font-mono text-[12px] text-[var(--text-dim)]">
                    {intent}
                  </span>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
