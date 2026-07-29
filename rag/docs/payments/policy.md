# Payment lifecycle

Every payment moves through a fixed set of states: `created` when the order is
initiated, `authorized` once the customer's bank/card network approves the
charge, `captured` when the merchant confirms the sale (auto-capture is on by
default for most integrations), and `settled` once funds reach the merchant's
bank account. A payment can also end in `failed` (declined by the bank, wrong
OTP, insufficient funds, network timeout) or `refunded` (fully or partially
reversed after capture).

An authorized-but-not-captured payment auto-reverses if not captured within
the authorization window (5 days for cards). If a customer says money was
"deducted" but the merchant shows no order, check whether the payment is
sitting in `authorized` — the bank may show it as a pending debit even though
it hasn't been captured yet.

## Common failure reasons

Every failed payment carries an `error_code` and `error_description` that
should be surfaced to the customer instead of a generic "payment failed":

- `BAD_REQUEST_ERROR` — invalid parameters from checkout (usually an
  integration bug, not a customer-facing issue).
- `GATEWAY_ERROR` — the issuing bank or card network declined the transaction
  (insufficient funds, wrong CVV/OTP, card blocked for international/online
  use, risk-engine decline).
- `NETWORK_ERROR` — timeout talking to the bank; the customer should retry,
  and the amount is never captured if this occurs before authorization.

## Payment methods and international cards

Supported methods include cards (Visa/Mastercard/RuPay/Amex), UPI, netbanking,
and wallets. International cards are supported but flagged distinctly — see
the fraud policy for how that risk signal is scored. Recurring payments use a
registered mandate (UPI Autopay or card e-mandate) rather than storing raw
card details, in line with RBI's tokenization requirements.

## Webhooks and idempotency

Merchants should reconcile via the `payment.captured` / `payment.failed`
webhooks rather than polling, since webhook delivery is retried with
exponential backoff on failure and is the authoritative source of truth if the
checkout redirect is interrupted (e.g. the customer closes the browser after
paying but before the success page loads).
