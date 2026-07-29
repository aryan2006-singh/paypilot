"""FastAPI entrypoint for PayPilot.

Demonstrates: async endpoints, Pydantic v2 validation, streaming responses,
and dependency injection for the agent graph (closes the FastAPI gap).
"""
from __future__ import annotations

import json
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


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, graph=Depends(get_graph)) -> ChatResponse:
    state: PayPilotState = {
        "message": req.message,
        "session_id": req.session_id or "anon",
        "history": [],
    }
    result = await graph.ainvoke(state)
    tool_result = result.get("tool_result")
    ACTIVITY_LOG.appendleft({
        "timestamp": time.time(),
        "message": req.message[:200],
        "agent_used": result["agent_used"],
        "intent": result["intent"],
        "entity_id": result.get("entity_id"),
        "mock": bool(tool_result.get("mock")) if tool_result else None,
        "session_id": state["session_id"],
    })
    return ChatResponse(
        reply=result["reply"],
        agent_used=result["agent_used"],
        session_id=state["session_id"],
        intent=result["intent"],
        policy_context=result.get("policy_context"),
        tool_result=tool_result,
        entity_id=result.get("entity_id"),
    )


@app.post("/chat/stream")
async def chat_stream(req: ChatRequest, graph=Depends(get_graph)):
    """Streams intermediate agent steps as SSE — shows the routing decision live."""

    async def event_gen():
        state: PayPilotState = {
            "message": req.message,
            "session_id": req.session_id or "anon",
            "history": [],
        }
        async for chunk in graph.astream(state):
            for node_name, node_output in chunk.items():
                yield f"data: {json.dumps({'node': node_name, 'output': node_output})}\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream")


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
