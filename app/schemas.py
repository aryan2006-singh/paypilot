"""Request and response models: the public API contract."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

AgentId = Literal["payments", "refunds", "reconciliation", "fraud", "general"]


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    session_id: str | None = Field(
        default=None, pattern=r"^[A-Za-z0-9_-]{1,64}$",
        description="Conversation id. Omit to start a new conversation; reuse the returned id for follow-ups.",
    )

    @field_validator("message")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("message must not be blank")
        return v.strip()


class ChatResponse(BaseModel):
    reply: str
    agent_used: AgentId
    intent: str
    session_id: str
    message_id: str
    entity_id: str | None = None
    policy_context: str | None = None
    tool_result: dict[str, Any] | None = None
    llm_used: bool
    latency_ms: float
    created_at: float


class ConversationSummary(BaseModel):
    id: str
    title: str
    created_at: float
    updated_at: float
    message_count: int
    last_agent: AgentId | None = None


class Message(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str
    created_at: float
    agent_used: AgentId | None = None
    intent: str | None = None
    entity_id: str | None = None
    tool_result: dict[str, Any] | None = None
    policy_context: str | None = None
    llm_used: bool | None = None


class ConversationDetail(BaseModel):
    id: str
    title: str
    created_at: float
    updated_at: float
    messages: list[Message]


class AgentMeta(BaseModel):
    id: AgentId
    label: str
    color: str
    description: str
    example: str
    tools: list[str]


class Stats(BaseModel):
    total: int
    by_agent: dict[str, int]
    mock_count: int
    live_count: int
    llm_count: int
    conversations: int
    avg_latency_ms: float | None
    last_24h: int


class ActivityEntry(BaseModel):
    timestamp: float
    message: str | None
    agent_used: AgentId
    intent: str
    entity_id: str | None
    mock: bool | None
    session_id: str
    llm_used: bool
    latency_ms: float | None


class ConfigOut(BaseModel):
    razorpay_configured: bool
    razorpay_key_id_masked: str
    rag_index_ready: dict[str, bool]
    intents: list[str]
    auth_required: bool
    llm_configured: bool
    llm_model: str | None
    version: str
    environment: str


class InfoOut(BaseModel):
    name: str
    version: str
    environment: str
    llm_enabled: bool
    llm_model: str | None
    razorpay_mode: Literal["live", "demo"]
    auth_required: bool
    uptime_s: float


class PaymentSummary(BaseModel):
    id: str
    amount: int | None = None
    currency: str | None = None
    status: str | None = None
    method: str | None = None
    created_at: int | None = None


class SettlementSummary(BaseModel):
    id: str
    amount: int | None = None
    status: str | None = None
    utr: str | None = None
    created_at: int | None = None
