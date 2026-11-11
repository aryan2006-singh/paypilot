"""API key authentication and in-process rate limiting.

Auth
----
Set ``PAYPILOT_API_KEYS`` to a comma-separated list of keys. Clients send one
as ``X-API-Key: <key>`` or ``Authorization: Bearer <key>``; keys are compared
in constant time. With no keys configured the API runs in open mode (local
dev and the demo keep working with zero config). ``PAYPILOT_REQUIRE_AUTH=1``
refuses to boot without keys, which is what a public deployment should set.

Rate limiting
-------------
A sliding-window limiter keyed by API key (when authenticated) or client IP.
It lives in process memory, which is right for the single-instance Render
deploy; move it to Redis if the service is ever scaled out.
"""
from __future__ import annotations

import hashlib
import hmac
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from threading import Lock

from fastapi import Request

from app.core.config import Settings
from app.core.errors import AppError


@dataclass(frozen=True)
class Principal:
    """Who is calling. ``id`` scopes conversations and activity per caller."""

    id: str  # "key:<fingerprint>" or "anon"
    authenticated: bool


ANONYMOUS = Principal(id="anon", authenticated=False)


def fingerprint(key: str) -> str:
    """Stable, non-reversible id for a key: safe to log or store."""
    return hashlib.sha256(key.encode()).hexdigest()[:12]


class SlidingWindowLimiter:
    def __init__(self, limit: int, window_seconds: float = 60.0):
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def hit(self, bucket: str) -> tuple[bool, int, float]:
        """Record one request. Returns (allowed, remaining, retry_after_seconds)."""
        now = time.monotonic()
        with self._lock:
            q = self._hits[bucket]
            while q and now - q[0] >= self.window:
                q.popleft()
            if len(q) >= self.limit:
                return False, 0, max(0.0, self.window - (now - q[0]))
            q.append(now)
            if len(self._hits) > 10_000:  # bound memory under IP churn
                for k in [k for k, v in self._hits.items() if not v][:5_000]:
                    del self._hits[k]
            return True, self.limit - len(q), 0.0

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


class Security:
    """Auth + rate limiting state for one app instance (kept on app.state)."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.keys = settings.api_keys
        if settings.paypilot_require_auth and not self.keys:
            raise RuntimeError(
                "PAYPILOT_REQUIRE_AUTH is set but PAYPILOT_API_KEYS is empty: "
                "refusing to start an unauthenticated API."
            )
        self.chat_limiter = SlidingWindowLimiter(settings.rate_limit_chat_per_min)
        self.read_limiter = SlidingWindowLimiter(settings.rate_limit_read_per_min)
        self.auth_fail_limiter = SlidingWindowLimiter(settings.rate_limit_auth_fail_per_min)

    @property
    def enabled(self) -> bool:
        return bool(self.keys)

    def client_ip(self, request: Request) -> str:
        # Behind Render the socket peer is the proxy, so every user would share
        # one bucket. Only trust X-Forwarded-For when told we're behind one,
        # otherwise a client could spoof it to dodge the limiter.
        if self.settings.trust_proxy_headers:
            fwd = request.headers.get("x-forwarded-for")
            if fwd:
                return fwd.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    @staticmethod
    def extract_key(request: Request) -> str | None:
        key = request.headers.get("x-api-key")
        if key and key.strip():
            return key.strip()
        scheme, _, token = request.headers.get("authorization", "").partition(" ")
        if scheme.lower() == "bearer" and token.strip():
            return token.strip()
        return None

    def key_matches(self, candidate: str) -> bool:
        # Check every key (no early exit) so timing doesn't reveal which matched.
        matched = False
        for key in self.keys:
            matched |= hmac.compare_digest(candidate.encode(), key.encode())
        return matched

    def authenticate(self, request: Request) -> Principal:
        if not self.enabled:
            return ANONYMOUS
        key = self.extract_key(request)
        if not key or not self.key_matches(key):
            # Throttle bad keys per IP so a key can't be brute-forced.
            allowed, _, retry_after = self.auth_fail_limiter.hit(f"ip:{self.client_ip(request)}")
            if not allowed:
                raise AppError(429, "Too many failed authentication attempts",
                               headers={"Retry-After": str(int(retry_after) + 1)})
            raise AppError(401, "Missing or invalid API key", headers={"WWW-Authenticate": "Bearer"})
        return Principal(id=f"key:{fingerprint(key)}", authenticated=True)

    def check_rate(self, limiter: SlidingWindowLimiter, request: Request, principal: Principal) -> None:
        bucket = principal.id if principal.authenticated else f"ip:{self.client_ip(request)}"
        allowed, remaining, retry_after = limiter.hit(bucket)
        request.state.rate_limit = (limiter.limit, remaining)
        if not allowed:
            raise AppError(
                429,
                "Rate limit exceeded, please slow down",
                headers={
                    "Retry-After": str(int(retry_after) + 1),
                    "X-RateLimit-Limit": str(limiter.limit),
                    "X-RateLimit-Remaining": "0",
                },
            )
