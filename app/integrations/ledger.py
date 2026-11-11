"""Internal ledger used for settlement reconciliation.

Point ``LEDGER_PATH`` at a JSON file of ``{settlement_id: {"amount": paise,
"utr": str}}`` exported from your books. Without one, demo mode synthesizes a
ledger that mostly agrees with the demo settlements but deliberately
disagrees on some, so every reconciliation outcome can be seen.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path


class Ledger:
    def __init__(self, path: Path):
        self.path = path

    def load(self) -> dict[str, dict] | None:
        """Re-read on each call so an updated export is picked up without a restart."""
        if not self.path.is_file():
            return None
        try:
            data = json.loads(self.path.read_text())
        except (OSError, ValueError):
            return None
        return data if isinstance(data, dict) else None

    def lookup(self, settlement: dict) -> tuple[dict | None, str]:
        """Return (ledger entry or None, source description)."""
        ledger = self.load()
        if ledger is not None:
            entry = ledger.get(settlement["id"])
            return (entry if isinstance(entry, dict) else None), "file"
        if settlement.get("mock"):
            return mock_ledger_entry(settlement), "demo"
        # Live settlement but nothing to check it against: say so plainly
        # rather than inventing a match.
        return None, "none (set LEDGER_PATH)"


def mock_ledger_entry(settlement: dict) -> dict | None:
    h = int(hashlib.sha256(f"{settlement['id']}|ledger".encode()).hexdigest(), 16)
    if h % 8 == 0:
        return None  # never booked
    entry = {"amount": settlement["amount"], "utr": settlement["utr"]}
    if h % 8 == 1:
        entry["amount"] += 500 + h % 5_000  # booked gross / fee not netted off
    elif h % 8 == 2:
        entry["utr"] = f"UTR{(h // 3) % 10_000_000:07d}"  # wrong bank reference
    return entry


def reconcile(settlement: dict, ledger_entry: dict | None) -> dict:
    """Compare a settlement against our ledger and list every discrepancy."""
    amount = settlement.get("amount")
    utr = settlement.get("utr")
    status = settlement.get("status")
    discrepancies: list[str] = []
    result = {
        "settlement_id": settlement.get("id"),
        "settlement_status": status,
        "settlement_amount": amount,
        "fees": settlement.get("fees"),
        "tax": settlement.get("tax"),
        "utr": utr,
        "ledger_amount": ledger_entry.get("amount") if ledger_entry else None,
        "ledger_utr": ledger_entry.get("utr") if ledger_entry else None,
        "difference": None,
    }

    if ledger_entry is None:
        outcome = "missing_in_ledger"
        discrepancies.append("settlement has no matching ledger entry")
    else:
        ledger_amount = ledger_entry.get("amount")
        if isinstance(amount, int) and isinstance(ledger_amount, int):
            diff = amount - ledger_amount
            result["difference"] = diff
            if diff:
                discrepancies.append(f"amount differs by {diff:+d} paise (settled {amount}, ledger {ledger_amount})")
        else:
            discrepancies.append("amount missing on settlement or ledger entry")
        ledger_utr = ledger_entry.get("utr")
        if ledger_utr and utr and ledger_utr != utr:
            discrepancies.append(f"UTR mismatch (bank {utr}, ledger {ledger_utr})")
        outcome = "mismatch" if discrepancies else "matched"

    if status != "processed":
        # Money hasn't landed yet, so whatever we found is provisional.
        discrepancies.append(f"settlement is '{status}', not processed, so this is provisional")
        if outcome == "matched":
            outcome = "pending"

    result["reconciliation"] = outcome
    result["discrepancies"] = discrepancies
    return result
