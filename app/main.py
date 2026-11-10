"""FastAPI entrypoint for PayPilot.

Demonstrates: async endpoints, Pydantic v2 validation, streaming responses,
and dependency injection for the agent graph (closes the FastAPI gap).
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from collections import deque
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

load_dotenv()  # must run before mcp_server.tools reads RAZORPAY_* env vars below

from agents.graph import build_graph, PayPilotState, INTENTS
from mcp_server.tools import _is_configured
from rag.retriever import index_exists

# Built by `npm run build` in frontend/ — lives one level up from app/ so both
# this all-in-one FastAPI serving mode (local dev, Docker) and a separately
# deployed frontend (Vercel) build from the same frontend/ project untouched.
FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"

app = FastAPI(title="PayPilot", version="0.1.0")

# Needed when the frontend is deployed separately (e.g. Vercel) from this API
# (e.g. Render/Railway) — same-origin deployments ignore CORS entirely, so
# this is a no-op for the bundled all-in-one mode. Comma-separated origins;
# defaults cover local dev (Vite proxy doesn't need this, but `vite preview`
# and the dev server calling a locally-run backend directly do).
_allowed_origins = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _allowed_origins if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory activity log for the dashboard — a real deployment would back this
# with a database, but for a single-process demo a bounded deque is enough to
# drive "recent activity" and per-agent counts without adding infra.
ACTIVITY_LOG: deque[dict] = deque(maxlen=200)

AGENT_META = {
    "payments": {
        "label": "Payments",
        "color": "#2a78d6",
        "description": "Looks up live payment status (created / authorized / captured / failed) via the Razorpay MCP tool, grounded in payment lifecycle policy.",
        "example": "Why did payment pay_XYZ789 fail?",
    },
    "refunds": {
        "label": "Refunds",
        "color": "#eb6834",
        "description": "Checks refund records for a payment and explains timelines against refund policy docs.",
        "example": "Where is my refund for pay_ABC123?",
    },
    "reconciliation": {
        "label": "Reconciliation",
        "color": "#1baf7a",
        "description": "Matches settlements against the internal ledger for finance/ops reconciliation.",
        "example": "Does settlement stl_44 match our ledger?",
    },
    "fraud": {
        "label": "Fraud",
        "color": "#eda100",
        "description": "Runs a rule-based risk score (amount, international card, CVV) and flags payments for review.",
        "example": "This transaction pay_ABC123 looks suspicious, can you check it?",
    },
    "general": {
        "label": "General",
        "color": "#e87ba4",
        "description": "Falls back to general support policy (business hours, escalation) when no other intent matches.",
        "example": "What are your business hours?",
    },
}


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    session_id: str | None = Field(default=None, description="Conversation memory key")


class ChatResponse(BaseModel):
    reply: str
    agent_used: str
    session_id: str
    intent: str
    policy_context: str | None = None
    tool_result: dict | None = None
    entity_id: str | None = None


@lru_cache
def get_graph():
    """Compiled once, reused across requests (dependency injection pattern)."""
    return build_graph()


def _log_activity(message: str, session_id: str, result: dict) -> None:
    tool_result = result.get("tool_result")
    ACTIVITY_LOG.appendleft({
        "timestamp": time.time(),
        "message": message[:200],
        "agent_used": result["agent_used"],
        "intent": result["intent"],
        "entity_id": result.get("entity_id"),
        "mock": bool(tool_result.get("mock")) if tool_result else None,
        "session_id": session_id,
    })


def _to_response(result: dict, session_id: str) -> ChatResponse:
    return ChatResponse(
        reply=result["reply"],
        agent_used=result["agent_used"],
        session_id=session_id,
        intent=result["intent"],
        policy_context=result.get("policy_context"),
        tool_result=result.get("tool_result"),
        entity_id=result.get("entity_id"),
    )


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, graph=Depends(get_graph)) -> ChatResponse:
    state: PayPilotState = {
        "message": req.message,
        "session_id": req.session_id or "anon",
        "history": [],
    }
    result = await graph.ainvoke(state)
    _log_activity(req.message, state["session_id"], result)
    return _to_response(result, state["session_id"])


_ROUTER_LABEL = "Classifying your request"

# What each specialist does while it runs, shown as the live "working" step
# in the chat UI until the node returns.
_AGENT_WORK = {
    "payments": "Checking payment policy and live payment status",
    "refunds": "Checking refund policy and refund records",
    "reconciliation": "Checking reconciliation policy and matching the settlement",
    "fraud": "Running the risk-scoring rules",
    "general": "Searching the support policy",
}

# Small pause between reply chunks so the reply visibly streams in. The
# specialists build their reply from a template today; when an LLM writes the
# reply instead, forward its token stream here and drop the delay.
_TOKEN_DELAY_S = 0.02


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event, default=str)}\n\n"


def _agent_summary(output: dict) -> str:
    """One line describing what a specialist found, for its completed step."""
    tool = output.get("tool_result")
    parts = []
    if output.get("policy_context"):
        parts.append("policy found")
    if tool:
        if tool.get("error"):
            parts.append(f"tool: {tool['error']}")
        elif tool.get("mock"):
            parts.append("tool returned demo data")
        else:
            parts.append("live tool result")
    return ", ".join(parts) or "done"


@app.post("/chat/stream")
async def chat_stream(req: ChatRequest, graph=Depends(get_graph)):
    """Streams the agent run as server-sent events.

    Each event is a JSON object with a `type`:
      step   {id, label, status: running|done|error, detail?}  agent progress
      meta   {agent_used, intent, entity_id}                    routing result
      token  {text}                                             reply chunk
      done   {response: ChatResponse}                           final payload
      error  {message}                                          run failed
    """

    async def event_gen():
        session_id = req.session_id or "anon"
        state: PayPilotState = {
            "message": req.message,
            "session_id": session_id,
            "history": [],
        }
        final: dict = {}
        running: tuple[str, str] | None = ("router", _ROUTER_LABEL)
        try:
            yield _sse({"type": "step", "id": "router", "label": _ROUTER_LABEL, "status": "running"})
            async for chunk in graph.astream(state):
                for node_name, output in chunk.items():
                    final.update(output)
                    if node_name == "router":
                        intent = output["intent"]
                        yield _sse({"type": "step", "id": "router", "label": _ROUTER_LABEL,
                                    "status": "done", "detail": f"Routed to {intent}"})
                        yield _sse({"type": "meta", "agent_used": intent, "intent": intent, "entity_id": None})
                        running = (intent, _AGENT_WORK.get(intent, "Working"))
                        yield _sse({"type": "step", "id": running[0], "label": running[1], "status": "running"})
                    else:
                        running = None
                        yield _sse({"type": "step", "id": node_name, "label": _AGENT_WORK.get(node_name, "Working"),
                                    "status": "done", "detail": _agent_summary(output)})
                        yield _sse({"type": "meta", "agent_used": output["agent_used"],
                                    "intent": final.get("intent", node_name), "entity_id": output.get("entity_id")})

            words = final.get("reply", "").split(" ")
            for i, word in enumerate(words):
                yield _sse({"type": "token", "text": word if i == 0 else " " + word})
                await asyncio.sleep(_TOKEN_DELAY_S)

            _log_activity(req.message, session_id, final)
            yield _sse({"type": "done", "response": _to_response(final, session_id).model_dump()})
        except Exception as exc:  # surfaced to the UI instead of a silently dropped stream
            logging.getLogger(__name__).exception("chat stream failed")
            if running:
                yield _sse({"type": "step", "id": running[0], "label": running[1], "status": "error"})
            yield _sse({"type": "error", "message": f"{type(exc).__name__}: {exc}"})

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        # Stops proxies (nginx, Render's edge) from buffering the whole stream.
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/agents")
async def list_agents():
    return [{"id": agent_id, **meta} for agent_id, meta in AGENT_META.items()]


@app.get("/api/stats")
async def stats():
    by_agent = {agent_id: 0 for agent_id in AGENT_META}
    mock_count = 0
    live_count = 0
    for entry in ACTIVITY_LOG:
        by_agent[entry["agent_used"]] = by_agent.get(entry["agent_used"], 0) + 1
        if entry["mock"] is True:
            mock_count += 1
        elif entry["mock"] is False:
            live_count += 1
    return {
        "total": len(ACTIVITY_LOG),
        "by_agent": by_agent,
        "mock_count": mock_count,
        "live_count": live_count,
    }


@app.get("/api/activity")
async def activity(limit: int = 20):
    return list(ACTIVITY_LOG)[: max(0, min(limit, 200))]


@app.get("/api/config")
async def config():
    rag_status = {
        namespace: index_exists(namespace)
        for namespace in AGENT_META
        if namespace != "fraud"  # fraud agent has no RAG namespace
    }
    key_id = os.environ.get("RAZORPAY_KEY_ID", "")
    masked = f"{key_id[:8]}…{key_id[-4:]}" if len(key_id) > 12 else (key_id or "(not set)")
    return {
        "razorpay_configured": _is_configured(),
        "razorpay_key_id_masked": masked,
        "rag_index_ready": rag_status,
        "intents": INTENTS,
    }


# Registered last so it only catches requests that don't match an API route
# above. The SPA uses hash-based routing (#/chat, #/agents, …), so the
# browser only ever requests "/" from the server — no server-side catch-all
# for client routes is needed.
#
# Mounted conditionally: StaticFiles raises at construction if the directory
# is absent, which would take down the whole API. frontend/dist is a build
# artifact (gitignored), so it is legitimately missing whenever the frontend
# is deployed separately or the build step hasn't run — degrade to an
# API-only service with a diagnostic at "/" instead of failing to boot.
if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="spa")
else:
    @app.get("/")
    async def missing_frontend():
        return {
            "status": "api-only",
            "detail": (
                "Frontend build not found at frontend/dist. Run "
                "`npm ci && npm run build` in frontend/ to serve the UI from "
                "this service, or point a separately deployed frontend at "
                "this API."
            ),
            "api": ["/health", "/chat", "/chat/stream", "/api/agents", "/api/stats", "/api/activity", "/api/config"],
        }
