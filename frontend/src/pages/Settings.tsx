import { useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Pill } from "../components/Chips";
import { api } from "../api";
import type { Config } from "../types";

function Row({ label, hint, right }: { label: string; hint?: string; right: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--border)] py-3 last:border-0">
      <div>
        <div className="text-[13.5px]">{label}</div>
        {hint && <div className="mt-0.5 text-[12px] text-[var(--text-muted)]">{hint}</div>}
      </div>
      {right}
    </div>
  );
}

export function Settings() {
  const [config, setConfig] = useState<Config | null>(null);

  useEffect(() => {
    api.config().then(setConfig);
  }, []);

  if (!config) {
    return (
      <div>
        <PageHeader title="Settings" subtitle="Read-only view of how this deployment is configured." />
        <div className="py-6 text-center text-[13px] text-[var(--text-muted)]">Loading…</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Read-only view of how this deployment is configured — no secrets are ever sent to the browser."
      />

      <Card title="Razorpay integration">
        <Row
          label="Live API keys configured"
          hint="When off, all tool calls return deterministic mock data instead of failing."
          right={<Pill ok={config.razorpay_configured} yesLabel="Configured" noLabel="Demo mode" />}
        />
        <Row label="Key ID" right={<code className="inline-code">{config.razorpay_key_id_masked}</code>} />
      </Card>

      <Card title="RAG indexes (FAISS)">
        {Object.entries(config.rag_index_ready).map(([namespace, ready]) => (
          <Row key={namespace} label={namespace} right={<Pill ok={ready} yesLabel="Built" noLabel="Missing" />} />
        ))}
      </Card>

      <Card title="Routable intents">
        <Row label={config.intents.join(", ")} right={<></>} />
      </Card>
    </div>
  );
}
