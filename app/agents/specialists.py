"""The five specialist agents.

Each one: pulls policy passages for grounding, calls its tool, and drafts a
plain-language reply from the result. When an LLM is configured the draft is
replaced by a reply Claude writes from the same facts; the draft is what users
get otherwise, so it has to stand on its own.
"""
from __future__ import annotations

import datetime as dt

from app.agents.base import AgentContext, AgentInfo, AgentResult


def inr(paise: int | float | None) -> str:
    if not isinstance(paise, (int, float)):
        return "an unknown amount"
    rupees = paise / 100
    # Indian digit grouping: 12,34,567.89
    whole, frac = f"{rupees:.2f}".split(".")
    head, tail = whole[:-3], whole[-3:]
    groups = []
    while len(head) > 2:
        groups.insert(0, head[-2:])
        head = head[:-2]
    if head:
        groups.insert(0, head)
    grouped = ",".join(groups + [tail]) if groups else tail
    return f"₹{grouped}.{frac}" if frac != "00" else f"₹{grouped}"


def when(ts: int | float | None) -> str:
    if not isinstance(ts, (int, float)):
        return ""
    return dt.datetime.fromtimestamp(ts, dt.timezone.utc).strftime("%d %b %Y")


def _demo_note(tool: dict | None) -> str:
    if not tool or not tool.get("mock"):
        return ""
    return "\n\n_Demo mode: this is sample data. Add Razorpay keys to see live results._"


def _tool_error(entity: str, tool: dict, doing: str) -> str:
    code = tool.get("error_code")
    if code == "not_found":
        return (f"I couldn't find **{entity}** on Razorpay. Please check the id; it should be "
                "copied exactly from the dashboard (ids are case-sensitive).")
    if code == "invalid_id":
        return f"`{entity}` doesn't look like a valid id: {tool['error']}."
    return f"I couldn't {doing} {entity} right now: {tool['error']}."


def _missing_id(kind: str, example: str) -> str:
    return f"I need a {kind} id to look this up. Please include it, for example `{example}`."


_PAYMENT_STATUS_TEXT = {
    "created": "was created but the customer hasn't completed it yet",
    "authorized": "is authorized: the bank approved it but it hasn't been captured yet",
    "captured": "was captured successfully, so the money is on its way to settlement",
    "failed": "failed",
    "refunded": "was refunded in full",
}

_FAILURE_TEXT = {
    "payment_failed": "the bank or payment method declined it",
    "payment_risk_check_failed": "it was blocked by risk checks",
    "payment_timed_out": "the customer didn't complete it in time",
    "payment_cancelled": "the customer cancelled it",
}


# --- Payments ----------------------------------------------------------------

class PaymentsAgent:
    info = AgentInfo(
        id="payments",
        label="Payments",
        color="#2a78d6",
        description="Looks up live payment status (created / authorized / captured / failed) on Razorpay and explains it against the payment lifecycle policy.",
        example="Why did payment pay_XYZ789 fail?",
        work_label="Checking payment policy and live payment status",
        tools=("get_payment_status",),
        namespace="payments",
    )

    async def run(self, ctx: AgentContext) -> AgentResult:
        result = AgentResult(agent_id="payments", entity_id=ctx.entity_id,
                             policy_passages=ctx.retrieve(ctx.message, "payments"))
        if not ctx.entity_id:
            result.fallback_reply = _missing_id("payment", "pay_ABC123")
            return result
        tool = await ctx.tools.get_payment_status(ctx.entity_id)
        result.tool_name, result.tool_result = "get_payment_status", tool
        if tool.get("error"):
            result.fallback_reply = _tool_error(ctx.entity_id, tool, "look up")
            return result
        status = tool.get("status", "unknown")
        line = f"Payment **{ctx.entity_id}** for **{inr(tool.get('amount'))}**"
        if tool.get("method"):
            line += f" via {tool['method']}"
        line += f" {_PAYMENT_STATUS_TEXT.get(status, f'is {status}')}"
        if status == "failed" and tool.get("error_reason"):
            line += f" because {_FAILURE_TEXT.get(tool['error_reason'], tool['error_reason'].replace('_', ' '))}"
        line += "."
        if status == "authorized":
            line += " Authorized payments that aren't captured are auto-refunded by Razorpay, so capture it soon if the order is valid."
        elif status == "failed":
            line += " No money was taken; the customer can retry with the same or another method."
        result.fallback_reply = line + _demo_note(tool)
        return result


# --- Refunds -----------------------------------------------------------------

class RefundsAgent:
    info = AgentInfo(
        id="refunds",
        label="Refunds",
        color="#eb6834",
        description="Checks refund records for a payment and explains timelines against the refund policy.",
        example="Where is my refund for pay_ABC123?",
        work_label="Checking refund policy and refund records",
        tools=("get_refund_status",),
        namespace="refunds",
    )

    async def run(self, ctx: AgentContext) -> AgentResult:
        result = AgentResult(agent_id="refunds", entity_id=ctx.entity_id,
                             policy_passages=ctx.retrieve(ctx.message, "refunds"))
        if not ctx.entity_id:
            result.fallback_reply = _missing_id("payment", "pay_ABC123")
            return result
        tool = await ctx.tools.get_refund_status(ctx.entity_id)
        result.tool_name, result.tool_result = "get_refund_status", tool
        if tool.get("error"):
            result.fallback_reply = _tool_error(ctx.entity_id, tool, "look up refunds for")
            return result
        items = tool.get("items") or []
        if not items:
            text = (f"There are no refunds on **{ctx.entity_id}** yet. If one was promised, it "
                    "may not have been initiated; refunds can be issued from the dashboard or API.")
        else:
            lines = [f"**{ctx.entity_id}** has {len(items)} refund(s) totalling **{inr(tool.get('total_refunded'))}**:"]
            for item in items:
                status = item.get("status")
                eta = ("credited to the customer's account" if status == "processed"
                       else "in progress, usually credited within 5-7 working days")
                lines.append(f"- `{item.get('id')}`: {inr(item.get('amount'))}, {status} ({eta})")
            text = "\n".join(lines)
        result.fallback_reply = text + _demo_note(tool)
        return result


# --- Reconciliation ----------------------------------------------------------

_OUTCOME_TEXT = {
    "matched": "matches our ledger exactly",
    "mismatch": "does **not** match our ledger",
    "pending": "matches our ledger so far, but hasn't been processed yet",
    "missing_in_ledger": "has **no entry** in our ledger",
}


class ReconciliationAgent:
    info = AgentInfo(
        id="reconciliation",
        label="Reconciliation",
        color="#1baf7a",
        description="Matches Razorpay settlements against the internal ledger and lists every discrepancy (amount, UTR, status).",
        example="Does settlement stl_44 match our ledger?",
        work_label="Checking reconciliation policy and matching the settlement",
        tools=("match_settlement",),
        namespace="reconciliation",
    )

    async def run(self, ctx: AgentContext) -> AgentResult:
        result = AgentResult(agent_id="reconciliation", entity_id=ctx.entity_id,
                             policy_passages=ctx.retrieve(ctx.message, "reconciliation"))
        if not ctx.entity_id:
            result.fallback_reply = _missing_id("settlement", "stl_ABC123")
            return result
        tool = await ctx.tools.match_settlement(ctx.entity_id)
        result.tool_name, result.tool_result = "match_settlement", tool
        if tool.get("error"):
            result.fallback_reply = _tool_error(ctx.entity_id, tool, "reconcile")
            return result
        outcome = tool.get("reconciliation", "unknown")
        text = (f"Settlement **{ctx.entity_id}** ({inr(tool.get('settlement_amount'))}, UTR {tool.get('utr')}) "
                f"{_OUTCOME_TEXT.get(outcome, outcome)}.")
        issues = [d for d in tool.get("discrepancies", [])]
        if issues:
            text += "\n\n" + "\n".join(f"- {d}" for d in issues)
        if outcome in ("mismatch", "missing_in_ledger"):
            text += "\n\nNext step: check the booking for this UTR in your books and correct or add the entry."
        result.fallback_reply = text + _demo_note(tool)
        return result


# --- Fraud -------------------------------------------------------------------

class FraudAgent:
    info = AgentInfo(
        id="fraud",
        label="Fraud",
        color="#eda100",
        description="Scores a payment's risk from 0-100 (amount, international card, prepaid card, risk-check declines, refund activity) and recommends clear, review or block.",
        example="This transaction pay_ABC123 looks suspicious, can you check it?",
        work_label="Running the risk-scoring rules",
        tools=("score_risk",),
        namespace=None,
    )

    async def run(self, ctx: AgentContext) -> AgentResult:
        result = AgentResult(agent_id="fraud", entity_id=ctx.entity_id)
        if not ctx.entity_id:
            result.fallback_reply = _missing_id("payment", "pay_ABC123")
            return result
        tool = await ctx.tools.score_risk(ctx.entity_id)
        result.tool_name, result.tool_result = "score_risk", tool
        if tool.get("error"):
            result.fallback_reply = _tool_error(ctx.entity_id, tool, "score")
            return result
        text = (f"Risk score for **{ctx.entity_id}** ({inr(tool.get('amount'))}): "
                f"**{tool.get('risk_score')}/100, {tool.get('risk_level')} risk**. "
                f"Recommendation: **{tool.get('recommendation')}**.")
        flags = tool.get("flags") or []
        text += ("\n\nSignals:\n" + "\n".join(f"- {f}" for f in flags)) if flags else "\n\nNo risk signals were found."
        result.fallback_reply = text + _demo_note(tool)
        return result


# --- General -----------------------------------------------------------------

class GeneralAgent:
    info = AgentInfo(
        id="general",
        label="General",
        color="#e87ba4",
        description="Answers from the general support policy (hours, escalation, invoices) when no other specialist fits.",
        example="What are your business hours?",
        work_label="Searching the support policy",
        tools=(),
        namespace="general",
    )

    async def run(self, ctx: AgentContext) -> AgentResult:
        passages = ctx.retrieve(ctx.message, "general")
        result = AgentResult(agent_id="general", entity_id=None, policy_passages=passages)
        if passages:
            result.fallback_reply = "Here's what our support policy says:\n\n" + passages[0].strip()
        else:
            result.fallback_reply = (
                "I can help with payments, refunds, settlement reconciliation and fraud checks. "
                "Try asking something like \"Why did pay_ABC123 fail?\" or "
                "\"Does settlement stl_44 match our ledger?\""
            )
        return result


AGENTS = {a.info.id: a for a in (PaymentsAgent(), RefundsAgent(), ReconciliationAgent(), FraudAgent(), GeneralAgent())}
