"""HTTP middleware: request ids, access logging, security headers, rate-limit headers."""
from __future__ import annotations

import logging
import re
import time
import uuid

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.logging import request_id_var

log = logging.getLogger("paypilot.http")

_SAFE_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")

_SECURITY_HEADERS = {
    b"x-content-type-options": b"nosniff",
    b"x-frame-options": b"DENY",
    b"referrer-policy": b"strict-origin-when-cross-origin",
    b"permissions-policy": b"camera=(), microphone=(), geolocation=()",
}


class RequestContextMiddleware:
    """Pure ASGI (not BaseHTTPMiddleware) so streaming responses aren't buffered."""

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        incoming = dict(scope["headers"]).get(b"x-request-id", b"").decode("latin-1")
        request_id = incoming if _SAFE_ID.match(incoming) else uuid.uuid4().hex[:16]
        token = request_id_var.set(request_id)
        start = time.perf_counter()
        status = 500

        async def send_wrapper(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                headers = list(message.get("headers", []))
                existing = {k.lower() for k, _ in headers}
                headers.append((b"x-request-id", request_id.encode()))
                for k, v in _SECURITY_HEADERS.items():
                    if k not in existing:
                        headers.append((k, v))
                rate = scope.get("state", {}).get("rate_limit")
                if rate:
                    headers.append((b"x-ratelimit-limit", str(rate[0]).encode()))
                    headers.append((b"x-ratelimit-remaining", str(rate[1]).encode()))
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            path = scope.get("path", "")
            if path != "/health":  # health checks every few seconds would drown the log
                log.info(
                    "%s %s %s",
                    scope.get("method"), path, status,
                    extra={"status": status, "duration_ms": round((time.perf_counter() - start) * 1000, 1)},
                )
            request_id_var.reset(token)
