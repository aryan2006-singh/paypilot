import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FlaskConical, KeyRound } from "lucide-react";
import { api, auth, UNAUTHORIZED_EVENT } from "../api";
import { useAsync } from "../hooks/useAsync";

/** Tells the truth about the data source and asks for an API key when the server needs one. */
export function ModeBanner() {
  const info = useAsync(api.info, { pollMs: 60000 });
  const [rejected, setRejected] = useState(false);

  useEffect(() => {
    const on = () => setRejected(true);
    const off = auth.subscribe(() => setRejected(false));
    window.addEventListener(UNAUTHORIZED_EVENT, on);
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, on);
      off();
    };
  }, []);

  if (rejected || (info.data?.auth_required && !auth.get())) {
    return (
      <div role="alert" className="flex items-center gap-2 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--critical)_8%,var(--surface))] px-6 py-2 text-[12.5px] max-md:px-4">
        <KeyRound size={14} className="shrink-0 text-[var(--critical)]" />
        <span className="text-[var(--text-dim)]">This server needs an API key.</span>
        <Link to="/app/settings" className="font-semibold text-[var(--accent-text)] hover:underline">
          Add it in Settings
        </Link>
      </div>
    );
  }
  if (info.data?.razorpay_mode === "demo") {
    return (
      <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--warn)_9%,var(--surface))] px-6 py-2 text-[12.5px] max-md:px-4">
        <FlaskConical size={14} className="shrink-0 text-[var(--warn)]" />
        <span className="text-[var(--text-dim)]">Demo data: this server has no Razorpay keys, so payment lookups return sample records, not real ones.</span>
        <Link to="/app/settings" className="shrink-0 font-semibold text-[var(--accent-text)] hover:underline">
          Details
        </Link>
      </div>
    );
  }
  return null;
}
