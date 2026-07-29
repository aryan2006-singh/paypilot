# Settlement cycle

Captured payments are bundled into a settlement on the merchant's configured
cycle — T+2 by default (two business days after capture), with T+1 and
same-day options available on some plans. A settlement is not one payment; it
is the net of many payments captured in that window, minus fees and taxes, so
a settlement amount will never exactly equal any single payment amount a
customer references.

## Matching a settlement

Every settlement carries a UTR (Unique Transaction Reference) — match that
UTR against the corresponding line in the bank statement first; if it's not
there yet, the settlement is still in transit rather than lost. Once the UTR
is confirmed on the bank side, match each individual payment inside that
settlement against the internal payment ledger using the settlement report
(exportable as CSV), which lists payment id, captured amount, fee, tax, and
net settled amount per row.

## Fees and tax deductions

Every settled payment has Razorpay's transaction fee (MDR) and GST on that
fee deducted before the net amount is settled — the gross captured amount and
the net settled amount will legitimately differ, and that difference should
reconcile exactly against the fee/tax columns in the settlement report, not
be treated as a discrepancy.

## On-hold settlements

A settlement can be placed on hold for risk review (unusual volume spike,
new merchant ramp-up, high dispute rate) — this shows as `on_hold` rather
than `processed` and is not a failure. Reconciliation should flag on-hold
settlements separately from ledger mismatches, since the resolution path
(risk team review) is different from a genuine accounting discrepancy.

## Closing the books

Do not close a reconciliation cycle until every settlement's UTR is confirmed
against the bank statement and every payment inside it is matched against the
ledger — a settlement that looks "processed" in the dashboard can still be
mid-transit from the bank's side for up to one additional business day.
