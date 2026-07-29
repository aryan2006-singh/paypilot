"""Minimal eval harness: measures router intent accuracy against evals/cases.jsonl.

Run: python -m evals.run_evals

This is intentionally small — the point for a submission like this is showing
you *measure* your agent rather than eyeballing it. Extend with Ragas or
promptfoo for retrieval-quality and answer-quality evals as a next step.
"""
from __future__ import annotations

import asyncio
import json
from pathlib import Path

from agents.graph import route_intent, PayPilotState

CASES_PATH = Path(__file__).parent / "cases.jsonl"


async def main():
    cases = [json.loads(line) for line in CASES_PATH.read_text().splitlines() if line.strip()]
    correct = 0

    for case in cases:
        state: PayPilotState = {
            "message": case["message"],
            "session_id": "eval",
            "history": [],
        }
        result = await route_intent(state)
        passed = result["intent"] == case["expected_agent"]
        correct += passed
        status = "PASS" if passed else "FAIL"
        print(f"[{status}] '{case['message']}' -> got={result['intent']} expected={case['expected_agent']}")

    print(f"\n{correct}/{len(cases)} passed ({100 * correct / len(cases):.0f}%)")


if __name__ == "__main__":
    asyncio.run(main())
