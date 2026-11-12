import type {
  ActivityEntry,
  AgentMeta,
  ApiInfo,
  ChatResponse,
  Config,
  Conversation,
  ConversationSummary,
  PaymentRow,
  SettlementRow,
  Stats,
  StreamEvent,
} from "./types";

// Empty string means same-origin (the all-in-one FastAPI-served mode). Set
// VITE_API_URL at build time when the frontend is deployed separately from
// the backend (e.g. this on Vercel, the API on Render/Railway).
const BASE = import.meta.env.VITE_API_URL ?? "";

const KEY_STORAGE = "paypilot-api-key";

/** The API key a person entered in this browser (only used when the server has auth on). */
export const auth = {
  get(): string {
    try {
      return localStorage.getItem(KEY_STORAGE) ?? "";
    } catch {
      return "";
    }
  },
  set(key: string) {
    try {
      if (key) localStorage.setItem(KEY_STORAGE, key);
      else localStorage.removeItem(KEY_STORAGE);
    } catch {
      /* storage blocked: the key lasts until reload */
    }
    authListeners.forEach((l) => l());
  },
  subscribe(cb: () => void) {
    authListeners.add(cb);
    return () => {
      authListeners.delete(cb);
    };
  },
};
const authListeners = new Set<() => void>();

/** Fired when the API rejects our key, so the app can ask for one. */
export const UNAUTHORIZED_EVENT = "paypilot:unauthorized";

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public requestId?: string) {
    super(message);
    this.name = "ApiError";
  }
}

function request(path: string, init: RequestInit = {}, key = auth.get()): Promise<Response> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) };
  if (key) headers["X-API-Key"] = key;
  return fetch(`${BASE}${path}`, { ...init, headers });
}

/** Turns a failed response into a short, human-readable error message. */
async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let code: string | undefined;
    let requestId: string | undefined = res.headers.get("X-Request-ID") ?? undefined;
    let detail = "";
    try {
      const body = await res.text();
      try {
        const parsed = JSON.parse(body);
        detail = typeof parsed.detail === "string" ? parsed.detail : JSON.stringify(parsed.detail ?? parsed);
        code = typeof parsed.code === "string" ? parsed.code : undefined;
        requestId = typeof parsed.request_id === "string" ? parsed.request_id : requestId;
      } catch {
        detail = body.slice(0, 200);
      }
    } catch {
      /* ignore */
    }
    if (res.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    const retry = res.headers.get("Retry-After");
    const friendly =
      res.status === 429 ? `Too many requests. Try again in ${retry ? `${retry}s` : "a moment"}.`
      : res.status === 401 ? "This server needs an API key. Add yours in Settings."
      : res.status === 403 ? "Your API key isn't allowed to do that."
      : res.status === 404 ? "Not found."
      : res.status >= 500 ? "The server hit an error. Please try again."
      : `Request failed (${res.status}).`;
    // 401/429 already say everything useful; avoid repeating the server's wording.
    const message = detail && res.status !== 401 && res.status !== 429 && detail.toLowerCase() !== "not found" && detail !== friendly ? `${friendly} ${detail}` : friendly;
    throw new ApiError(message, res.status, code, requestId);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/**
 * POST /chat/stream and hand each server-sent event to `onEvent` as it
 * arrives. EventSource only supports GET, so this reads the response body
 * directly. Resolves when the stream ends; rejects on HTTP/network errors or
 * when `signal` aborts (the error's name is then "AbortError").
 */
async function chatStream(
  message: string,
  sessionId: string | null,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await request("/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ message, session_id: sessionId }),
    signal,
  });
  if (!res.ok) await json(res); // throws the friendly error
  if (!res.body) throw new Error("The server returned an empty response.");

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  const flush = (block: string) => {
    // An SSE event is one or more "data:" lines; other fields are ignored.
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""))
      .join("\n");
    if (data) onEvent(JSON.parse(data) as StreamEvent);
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? "";
    blocks.forEach(flush);
  }
  if (buffer.trim()) flush(buffer);
}

export const api = {
  health: () => fetch(`${BASE}/health`, { cache: "no-store" }).then((r) => r.ok),

  /** Public: version, LLM and Razorpay mode, whether a key is needed. */
  info: () => request("/api/info").then((r) => json<ApiInfo>(r)),

  authStatus: () => request("/api/auth/status").then((r) => json<{ auth_required: boolean }>(r)),

  /** Resolves true if `key` is accepted, false if rejected. */
  checkKey: (key: string) =>
    request("/api/auth/check", {}, key).then(async (r) => {
      if (r.status === 401 || r.status === 403) return false;
      await json(r);
      return true;
    }),

  agents: () => request("/api/agents").then((r) => json<AgentMeta[]>(r)),

  stats: () => request("/api/stats").then((r) => json<Stats>(r)),

  activity: (limit = 20) => request(`/api/activity?limit=${limit}`).then((r) => json<ActivityEntry[]>(r)),

  config: () => request("/api/config").then((r) => json<Config>(r)),

  /** Real Razorpay records. Rejects with ApiError code "razorpay_not_configured" in demo mode. */
  payments: (limit = 10) => request(`/api/payments?limit=${limit}`).then((r) => json<PaymentRow[]>(r)),

  settlements: (limit = 10) => request(`/api/settlements?limit=${limit}`).then((r) => json<SettlementRow[]>(r)),

  conversations: (limit = 50) => request(`/api/conversations?limit=${limit}`).then((r) => json<ConversationSummary[]>(r)),

  conversation: (id: string) => request(`/api/conversations/${encodeURIComponent(id)}`).then((r) => json<Conversation>(r)),

  deleteConversation: (id: string) =>
    request(`/api/conversations/${encodeURIComponent(id)}`, { method: "DELETE" }).then((r) => json<void>(r)),

  chat: (message: string, sessionId: string | null) =>
    request("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, session_id: sessionId }),
    }).then((r) => json<ChatResponse>(r)),

  chatStream,
};
