"""FastAPI dependencies: services from app.state, auth and rate limits."""
from __future__ import annotations

from fastapi import Depends, Request

from app.core.config import Settings
from app.core.security import Principal, Security
from app.services.orchestrator import ChatOrchestrator
from app.services.store import Store


def get_settings_dep(request: Request) -> Settings:
    return request.app.state.settings


def get_security(request: Request) -> Security:
    return request.app.state.security


def get_store(request: Request) -> Store:
    return request.app.state.store


def get_orchestrator(request: Request) -> ChatOrchestrator:
    return request.app.state.orchestrator


async def get_principal(request: Request) -> Principal:
    principal = get_security(request).authenticate(request)
    request.state.principal = principal
    return principal


async def chat_access(request: Request, principal: Principal = Depends(get_principal)) -> Principal:
    """Authenticated + chat rate limit (chat fans out to Razorpay and the LLM)."""
    security = get_security(request)
    security.check_rate(security.chat_limiter, request, principal)
    return principal


async def read_access(request: Request, principal: Principal = Depends(get_principal)) -> Principal:
    security = get_security(request)
    security.check_rate(security.read_limiter, request, principal)
    return principal


async def public_read(request: Request) -> None:
    """Rate limit for unauthenticated endpoints, bucketed by IP."""
    security = get_security(request)
    security.check_rate(security.read_limiter, request, Principal(id="anon", authenticated=False))
