"""MCP server exposing PayPilot's payment tools to external MCP clients.

The tools are the exact functions the in-app agents call (app/agents/tools.py),
so Claude Desktop or any other MCP client gets the same behaviour as the chat.

Run standalone: python -m mcp_server.tools
"""
from __future__ import annotations

from mcp.server.fastmcp import FastMCP

from app.agents.tools import PaymentTools
from app.core.config import get_settings
from app.integrations.ledger import Ledger
from app.integrations.razorpay import RazorpayClient

mcp = FastMCP("paypilot-tools")

_settings = get_settings()
_tools = PaymentTools(
    RazorpayClient(
        _settings.razorpay_key_id, _settings.razorpay_key_secret,
        configured=_settings.razorpay_configured,
        base_url=_settings.razorpay_base_url, timeout_s=_settings.razorpay_timeout_s,
    ),
    Ledger(_settings.resolved_ledger_path),
)


@mcp.tool()
async def get_payment_status(payment_id: str) -> dict:
    """Fetch the status of a Razorpay payment by id (e.g. pay_XXXXXXXX)."""
    return await _tools.get_payment_status(payment_id)


@mcp.tool()
async def get_refund_status(payment_id: str) -> dict:
    """List the refunds issued against a payment id."""
    return await _tools.get_refund_status(payment_id)


@mcp.tool()
async def match_settlement(settlement_id: str) -> dict:
    """Reconcile a Razorpay settlement (e.g. stl_XXXX) against the internal ledger."""
    return await _tools.match_settlement(settlement_id)


@mcp.tool()
async def score_risk(payment_id: str) -> dict:
    """Rule-based 0-100 fraud risk score with flags and a clear/review/block recommendation."""
    return await _tools.score_risk(payment_id)


if __name__ == "__main__":
    mcp.run()
