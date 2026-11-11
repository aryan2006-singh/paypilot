from __future__ import annotations

import httpx
import pytest

from app.agents.specialists import inr
from app.agents.tools import PaymentTools, assess_risk
from app.integrations.ledger import Ledger, reconcile
from app.integrations.razorpay import RazorpayClient, mock_payment, mock_refunds


def demo_tools(tmp_path) -> PaymentTools:
    return PaymentTools(RazorpayClient("", "", configured=False), Ledger(tmp_path / "none.json"))


def live_tools(tmp_path, handler) -> PaymentTools:
    client = RazorpayClient("rzp_test_real", "secret", configured=True,
                            transport=httpx.MockTransport(handler))
    return PaymentTools(client, Ledger(tmp_path / "none.json"))


@pytest.mark.asyncio
async def test_invalid_ids_never_reach_the_network(tmp_path):
    def handler(request):  # pragma: no cover - must not be called
        raise AssertionError("network called")

    tools = live_tools(tmp_path, handler)
    for bad in ["pay_x/../../settlements", "PAY_123", "pay_", "x" * 50]:
        result = await tools.get_payment_status(bad)
        assert result["error_code"] == "invalid_id"
    assert (await tools.match_settlement("stl_1/../x"))["error_code"] == "invalid_id"


@pytest.mark.asyncio
async def test_live_not_found_is_reported_not_faked(tmp_path):
    def handler(request):
        return httpx.Response(400, json={"error": {"code": "BAD_REQUEST_ERROR",
                                                   "description": "The id provided does not exist"}})

    tools = live_tools(tmp_path, handler)
    result = await tools.get_payment_status("pay_DoesNotExist")
    assert result == {"error": "Payment pay_DoesNotExist was not found on Razorpay",
                      "error_code": "not_found", "mock": False}
    assert (await tools.score_risk("pay_DoesNotExist"))["error_code"] == "not_found"
    assert (await tools.get_refund_status("pay_DoesNotExist"))["mock"] is False


@pytest.mark.asyncio
async def test_live_errors_are_classified(tmp_path):
    for status, code in [(401, "auth_failed"), (429, "rate_limited"), (503, "upstream_unavailable")]:
        tools = live_tools(tmp_path, lambda r, s=status: httpx.Response(s, json={}))
        assert (await tools.get_payment_status("pay_A1"))["error_code"] == code

    def boom(request):
        raise httpx.ConnectError("down")

    assert (await live_tools(tmp_path, boom).get_payment_status("pay_A1"))["error_code"] == "upstream_unavailable"


@pytest.mark.asyncio
async def test_live_payment_success(tmp_path):
    seen = {}

    def handler(request):
        seen["url"] = str(request.url)
        seen["auth"] = request.headers.get("authorization")
        return httpx.Response(200, json={"id": "pay_Live1", "status": "captured", "amount": 50000,
                                         "currency": "INR", "method": "upi", "created_at": 1700000000})

    result = await live_tools(tmp_path, handler).get_payment_status("pay_Live1")
    assert result["status"] == "captured" and result["mock"] is False
    assert seen["url"].startswith("https://api.razorpay.com/v1/payments/pay_Live1")
    assert seen["auth"].startswith("Basic ")


@pytest.mark.asyncio
async def test_demo_refunds_agree_with_payment_status(tmp_path):
    for i in range(40):
        pid = f"pay_Demo{i}"
        payment, refunds = mock_payment(pid), mock_refunds(pid)
        if payment["status"] == "refunded":
            assert refunds["items"][0]["amount"] == payment["amount"]
        if payment["status"] in ("failed", "authorized"):
            assert refunds["count"] == 0


def test_risk_rules():
    assert assess_risk({"amount": 1000, "method": "upi"}) == (0, [])
    score, reasons = assess_risk({"amount": 30_000_000, "international": True,
                                  "method": "card", "card": {"type": "prepaid"},
                                  "error_reason": "payment_risk_check_failed"})
    assert score == 100
    assert len(reasons) == 4


def test_reconcile_outcomes():
    stl = {"id": "stl_1", "amount": 1000, "utr": "UTR1", "status": "processed"}
    assert reconcile(stl, {"amount": 1000, "utr": "UTR1"})["reconciliation"] == "matched"
    mismatch = reconcile(stl, {"amount": 900, "utr": "UTR2"})
    assert mismatch["reconciliation"] == "mismatch" and mismatch["difference"] == 100
    assert len(mismatch["discrepancies"]) == 2
    assert reconcile(stl, None)["reconciliation"] == "missing_in_ledger"
    assert reconcile({**stl, "status": "pending"}, {"amount": 1000, "utr": "UTR1"})["reconciliation"] == "pending"


@pytest.mark.asyncio
async def test_ledger_file_is_used(tmp_path):
    path = tmp_path / "ledger.json"
    path.write_text('{"stl_File1": {"amount": 1, "utr": "X"}}')
    tools = PaymentTools(RazorpayClient("", "", configured=False), Ledger(path))
    result = await tools.match_settlement("stl_File1")
    assert result["ledger_source"] == "file"
    assert result["ledger_amount"] == 1


def test_inr_formatting():
    assert inr(12345678) == "₹1,23,456.78"
    assert inr(100) == "₹1"
    assert inr(None) == "an unknown amount"


def test_live_payments_endpoint(make_client):
    c = make_client()
    c.app.state.razorpay = RazorpayClient("k", "s", configured=True, transport=httpx.MockTransport(
        lambda r: httpx.Response(200, json={"items": [{"id": "pay_R1", "amount": 100, "currency": "INR",
                                                       "status": "captured", "method": "upi",
                                                       "email": "x@example.com", "created_at": 1}]})))
    body = c.get("/api/payments?limit=1").json()
    assert body == [{"id": "pay_R1", "amount": 100, "currency": "INR", "status": "captured",
                     "method": "upi", "created_at": 1}]
