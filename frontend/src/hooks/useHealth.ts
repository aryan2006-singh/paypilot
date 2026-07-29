import { useEffect, useState } from "react";
import { api } from "../api";

export function useHealth(intervalMs = 15000) {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      api.health().then((ok) => {
        if (!cancelled) setOnline(ok);
      }).catch(() => {
        if (!cancelled) setOnline(false);
      });
    };
    check();
    const id = setInterval(check, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs]);

  return online;
}
