"""Router eval: intent accuracy against evals/cases.jsonl.

Run: python -m evals.run_evals   (exits non-zero below 100%, so CI can gate on it)

Cases may carry "history" (earlier user/assistant turns) and "expected_entity"
to check that follow-ups pick up ids from the conversation.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from app.agents.router import route
from app.services.orchestrator import conversation_state
from app.services.store import StoredTurn

CASES_PATH = Path(__file__).parent / "cases.jsonl"


def load_cases() -> list[dict]:
    return [json.loads(line) for line in CASES_PATH.read_text().splitlines() if line.strip()]


def evaluate(case: dict) -> tuple[bool, str]:
    history = [StoredTurn(t["role"], t["content"], t.get("intent"), t.get("entity_id"))
               for t in case.get("history", [])]
    decision = route(case["message"], conversation_state(history))
    ok = decision.intent == case["expected_agent"]
    if "expected_entity" in case:
        ok = ok and decision.entity_id == case["expected_entity"]
    return ok, f"intent={decision.intent} entity={decision.entity_id}"


def main() -> int:
    cases = load_cases()
    passed = 0
    for case in cases:
        ok, got = evaluate(case)
        passed += ok
        print(f"[{'PASS' if ok else 'FAIL'}] {case['message']!r} -> {got} (expected {case['expected_agent']})")
    print(f"\n{passed}/{len(cases)} passed ({100 * passed / len(cases):.0f}%)")
    return 0 if passed == len(cases) else 1


if __name__ == "__main__":
    sys.exit(main())
