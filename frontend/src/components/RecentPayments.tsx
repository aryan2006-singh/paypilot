import { Link } from "react-router-dom";
import { ArrowUpRight, CreditCard, KeyRound } from "lucide-react";
import { Card } from "./Card";
import { EmptyState, ErrorState, Skeleton } from "./States";
import { useAsync } from "../hooks/useAsync";
import { ApiError, api } from "../api";
import { timeAgo } from "../lib/format";

const rupees = (paise: number, currency = "INR") =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(paise / 100);

const STATUS_COLOR: Record<string, string> = { captured: "var(--ok)", refunded: "var(--text-muted)", failed: "var(--critical)", authorized: "var(--warn)" };

/** Real payments from the connected Razorpay account, with a one-click "ask about it". */
export function RecentPayments() {
  const payments = useAsync(() => api.payments(8), { pollMs: 30000 });
  const notConfigured = payments.error instanceof ApiError && payments.error.code === "razorpay_not_configured";

  return (
    <Card title="Recent payments" description="Live from your Razorpay account. Pick one to ask PayPilot about it." delay={0.1} className="mb-5" bodyClassName="">
      {notConfigured ? (
        <EmptyState
          icon={KeyRound}
          title="Razorpay isn't connected"
          body="Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the server's environment to see real payments here."
          action={
            <Link to="/app/settings" className="text-[13px] font-semibold text-[var(--accent-text)] hover:underline">
              See settings
            </Link>
          }
        />
      ) : payments.error && !payments.data ? (
        <div className="p-5">
          <ErrorState error={payments.error} onRetry={payments.reload} compact />
        </div>
      ) : !payments.data ? (
        <div className="space-y-3 p-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-5" />
          ))}
        </div>
      ) : payments.data.length === 0 ? (
        <EmptyState icon={CreditCard} title="No payments yet" body="This Razorpay account has no payments to show." />
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {payments.data.map((p) => (
            <li key={p.id} className="flex items-center gap-4 px-5 py-3 text-[13px] max-sm:gap-3 max-sm:px-4">
              <code className="inline-code shrink-0">{p.id}</code>
              <span className="font-semibold tabular-nums">{rupees(p.amount, p.currency)}</span>
              <span className="flex items-center gap-1.5 capitalize text-[var(--text-dim)]">
                <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[p.status] ?? "var(--text-muted)" }} />
                {p.status}
              </span>
              <span className="text-[var(--text-muted)] max-sm:hidden">{p.method ?? ""}</span>
              <span className="ml-auto text-[var(--text-muted)] max-md:hidden">{timeAgo(p.created_at)}</span>
              <Link
                to={`/app/chat?q=${encodeURIComponent(`What is the status of ${p.id}?`)}`}
                aria-label={`Ask about ${p.id}`}
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-[var(--accent-text)] hover:bg-[var(--accent-soft)]"
              >
                Ask <ArrowUpRight size={12} aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
