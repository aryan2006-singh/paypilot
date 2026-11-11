"""Runs one chat turn end to end and reports progress as events.

    memory -> route -> specialist agent (policy + tool) -> reply writer -> persist

``stream()`` yields the same typed events ``/chat/stream`` sends over SSE;
``run()`` drains them for the plain JSON ``/chat`` endpoint, so both paths
execute exactly the same code.
"""
from __future__ import annotations

import logging
import time
from collections.abc import AsyncIterator
from typing import Any

from app.agents.base import AgentContext
from app.agents.router import PAYMENT_RE, SETTLEMENT_RE, ConversationState, route
from app.agents.specialists import AGENTS
from app.agents.tools import PaymentTools
from app.core.config import Settings
from app.core.errors import AppError
from app.core.security import Principal
from app.services.llm import ReplyWriter, WriteResult
from app.services.store import Store, StoredTurn, new_id
from rag import retriever

log = logging.getLogger("paypilot.chat")

ROUTER_LABEL = "Understanding your request"
WRITER_LABEL = "Writing the answer"


def conversation_state(turns: list[StoredTurn]) -> ConversationState:
    """What earlier turns tell us: the last intent and the last ids mentioned."""
    last_intent = last_pay = last_stl = None
    for t in turns:
        if t.role == "assistant" and t.intent:
            last_intent = t.intent
        for text in (t.content, t.entity_id or ""):
            if m := PAYMENT_RE.search(text):
                last_pay = m.group(0)
            if m := SETTLEMENT_RE.search(text):
                last_stl = m.group(0)
        if t.entity_id:  # the entity an agent actually acted on wins over mentions
            if t.entity_id.startswith("pay_"):
                last_pay = t.entity_id
            else:
                last_stl = t.entity_id
    return ConversationState(last_intent=last_intent, last_payment_id=last_pay, last_settlement_id=last_stl)


class ChatOrchestrator:
    def __init__(self, settings: Settings, store: Store, tools: PaymentTools, writer: ReplyWriter):
        self.settings = settings
        self.store = store
        self.tools = tools
        self.writer = writer

    @staticmethod
    def _retrieve(query: str, namespace: str) -> list[str]:
        return retriever.search(query, namespace, k=3)

    async def prepare(self, message: str, session_id: str | None, principal: Principal) -> str:
        """Resolve (or create) the conversation before any streaming starts, so
        ownership errors become a normal HTTP error instead of a broken stream."""
        conversation_id = session_id or new_id("conv")
        if not await self.store.ensure_conversation(conversation_id, principal.id, message):
            raise AppError(404, "Conversation not found")
        return conversation_id

    async def stream(self, message: str, conversation_id: str) -> AsyncIterator[dict[str, Any]]:
        started = time.perf_counter()
        running: tuple[str, str] | None = ("router", ROUTER_LABEL)
        try:
            yield {"type": "step", "id": "router", "label": ROUTER_LABEL, "status": "running"}
            history = await self.store.recent_turns(conversation_id, max(self.settings.history_turns, 6))
            decision = route(message, conversation_state(history))
            agent = AGENTS[decision.intent]
            yield {"type": "step", "id": "router", "label": ROUTER_LABEL, "status": "done",
                   "detail": f"Routed to {agent.info.label}: {decision.reason}"}
            yield {"type": "meta", "agent_used": decision.intent, "intent": decision.intent,
                   "entity_id": decision.entity_id, "session_id": conversation_id}

            running = (agent.info.id, agent.info.work_label)
            yield {"type": "step", "id": agent.info.id, "label": agent.info.work_label, "status": "running"}
            result = await agent.run(AgentContext(message=message, entity_id=decision.entity_id,
                                                  tools=self.tools, retrieve=self._retrieve))
            yield {"type": "step", "id": agent.info.id, "label": agent.info.work_label, "status": "done",
                   "detail": result.summary()}

            if self.writer.enabled:
                running = ("writer", WRITER_LABEL)
                yield {"type": "step", "id": "writer", "label": WRITER_LABEL, "status": "running"}
            written = WriteResult(text="", llm_used=False)
            llm_history = history[-self.settings.history_turns:] if self.settings.history_turns else []
            async for chunk in self.writer.stream(message, decision.intent, result, llm_history, written):
                yield {"type": "token", "text": chunk}
            if self.writer.enabled:
                yield {"type": "step", "id": "writer", "label": WRITER_LABEL, "status": "done",
                       "detail": f"Written by {self.writer.model}" if written.llm_used else "Used the agent's answer"}
            running = None

            latency_ms = round((time.perf_counter() - started) * 1000, 1)
            response = {
                "reply": written.text,
                "agent_used": decision.intent,
                "intent": decision.intent,
                "session_id": conversation_id,
                "entity_id": result.entity_id,
                "policy_context": result.policy_context,
                "tool_result": result.tool_result,
                "llm_used": written.llm_used,
                "latency_ms": latency_ms,
            }
            response["message_id"] = await self.store.add_exchange(conversation_id, message, response)
            response["created_at"] = time.time()
            log.info("chat turn", extra={"agent": decision.intent, "entity": result.entity_id,
                                         "llm_used": written.llm_used, "latency_ms": latency_ms})
            yield {"type": "done", "response": response}
        except Exception as exc:  # surfaced to the client instead of a silently dropped stream
            log.exception("chat turn failed")
            if running:
                yield {"type": "step", "id": running[0], "label": running[1], "status": "error"}
            yield {"type": "error", "message": "Something went wrong while answering. Please try again.",
                   "code": "internal_error", "error": type(exc).__name__}

    async def run(self, message: str, conversation_id: str) -> dict[str, Any]:
        async for event in self.stream(message, conversation_id):
            if event["type"] == "done":
                return event["response"]
            if event["type"] == "error":
                raise AppError(500, event["message"])
        raise AppError(500, "The chat run ended without a reply")
