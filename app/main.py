"""PayPilot API: application factory and ASGI entrypoint (``app.main:app``)."""
from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app import __version__
from app.agents.tools import PaymentTools
from app.api.routes import chat, conversations, payments, system
from app.core.config import Settings, get_settings
from app.core.errors import register_error_handlers
from app.core.logging import configure_logging
from app.core.middleware import RequestContextMiddleware
from app.core.security import Security
from app.integrations.ledger import Ledger
from app.integrations.razorpay import RazorpayClient
from app.services.llm import ReplyWriter
from app.services.orchestrator import ChatOrchestrator
from app.services.store import Store

log = logging.getLogger("paypilot")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level, settings.log_json)
    security = Security(settings)  # raises early if auth is required but unset

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        store = Store(settings.database_path)
        razorpay = RazorpayClient(
            settings.razorpay_key_id, settings.razorpay_key_secret,
            configured=settings.razorpay_configured,
            base_url=settings.razorpay_base_url, timeout_s=settings.razorpay_timeout_s,
        )
        writer = ReplyWriter(settings)
        app.state.store = store
        app.state.razorpay = razorpay
        app.state.writer = writer
        app.state.orchestrator = ChatOrchestrator(
            settings, store, PaymentTools(razorpay, Ledger(settings.resolved_ledger_path)), writer
        )
        app.state.started_at = time.monotonic()
        log.info(
            "PayPilot started",
            extra={"version": __version__, "environment": settings.environment,
                   "auth": security.enabled, "razorpay": razorpay.mode,
                   "llm": writer.model if writer.enabled else None},
        )
        if not security.enabled:
            log.warning("PAYPILOT_API_KEYS is not set: the API is running WITHOUT authentication.")
        try:
            yield
        finally:
            await razorpay.aclose()
            await writer.aclose()
            store.close()

    app = FastAPI(
        title="PayPilot API",
        version=__version__,
        description="Multi-agent payments operations assistant: payments, refunds, "
                    "reconciliation and fraud triage over Razorpay.",
        lifespan=lifespan,
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url="/api/openapi.json",
    )
    app.state.settings = settings
    app.state.security = security

    register_error_handlers(app)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-API-Key", "Authorization", "X-Request-ID"],
        expose_headers=["X-Request-ID", "Retry-After", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
    )
    app.add_middleware(RequestContextMiddleware)

    app.include_router(system.router)
    app.include_router(chat.router)
    app.include_router(conversations.router)
    app.include_router(payments.router)

    # Registered last so it only catches paths no API route matched. The SPA
    # uses hash routing, so the browser only ever requests "/" and assets.
    # frontend/dist is a build artifact; without it the API still boots.
    if settings.frontend_dist.is_dir():
        app.mount("/", StaticFiles(directory=settings.frontend_dist, html=True), name="spa")
    else:
        @app.get("/", include_in_schema=False)
        async def api_only():
            return {
                "status": "api-only",
                "detail": "Frontend build not found at frontend/dist. Run `npm ci && npm run build` "
                          "in frontend/ to serve the UI from this service.",
                "docs": "/api/docs",
            }

    return app


app = create_app()
