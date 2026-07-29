# Refund timelines

Only a `captured` payment can be refunded — an `authorized` payment should be
voided instead, since capture never happened. Standard refunds settle back to
the source (card/UPI/netbanking/wallet) within 5-7 working days; the delay is
almost always on the issuing bank's side, not the payment gateway, once the
refund has been initiated on our end.

Instant refunds are available for a subset of banks and cards and land within
minutes rather than days, but are not guaranteed for every payment method —
if a customer expects an instant refund and it isn't landing quickly, check
whether their bank actually supports the instant-refund network before
escalating it as a failure.

## Partial and multiple refunds

Partial refunds are supported on any captured payment, and a single payment
can be refunded multiple times as long as the cumulative refunded amount
never exceeds the original captured amount. Each refund has its own `id`
(`rfnd_...`) and status (`pending`, `processed`, `failed`), separate from the
parent payment's status.

## When a refund fails

A refund can fail if the customer's card has since expired, the account was
closed, or the source instrument no longer exists (e.g. a deleted UPI VPA).
In that case the refund is reversed back to the merchant's balance rather than
silently retried forever, and support should offer an alternate payout method
(bank transfer) instead of re-attempting the same refund.

## Customer communication

Always quote the refund `id` and current status rather than just "processing"
— refunds sitting in `pending` for more than the standard window (5-7 days)
warrant checking the bank leg specifically rather than re-initiating a second
refund, which would risk a duplicate credit once the first one clears.
