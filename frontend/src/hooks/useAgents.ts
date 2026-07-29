import { useEffect, useState } from "react";
import { api } from "../api";
import type { AgentMeta } from "../types";

let cache: AgentMeta[] | null = null;

export function useAgents() {
  const [agents, setAgents] = useState<AgentMeta[] | null>(cache);

  useEffect(() => {
    if (cache) return;
    api.agents().then((data) => {
      cache = data;
      setAgents(data);
    });
  }, []);

  return agents;
}

export function agentById(agents: AgentMeta[] | null, id: string): AgentMeta | undefined {
  return agents?.find((a) => a.id === id);
}
