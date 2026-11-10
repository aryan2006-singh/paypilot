import { useEffect, useState } from "react";
import { api } from "../api";
import type { AgentMeta } from "../types";

let cache: AgentMeta[] | null = null;
let inflight: Promise<AgentMeta[]> | null = null;

function load(): Promise<AgentMeta[]> {
  if (!inflight) {
    inflight = api.agents().then(
      (data) => {
        cache = data;
        return data;
      },
      (err) => {
        inflight = null; // allow a retry after a failure
        throw err;
      },
    );
  }
  return inflight;
}

/** Agent metadata, fetched once and shared. Returns null while loading. */
export function useAgents() {
  return useAgentsState().agents;
}

export function useAgentsState() {
  const [agents, setAgents] = useState<AgentMeta[] | null>(cache);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (cache) return;
    let cancelled = false;
    setError(null);
    load().then(
      (data) => !cancelled && setAgents(data),
      (err) => !cancelled && setError(err instanceof Error ? err : new Error(String(err))),
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return { agents, error, retry: () => setAttempt((n) => n + 1) };
}

export function agentById(agents: AgentMeta[] | null, id: string): AgentMeta | undefined {
  return agents?.find((a) => a.id === id);
}
