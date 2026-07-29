import type { ActivityEntry, AgentMeta, ChatResponse, Config, Stats } from "./types";

// Empty string means same-origin (the all-in-one FastAPI-served mode). Set
// VITE_API_URL at build time when the frontend is deployed separately from
// the backend (e.g. this on Vercel, the API on Render/Railway).
const BASE = import.meta.env.VITE_API_URL ?? "";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const api = {
  health: () => fetch(`${BASE}/health`, { cache: "no-store" }).then((r) => r.ok),

  agents: () => fetch(`${BASE}/api/agents`).then((r) => json<AgentMeta[]>(r)),

  stats: () => fetch(`${BASE}/api/stats`).then((r) => json<Stats>(r)),

  activity: (limit = 20) => fetch(`${BASE}/api/activity?limit=${limit}`).then((r) => json<ActivityEntry[]>(r)),

  config: () => fetch(`${BASE}/api/config`).then((r) => json<Config>(r)),

  chat: (message: string, sessionId: string) =>
    fetch(`${BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, session_id: sessionId }),
    }).then((r) => json<ChatResponse>(r)),
};
