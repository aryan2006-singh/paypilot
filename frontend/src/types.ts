export type AgentId = "payments" | "refunds" | "reconciliation" | "fraud" | "general";

export interface AgentMeta {
  id: AgentId;
  label: string;
  color: string;
  description: string;
  example: string;
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
}

export interface Stats {
  total: number;
  by_agent: Record<string, number>;
  mock_count: number;
  live_count: number;
}

export interface ActivityEntry {
  timestamp: number;
  message: string;
  agent_used: AgentId;
  intent: string;
  entity_id: string | null;
  mock: boolean | null;
  session_id: string;
}

export interface Config {
  razorpay_configured: boolean;
  razorpay_key_id_masked: string;
  rag_index_ready: Record<string, boolean>;
  intents: string[];
}
