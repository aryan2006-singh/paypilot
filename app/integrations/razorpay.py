"""Razorpay API client with a deterministic demo fallback.

With real keys every call goes to Razorpay (test or live mode, whichever the
keys belong to), and a failed call is reported as a ``RazorpayError``: real
mode never invents data. Without keys the client returns demo data shaped
exactly like Razorpay's own entities, so the rest of the app runs the same
code either way. Every result carries ``mock: bool``.
"""
from __future__ import annotations

import hashlib
import logging
import re
from typing import Any

import httpx

log = logging.getLogger("paypilot.razorpay")

# IDs are interpolated into URL paths, so anything that isn't a plain prefixed
# alphanumeric id is rejected before it gets near the network (blocks path
# traversal like "pay_x/../../settlements").
PAYMENT_ID = re.compile(r"^pay_[A-Za-z0-9]{1,40}$")
SETTLEMENT_ID = re.compile(r"^(stl|setl|setlmnt)_[A-Za-z0-9]{1,40}$")


class InvalidIdError(ValueError):
    pass


def validate_payment_id(value: str) -> str:
    if not isinstance(value, str) or not PAYMENT_ID.match(value):
        raise InvalidIdError("invalid payment id: expected something like pay_XXXX")
    return value


def validate_settlement_id(value: str) -> str:
    if not isinstance(value, str) or not SETTLEMENT_ID.match(value):
        raise InvalidIdError("invalid settlement id: expected something like stl_XXXX")
    return value


def _seed(*parts: str) -> int:
    return int(hashlib.sha256("|".join(parts).encode()).hexdigest(), 16)


# --- Demo data --------------------------------------------------------------

def mock_payment(payment_id: str) -> dict[str, Any]:
    h = _seed(payment_id)
    status = ["captured", "authorized", "failed", "refunded"][h % 4]
    method = ["card", "upi", "netbanking", "wallet"][(h // 7) % 4]
    # Mostly everyday amounts, with a long tail of large ones so the
    # high-value fraud rules are reachable in demo mode.
    amount = 10_000 + (h % 490_000) if h % 5 else 2_000_000 + (h % 30_000_000)
    international = h % 11 == 0
    data: dict[str, Any] = {
        "id": payment_id,
        "entity": "payment",
        "status": status,
        "amount": amount,
        "currency": "INR",
        "method": method,
        "international": international,
        "amount_refunded": amount if status == "refunded" else 0,
        "created_at": 1_760_000_000 + (h % 5_000_000),
    }
    if method == "card":
        data["card"] = {"type": ["credit", "debit", "prepaid"][(h // 13) % 3], "international": international}
    if status == "failed":
        data["error_reason"] = ["payment_failed", "payment_risk_check_failed", "payment_timed_out"][(h // 17) % 3]
    data["mock"] = True
    return data


def mock_refunds(payment_id: str) -> dict[str, Any]:
    """Refunds consistent with mock_payment: a refunded payment has a full
    refund, a failed one has none, a captured one sometimes has partials."""
    payment = mock_payment(payment_id)
    h = _seed(payment_id, "refund")
    if payment["status"] == "refunded":
        amounts = [payment["amount"]]
    elif payment["status"] == "captured" and h % 3:
        amounts = [max(100, payment["amount"] // (2 + i)) for i in range(h % 3)][:1]
    else:
        amounts = []
    items = [
        {
            "id": f"rfnd_{h % 99999:05d}{i}",
            "entity": "refund",
            "payment_id": payment_id,
            "amount": amount,
            "currency": "INR",
            "status": "processed" if (h + i) % 2 == 0 or payment["status"] == "refunded" else "pending",
            "speed_processed": "normal",
            "created_at": payment["created_at"] + 86_400 * (1 + i),
        }
        for i, amount in enumerate(amounts)
    ]
    return {"entity": "collection", "count": len(items), "items": items, "mock": True}


def mock_settlement(settlement_id: str) -> dict[str, Any]:
    h = _seed(settlement_id)
    fees = 2_000 + (h % 20_000)
    return {
        "id": settlement_id,
        "entity": "settlement",
        "status": "processed" if h % 3 else "pending",
        "amount": 100_000 + (h % 2_000_000),  # net of fees + tax, as Razorpay reports it
        "fees": fees,
        "tax": fees * 18 // 100,
        "utr": f"UTR{h % 10_000_000:07d}",
        "created_at": 1_760_000_000 + (h % 5_000_000),
        "mock": True,
    }


# --- Client -----------------------------------------------------------------

class RazorpayError(Exception):
    """Razorpay is configured but the call didn't succeed.

    ``code`` is one of: not_found, auth_failed, bad_request, rate_limited,
    upstream_unavailable. Live mode never substitutes demo data for a failed
    call: a made-up answer about a real payment is worse than an error.
    """

    def __init__(self, code: str, message: str, status: int | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status

    def as_result(self) -> dict[str, Any]:
        return {"error": self.message, "error_code": self.code, "mock": False}


def _error_from_response(resp: httpx.Response, what: str) -> RazorpayError:
    try:
        description = resp.json().get("error", {}).get("description") or ""
    except ValueError:
        description = ""
    status = resp.status_code
    lowered = description.lower()
    # Razorpay answers an unknown id with 400 "The id provided does not exist".
    if status == 404 or "does not exist" in lowered or "not found" in lowered:
        return RazorpayError("not_found", f"{what} was not found on Razorpay", status)
    if status == 401:
        return RazorpayError("auth_failed", "Razorpay rejected the API keys (check RAZORPAY_KEY_ID/SECRET)", status)
    if status == 429:
        return RazorpayError("rate_limited", "Razorpay is rate limiting requests; try again shortly", status)
    if status >= 500:
        return RazorpayError("upstream_unavailable", f"Razorpay is unavailable (HTTP {status})", status)
    return RazorpayError("bad_request", f"Razorpay rejected the request: {description or f'HTTP {status}'}", status)


class RazorpayClient:
    def __init__(self, key_id: str, key_secret: str, *, configured: bool,
                 base_url: str = "https://api.razorpay.com/v1", timeout_s: float = 8.0,
                 transport: httpx.AsyncBaseTransport | None = None):
        self.configured = configured
        self._http = httpx.AsyncClient(
            base_url=base_url,
            auth=(key_id, key_secret) if configured else None,
            timeout=timeout_s,
            transport=transport,
            headers={"User-Agent": "paypilot/2"},
        )

    @property
    def mode(self) -> str:
        return "live" if self.configured else "demo"

    async def aclose(self) -> None:
        await self._http.aclose()

    async def _get(self, path: str, what: str, params: dict | None = None) -> dict:
        try:
            resp = await self._http.get(path, params=params)
        except httpx.HTTPError as exc:
            log.warning("razorpay network error", extra={"path": path, "error": type(exc).__name__})
            raise RazorpayError("upstream_unavailable",
                                f"Could not reach Razorpay ({type(exc).__name__})") from exc
        if resp.status_code != 200:
            log.warning("razorpay error", extra={"path": path, "status": resp.status_code})
            raise _error_from_response(resp, what)
        return resp.json()

    async def fetch_payment(self, payment_id: str) -> dict[str, Any]:
        validate_payment_id(payment_id)
        if not self.configured:
            return mock_payment(payment_id)
        data = await self._get(f"/payments/{payment_id}", f"Payment {payment_id}", {"expand[]": "card"})
        return {**data, "mock": False}

    async def fetch_refunds(self, payment_id: str) -> dict[str, Any]:
        validate_payment_id(payment_id)
        if not self.configured:
            return mock_refunds(payment_id)
        data = await self._get(f"/payments/{payment_id}/refunds", f"Payment {payment_id}")
        return {**data, "mock": False}

    async def fetch_settlement(self, settlement_id: str) -> dict[str, Any]:
        validate_settlement_id(settlement_id)
        if not self.configured:
            return mock_settlement(settlement_id)
        data = await self._get(f"/settlements/{settlement_id}", f"Settlement {settlement_id}")
        return {**data, "mock": False}

    async def list_payments(self, count: int = 10) -> list[dict[str, Any]]:
        """Most recent payments (live mode only)."""
        data = await self._get("/payments", "Payments", {"count": max(1, min(count, 100))})
        return data.get("items") or []

    async def list_settlements(self, count: int = 10) -> list[dict[str, Any]]:
        """Most recent settlements (live mode only)."""
        data = await self._get("/settlements", "Settlements", {"count": max(1, min(count, 100))})
        return data.get("items") or []
