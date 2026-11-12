"""Shared types for the specialist agents."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol

from app.agents.tools import PaymentTools


@dataclass(frozen=True)
class AgentInfo:
    id: str
    label: str
    color: str
    description: str
    example: str
    work_label: str  # shown as the live "working" step in the chat UI
    tools: tuple[str, ...] = ()
    namespace: str | None = None  # RAG policy namespace, if any


@dataclass
class AgentContext:
    message: str
    entity_id: str | None
    tools: PaymentTools
    retrieve: Any  # callable(query, namespace) -> list[str]


@dataclass
class AgentResult:
    agent_id: str
    entity_id: str | None
    tool_name: str | None = None
    tool_result: dict | None = None
    policy_passages: list[str] = field(default_factory=list)
    # Deterministic reply used when no LLM is configured (or it fails).
    fallback_reply: str = ""

    @property
    def policy_context(self) -> str | None:
        return "\n---\n".join(self.policy_passages) or None

    def summary(self) -> str:
        """One line describing what the agent found, for its completed step."""
        parts = []
        if self.policy_passages:
            parts.append(f"{len(self.policy_passages)} policy passage(s)")
        tool = self.tool_result
        if tool:
            if tool.get("error"):
                parts.append(f"tool: {tool['error']}")
            elif tool.get("mock"):
                parts.append("demo data")
            else:
                parts.append("live Razorpay data")
        return ", ".join(parts) or "done"


class Agent(Protocol):
    info: AgentInfo

    async def run(self, ctx: AgentContext) -> AgentResult: ...
