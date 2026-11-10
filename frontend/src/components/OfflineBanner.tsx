import { AnimatePresence, motion } from "framer-motion";
import { WifiOff } from "lucide-react";
import { useHealth, recheckHealth } from "../hooks/useHealth";

/** Shown across the top of the app while the API can't be reached. */
export function OfflineBanner() {
  const online = useHealth();
  return (
    <AnimatePresence initial={false}>
      {online === false && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
          role="status"
        >
          <div
            className="flex items-center gap-2.5 border-b px-6 py-2 text-[12.5px] max-md:px-4"
            style={{
              borderColor: "color-mix(in srgb, var(--warn) 30%, var(--border))",
              background: "color-mix(in srgb, var(--warn) 10%, var(--surface))",
              color: "var(--text)",
            }}
          >
            <WifiOff size={14} style={{ color: "var(--warn)" }} aria-hidden />
            <span className="flex-1">
              Can't reach the API right now. The server may be waking up, which can take up to a minute.
            </span>
            <button type="button" onClick={recheckHealth} className="font-semibold underline-offset-2 hover:underline">
              Check now
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
