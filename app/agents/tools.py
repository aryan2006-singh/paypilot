"""Payment operations the agents can call.

These are the single implementation of every tool. The specialist agents
call them in-process, and ``mcp_server/tools.py`` exposes the same functions
over MCP for external clients (Claude Desktop, other agents).
"""
from __future__ import annotations

from typing import Any

from app.integrations.ledger import Ledger, reconcile
from app.integrations.razorpay import InvalidIdError, RazorpayClient, RazorpayError

# Risk rules. Points add up and are capped at 100.
HIGH_AMOUNT = 5_000_000        # ₹50,000 in paise
VERY_HIGH_AMOUNT = 20_000_000  # ₹2,00,000 in paise
_RISK_ERROR_REASONS = {"payment_risk_check_failed", "payment_failed_due_to_fraud"}


def assess_risk(data: dict) -> tuple[int, list[str]]:
    score = 0
    reasons: list[str] = []
    card = data.get("card") if isinstance(data.get("card"), dict) else {}
    amount = data.get("amount")

    if isinstance(amount, (int, float)):
        if amount > VERY_HIGH_AMOUNT:
            score += 40
            reasons.append("very high amount (over ₹2,00,000)")
        elif amount > HIGH_AMOUNT:
            score += 25
            reasons.append("high amount (over ₹50,000)")
    if data.get("international") or card.get("international"):
        score += 25
        reasons.append("international card")
    if data.get("method") == "card" and card.get("type") == "prepaid":
        score += 15
        reasons.append("prepaid card")
    if data.get("error_reason") in _RISK_ERROR_REASONS:
        score += 40
        reasons.append("declined by Razorpay risk checks")
    if (data.get("status") == "captured" and (data.get("amount_refunded") or 0) > 0
            and isinstance(amount, (int, float)) and amount > HIGH_AMOUNT):
        score += 10
        reasons.append("high-value payment already being refunded")
    return min(score, 100), reasons


class PaymentTools:
    def __init__(self, razorpay: RazorpayClient, ledger: Ledger):
        self.razorpay = razorpay
        self.ledger = ledger

    async def get_payment_status(self, payment_id: str) -> dict[str, Any]:
        try:
            data = await self.razorpay.fetch_payment(payment_id)
        except InvalidIdError as exc:
            return {"error": str(exc), "error_code": "invalid_id"}
        except RazorpayError as exc:
            return exc.as_result()
        keys = ("id", "status", "amount", "currency", "method", "international",
                "amount_refunded", "error_reason", "error_description", "created_at", "mock")
        return {k: data[k] for k in keys if data.get(k) is not None}

    async def get_refund_status(self, payment_id: str) -> dict[str, Any]:
        try:
            data = await self.razorpay.fetch_refunds(payment_id)
        except InvalidIdError as exc:
            return {"error": str(exc), "error_code": "invalid_id"}
        except RazorpayError as exc:
            return exc.as_result()
        items = data.get("items") or []
        result = {
            "payment_id": payment_id,
            "count": data.get("count", len(items)),
            "items": [
                {k: item.get(k) for k in ("id", "amount", "currency", "status", "speed_processed", "created_at")}
                for item in items
            ],
            "total_refunded": sum(i.get("amount") or 0 for i in items),
            "mock": data.get("mock", True),
        }
        return result

    async def match_settlement(self, settlement_id: str) -> dict[str, Any]:
        """Reconcile a settlement against the internal ledger: matched,
        mismatch, pending or missing_in_ledger, with every discrepancy."""
        try:
            settlement = await self.razorpay.fetch_settlement(settlement_id)
        except InvalidIdError as exc:
            return {"error": str(exc), "error_code": "invalid_id"}
        except RazorpayError as exc:
            return exc.as_result()
        entry, source = self.ledger.lookup(settlement)
        result = reconcile(settlement, entry)
        result["ledger_source"] = source
        result["mock"] = settlement.get("mock", True)
        return result

    async def score_risk(self, payment_id: str) -> dict[str, Any]:
        """Rule-based 0-100 risk score from signals Razorpay actually returns."""
        try:
            data = await self.razorpay.fetch_payment(payment_id)
        except InvalidIdError as exc:
            return {"error": str(exc), "error_code": "invalid_id"}
        except RazorpayError as exc:
            return exc.as_result()
        score, reasons = assess_risk(data)
        if score >= 60:
            level, recommendation = "high", "block"
        elif score >= 30:
            level, recommendation = "medium", "review"
        else:
            level, recommendation = "low", "clear"
        result = {
            "payment_id": payment_id,
            "risk_score": score,
            "risk_level": level,
            "recommendation": recommendation,
            "flags": reasons,
            "amount": data.get("amount"),
            "method": data.get("method"),
            "status": data.get("status"),
            "mock": data.get("mock", True),
        }
        return result
