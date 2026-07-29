"""LangGraph orchestration: intent router -> specialist agent -> reply.

Each specialist agent has access to the RAG store for policy grounding and
MCP tools for live actions (see mcp_server/tools.py).
"""
from __future__ import annotations

import json
import re
from typing import Any, Literal, TypedDict

from langgraph.graph import StateGraph, END

from rag.retriever import retrieve_context
from mcp_server.client import call_tool


async def _call_tool_json(tool_name: str, args: dict) -> dict[str, Any]:
    """call_tool returns the MCP tool's content as a JSON-encoded string (the
    stdio transport serializes structured returns to text), not a dict —
    decode it here so callers always get a plain dict."""
    raw = await call_tool(tool_name, args)
    if isinstance(raw, dict):
        return raw
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return {"error": str(raw)}


def _extract_id(message: str, prefix: str) -> str | None:
    """Pull an identifier like pay_XXXX or stl_XXXX out of free text.

    The specialist tools each expect a specific ID (payment_id / settlement_id),
    not the raw user message, so every agent below needs one of these before
    calling into mcp_server/tools.py.
    """
    match = re.search(rf"\b{re.escape(prefix)}[A-Za-z0-9]+", message)
    return match.group(0) if match else None


class PayPilotState(TypedDict):
    message: str
    session_id: str
    history: list[str]
    intent: str
    reply: str
    agent_used: str
    policy_context: str
    tool_result: dict | None
    entity_id: str | None


INTENTS = ["payments", "refunds", "reconciliation", "fraud", "general"]


async def route_intent(state: PayPilotState) -> PayPilotState:
    """Cheap keyword router for the scaffold — swap for a small classifier
    or a Claude Haiku call with structured output for production."""
    msg = state["message"].lower()
    if "refund" in msg:
        intent = "refunds"
    elif "reconcil" in msg or "settlement" in msg or "ledger" in msg:
        intent = "reconciliation"
    elif "fraud" in msg or "suspicious" in msg or "risky" in msg:
        intent = "fraud"
    elif "payment" in msg or "pay_" in msg or "transaction" in msg:
        intent = "payments"
    else:
        intent = "general"
    return {**state, "intent": intent}


async def payments_agent(state: PayPilotState) -> PayPilotState:
    context = await retrieve_context(state["message"], namespace="payments")
    payment_id = _extract_id(state["message"], "pay_")
    if payment_id is None:
        tool_result = {"error": "no payment_id (e.g. pay_XXXX) found in message"}
    else:
        tool_result = await _call_tool_json("get_payment_status", {"payment_id": payment_id})
    reply = f"Here's what I found for {payment_id or 'that payment'}."
    return {
        **state,
        "reply": reply,
        "agent_used": "payments",
        "policy_context": context,
        "tool_result": tool_result,
        "entity_id": payment_id,
    }


async def refunds_agent(state: PayPilotState) -> PayPilotState:
    context = await retrieve_context(state["message"], namespace="refunds")
    payment_id = _extract_id(state["message"], "pay_")
    if payment_id is None:
        tool_result = {"error": "no payment_id (e.g. pay_XXXX) found in message"}
    else:
        tool_result = await _call_tool_json("get_refund_status", {"payment_id": payment_id})
    reply = f"Here's the refund status for {payment_id or 'that payment'}."
    return {
        **state,
        "reply": reply,
        "agent_used": "refunds",
        "policy_context": context,
        "tool_result": tool_result,
        "entity_id": payment_id,
    }


async def reconciliation_agent(state: PayPilotState) -> PayPilotState:
    context = await retrieve_context(state["message"], namespace="reconciliation")
    settlement_id = _extract_id(state["message"], "stl_") or _extract_id(state["message"], "setl_")
    if settlement_id is None:
        tool_result = {"error": "no settlement_id (e.g. stl_XXXX) found in message"}
    else:
        tool_result = await _call_tool_json("match_settlement", {"settlement_id": settlement_id})
    reply = f"Here's the reconciliation result for {settlement_id or 'that settlement'}."
    return {
        **state,
        "reply": reply,
        "agent_used": "reconciliation",
        "policy_context": context,
        "tool_result": tool_result,
        "entity_id": settlement_id,
    }


async def fraud_agent(state: PayPilotState) -> PayPilotState:
    payment_id = _extract_id(state["message"], "pay_")
    if payment_id is None:
        tool_result = {"error": "no payment_id (e.g. pay_XXXX) found in message"}
    else:
        tool_result = await _call_tool_json("score_risk", {"payment_id": payment_id})
    reply = f"Risk assessment for {payment_id or 'that payment'}."
    return {
        **state,
        "reply": reply,
        "agent_used": "fraud",
        "policy_context": "",
        "tool_result": tool_result,
        "entity_id": payment_id,
    }


async def general_agent(state: PayPilotState) -> PayPilotState:
    context = await retrieve_context(state["message"], namespace="general")
    reply = "Here's what our policy docs say about that."
    return {
        **state,
        "reply": reply,
        "agent_used": "general",
        "policy_context": context,
        "tool_result": None,
        "entity_id": None,
    }


def _branch(state: PayPilotState) -> Literal[
    "payments", "refunds", "reconciliation", "fraud", "general"
]:
    return state["intent"]  # type: ignore[return-value]


def build_graph():
    graph = StateGraph(PayPilotState)
    graph.add_node("router", route_intent)
    graph.add_node("payments", payments_agent)
    graph.add_node("refunds", refunds_agent)
    graph.add_node("reconciliation", reconciliation_agent)
    graph.add_node("fraud", fraud_agent)
    graph.add_node("general", general_agent)

    graph.set_entry_point("router")
    graph.add_conditional_edges("router", _branch, {
        "payments": "payments",
        "refunds": "refunds",
        "reconciliation": "reconciliation",
        "fraud": "fraud",
        "general": "general",
    })
    for node in ["payments", "refunds", "reconciliation", "fraud", "general"]:
        graph.add_edge(node, END)

    return graph.compile()
