"""Intent router with conversation awareness.

Keyword scoring is fast, free and fully deterministic, which is what you want
in front of payment tools. It also uses the conversation so far: a follow-up
like "and the refund?" picks up the payment id from earlier turns, and a bare
"why?" stays with the agent that answered last.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

INTENTS = ["payments", "refunds", "reconciliation", "fraud", "general"]

PAYMENT_RE = re.compile(r"\bpay_[A-Za-z0-9]{1,40}\b")
SETTLEMENT_RE = re.compile(r"\b(?:stl|setl|setlmnt)_[A-Za-z0-9]{1,40}\b")

# (pattern, weight). Weights break ties between intents mentioned together:
# "refund for this suspicious payment" should go to fraud, not payments.
_KEYWORDS: dict[str, list[tuple[str, int]]] = {
    "refunds": [(r"refund", 3), (r"money back", 3), (r"reversal|reversed|chargeback", 2)],
    "reconciliation": [(r"reconcil", 3), (r"settle", 3), (r"ledger", 3), (r"\butr\b", 2),
                       (r"payout|books\b|mismatch", 2)],
    "fraud": [(r"fraud", 4), (r"suspicious|risky|risk|scam", 4), (r"stolen|unauthori[sz]ed|chargeback", 3),
              (r"block|flag", 1)],
    "payments": [(r"payment", 1), (r"transaction", 1), (r"\bfail", 2), (r"declin", 2), (r"captur", 2),
                 (r"authori[sz]", 1), (r"status", 1), (r"\bupi\b|card|netbanking|wallet", 1)],
    "general": [(r"hours|support|contact|escalat|invoice|gst|tax document|kyc|onboard|api key", 2)],
}
_COMPILED = {intent: [(re.compile(p, re.I), w) for p, w in pats] for intent, pats in _KEYWORDS.items()}

_FOLLOW_UP = re.compile(r"^(and|also|what about|how about|why|ok|okay|so|then|it|its|this|that)\b", re.I)


@dataclass(frozen=True)
class RouteDecision:
    intent: str
    entity_id: str | None
    reason: str
    carried_entity: bool = False  # entity came from an earlier turn


@dataclass(frozen=True)
class ConversationState:
    last_intent: str | None = None
    last_payment_id: str | None = None
    last_settlement_id: str | None = None


def score(message: str) -> dict[str, int]:
    return {intent: sum(w for rx, w in pats if rx.search(message)) for intent, pats in _COMPILED.items()}


def route(message: str, state: ConversationState | None = None) -> RouteDecision:
    state = state or ConversationState()
    payment_id = (PAYMENT_RE.search(message) or [None])[0]
    settlement_id = (SETTLEMENT_RE.search(message) or [None])[0]

    scores = score(message)
    best = max(INTENTS, key=lambda i: (scores[i], -INTENTS.index(i)))
    if scores[best] > 0:
        intent, reason = best, f"keywords matched {best}"
    elif settlement_id:
        intent, reason = "reconciliation", "settlement id in message"
    elif payment_id:
        intent, reason = "payments", "payment id in message"
    elif state.last_intent and (_FOLLOW_UP.match(message.strip()) or len(message.split()) <= 4):
        intent, reason = state.last_intent, "follow-up to the previous answer"
    else:
        intent, reason = "general", "no specific intent detected"

    carried = False
    if intent == "reconciliation":
        entity = settlement_id
        if entity is None and state.last_settlement_id:
            entity, carried = state.last_settlement_id, True
    elif intent in ("payments", "refunds", "fraud"):
        entity = payment_id
        if entity is None and state.last_payment_id:
            entity, carried = state.last_payment_id, True
    else:
        entity = None

    if carried:
        reason += f", using {entity} from earlier in the conversation"
    return RouteDecision(intent=intent, entity_id=entity, reason=reason, carried_entity=carried)
