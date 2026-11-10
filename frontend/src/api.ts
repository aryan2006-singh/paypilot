import type { ActivityEntry, AgentMeta, ChatResponse, Config, Stats } from "./types";

// Empty string means same-origin (the all-in-one FastAPI-served mode). Set
// VITE_API_URL at build time when the frontend is deployed separately from
// the backend (e.g. this on Vercel, the API on Render/Railway).
const BASE = import.meta.env.VITE_API_URL ?? "";

/** Turns a failed response into a short, human-readable error message. */
async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.text();
      try {
        const parsed = JSON.parse(body);
        detail = typeof parsed.detail === "string" ? parsed.detail : JSON.stringify(parsed.detail ?? parsed);
      } catch {
        detail = body.slice(0, 200);
      }
    } catch {
      /* ignore */
    }
    const friendly =
      res.status === 429 ? "Too many requests, please wait a moment and try again."
      : res.status === 401 || res.status === 403 ? "You are not authorised to call the API."
      : res.status >= 500 ? "The server hit an error. Please try again."
      : `Request failed (${res.status}).`;
    throw new Error(detail ? `${friendly} ${detail}` : friendly);
  }
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
