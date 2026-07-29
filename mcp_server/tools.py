"""MCP server exposing payment operations as tools over Razorpay's test API.

Run standalone: python -m mcp_server.tools
Connect via langchain-mcp-adapters from agents/graph.py (see client.py).
"""
from __future__ import annotations

import hashlib
import os

import httpx
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

load_dotenv()  # this module also runs standalone as its own MCP subprocess

mcp = FastMCP("paypilot-tools")

RAZORPAY_BASE = "https://api.razorpay.com/v1"

# Values shipped in .env.example — if these are still in place, there are no
# real Razorpay test keys configured and every call should fall back to
# deterministic mock data instead of hitting the network at all.
_PLACEHOLDER_KEYS = {"", "rzp_test_xxxxxxxx", "xxxxxxxx"}


def _auth() -> tuple[str, str]:
    key_id = os.environ.get("RAZORPAY_KEY_ID", "")
    key_secret = os.environ.get("RAZORPAY_KEY_SECRET", "")
    return (key_id, key_secret)


def _is_configured() -> bool:
    key_id, key_secret = _auth()
    return key_id not in _PLACEHOLDER_KEYS and key_secret not in _PLACEHOLDER_KEYS


def _seed(*parts: str) -> int:
    return int(hashlib.sha256("|".join(parts).encode()).hexdigest(), 16)


def _mock_payment(payment_id: str) -> dict:
    h = _seed(payment_id)
    statuses = ["captured", "authorized", "failed", "refunded"]
    methods = ["card", "upi", "netbanking", "wallet"]
    return {
        "status": statuses[h % len(statuses)],
        "amount": 10_000 + (h % 490_000),
        "method": methods[(h // 7) % len(methods)],
        "international": h % 11 == 0,
        "mock": True,
    }


def _mock_refunds(payment_id: str) -> dict:
    h = _seed(payment_id, "refund")
    count = h % 3
    items = [
        {"id": f"rfnd_{h % 99999:05d}{i}", "amount": 10_000 + ((h + i) % 50_000), "status": "processed"}
        for i in range(count)
    ]
    return {"count": count, "items": items, "mock": True}


def _mock_settlement(settlement_id: str) -> dict:
    h = _seed(settlement_id)
    return {
        "id": settlement_id,
        "status": "processed" if h % 2 == 0 else "pending",
        "amount": 100_000 + (h % 2_000_000),
        "utr": f"UTR{h % 10_000_000:07d}",
        "mock": True,
    }


async def _razorpay_get(path: str) -> tuple[dict | None, str | None]:
    """Call Razorpay's test-mode API. Returns (data, error) — error is set on
    any non-200 response or network failure, letting callers fall back to mock
    data instead of 500ing the whole request."""
    try:
        async with httpx.AsyncClient(auth=_auth(), timeout=8.0) as client:
            resp = await client.get(f"{RAZORPAY_BASE}{path}")
    except httpx.HTTPError as exc:
        return None, f"network error calling Razorpay: {exc}"
    if resp.status_code != 200:
        return None, f"Razorpay returned {resp.status_code}: {resp.text[:200]}"
    return resp.json(), None


@mcp.tool()
async def get_payment_status(payment_id: str) -> dict:
    """Fetch the status of a Razorpay payment by ID (e.g. pay_XXXXXXXX)."""
    if not _is_configured():
        return _mock_payment(payment_id)
    data, error = await _razorpay_get(f"/payments/{payment_id}")
    if error:
        return {**_mock_payment(payment_id), "fallback_reason": error}
    return {
        "status": data.get("status"),
        "amount": data.get("amount"),
        "method": data.get("method"),
        "mock": False,
    }


@mcp.tool()
async def get_refund_status(payment_id: str) -> dict:
    """Fetch refund records for a given payment ID."""
    if not _is_configured():
        return _mock_refunds(payment_id)
    data, error = await _razorpay_get(f"/payments/{payment_id}/refunds")
    if error:
        return {**_mock_refunds(payment_id), "fallback_reason": error}
    return {**data, "mock": False}


@mcp.tool()
async def match_settlement(settlement_id: str) -> dict:
    """Fetch settlement details for reconciliation against internal ledgers."""
    if not _is_configured():
        return _mock_settlement(settlement_id)
    data, error = await _razorpay_get(f"/settlements/{settlement_id}")
    if error:
        return {**_mock_settlement(settlement_id), "fallback_reason": error}
    return {**data, "mock": False}


@mcp.tool()
async def score_risk(payment_id: str) -> dict:
    """Simple rule-based risk score as a starting point for fraud triage.

    Swap this for a trained model or Razorpay's own risk signals for real use.
    """
    if not _is_configured():
        data = _mock_payment(payment_id)
    else:
        fetched, error = await _razorpay_get(f"/payments/{payment_id}")
        data = {**_mock_payment(payment_id), "fallback_reason": error} if error else {**fetched, "mock": False}

    score = 0
    reasons = []
    if data.get("amount", 0) > 5_000_000:  # > 50,000 INR in paise
        score += 30
        reasons.append("high amount")
    if data.get("international"):
        score += 25
        reasons.append("international card")
    if data.get("method") == "card" and not data.get("card", {}).get("cvv_provided", True):
        score += 20
        reasons.append("cvv not verified")

    return {
        "risk_score": score,
        "flags": reasons,
        "recommendation": "review" if score > 40 else "clear",
        "mock": data.get("mock", True),
    }


if __name__ == "__main__":
    mcp.run()
