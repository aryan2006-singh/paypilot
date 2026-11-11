export type AgentId = "payments" | "refunds" | "reconciliation" | "fraud" | "general";

export interface AgentMeta {
  id: AgentId;
  label: string;
  color: string;
  description: string;
  example: string;
  tools?: string[];
}

export interface ToolResult {
  error?: string;
  mock?: boolean;
  fallback_reason?: string;
  [key: string]: unknown;
}

export interface ChatResponse {
  reply: string;
  agent_used: AgentId;
  session_id: string;
  intent: string;
  policy_context: string | null;
  tool_result: ToolResult | null;
  entity_id: string | null;
  message_id?: string;
  llm_used?: boolean;
  latency_ms?: number;
  created_at?: number;
}

export interface Stats {
  total: number;
  by_agent: Record<string, number>;
  mock_count: number;
  live_count: number;
  llm_count?: number;
  conversations?: number;
  avg_latency_ms?: number | null;
  last_24h?: number;
}

export interface ActivityEntry {
  timestamp: number;
  message: string;
  agent_used: AgentId;
  intent: string;
  entity_id: string | null;
  mock: boolean | null;
  session_id: string;
  llm_used?: boolean;
  latency_ms?: number;
}

export interface Config {
  razorpay_configured: boolean;
  razorpay_key_id_masked: string;
  rag_index_ready: Record<string, boolean>;
  intents: string[];
  auth_required?: boolean;
  llm_configured?: boolean;
  llm_model?: string | null;
  version?: string;
  environment?: string;
}

export interface ApiInfo {
  name: string;
  version: string;
  environment: string;
  llm_enabled: boolean;
  llm_model: string | null;
  razorpay_mode: "live" | "demo";
  auth_required: boolean;
  uptime_s: number;
}

export interface ConversationSummary {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  message_count: number;
  last_agent: AgentId | null;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: number;
  agent_used: AgentId | null;
  intent: string | null;
  entity_id: string | null;
  tool_result: ToolResult | null;
  policy_context: string | null;
  llm_used: boolean | null;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  messages: ConversationMessage[];
}

export type StepStatus = "running" | "done" | "error";

export interface AgentStep {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
}

/** One server-sent event from POST /chat/stream (see app/main.py). */
export type StreamEvent =
  | ({ type: "step" } & AgentStep)
  | { type: "meta"; agent_used: AgentId; intent: string; entity_id: string | null; session_id?: string }
  | { type: "token"; text: string }
  | { type: "done"; response: ChatResponse }
  | { type: "error"; message: string; code?: string };

export interface PaymentRow {
  id: string;
  amount: number; // paise
  currency: string;
  status: string;
  method: string | null;
  created_at: number;
}

export interface SettlementRow {
  id: string;
  amount: number;
  status: string;
  utr: string | null;
  created_at: number;
}
