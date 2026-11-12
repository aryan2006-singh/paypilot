"""Health, info, config, agents, auth status, stats and activity."""
from __future__ import annotations

import time

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse

from app import __version__
from app.agents import AGENTS, INTENTS
from app.api.deps import get_settings_dep, get_store, public_read, read_access
from app.core.config import Settings
from app.core.security import Principal
from app.schemas import ActivityEntry, AgentMeta, ConfigOut, InfoOut, Stats
from app.services.store import Store
from rag.retriever import index_exists

router = APIRouter(tags=["system"])


@router.get("/health")
async def health():
    """Liveness probe used by Render. Cheap on purpose."""
    return {"status": "ok"}


@router.get("/api/health")
async def health_detail(request: Request, store: Store = Depends(get_store)):
    """Readiness: checks the database too. 503 when something is down."""
    db_ok = await store.ping()
    body = {
        "status": "ok" if db_ok else "degraded",
        "version": __version__,
        "checks": {"database": db_ok, "llm": request.app.state.writer.enabled},
    }
    return JSONResponse(body, status_code=200 if db_ok else 503)


@router.get("/api/info", response_model=InfoOut, dependencies=[Depends(public_read)])
async def info(request: Request, settings: Settings = Depends(get_settings_dep)):
    writer = request.app.state.writer
    return InfoOut(
        name="PayPilot",
        version=__version__,
        environment=settings.environment,
        llm_enabled=writer.enabled,
        llm_model=writer.model if writer.enabled else None,
        razorpay_mode="live" if settings.razorpay_configured else "demo",
        auth_required=request.app.state.security.enabled,
        uptime_s=round(time.monotonic() - request.app.state.started_at, 1),
    )


@router.get("/api/auth/status", dependencies=[Depends(public_read)])
async def auth_status(request: Request):
    """Public: lets the UI decide whether to ask for an API key."""
    return {"auth_required": request.app.state.security.enabled}


@router.get("/api/auth/check")
async def auth_check(principal: Principal = Depends(read_access)):
    """Validates the supplied key (401 if wrong). Used by the UI's sign-in."""
    return {"ok": True, "authenticated": principal.authenticated}


@router.get("/api/agents", response_model=list[AgentMeta], dependencies=[Depends(public_read)])
async def list_agents():
    return [
        AgentMeta(id=a.info.id, label=a.info.label, color=a.info.color, description=a.info.description,
                  example=a.info.example, tools=list(a.info.tools))
        for a in AGENTS.values()
    ]


@router.get("/api/stats", response_model=Stats, dependencies=[Depends(read_access)])
async def stats(store: Store = Depends(get_store)):
    return await store.stats(list(AGENTS))


@router.get("/api/activity", response_model=list[ActivityEntry])
async def activity(
    limit: int = Query(20, ge=0, le=200),
    principal: Principal = Depends(read_access),
    store: Store = Depends(get_store),
):
    """Recent chat turns. With auth on, callers only see their own activity."""
    if limit == 0:
        return []
    owner = principal.id if principal.authenticated else None
    return await store.activity(limit, owner)


@router.get("/api/config", response_model=ConfigOut, dependencies=[Depends(read_access)])
async def config(request: Request, settings: Settings = Depends(get_settings_dep)):
    writer = request.app.state.writer
    return ConfigOut(
        razorpay_configured=settings.razorpay_configured,
        razorpay_key_id_masked=settings.razorpay_key_id_masked,
        rag_index_ready={a.info.namespace: index_exists(a.info.namespace)
                         for a in AGENTS.values() if a.info.namespace},
        intents=INTENTS,
        auth_required=request.app.state.security.enabled,
        llm_configured=writer.enabled,
        llm_model=writer.model if writer.enabled else None,
        version=__version__,
        environment=settings.environment,
    )
