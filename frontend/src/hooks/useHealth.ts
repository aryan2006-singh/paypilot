import { useEffect, useSyncExternalStore } from "react";
import { api } from "../api";

// One shared poller no matter how many components show the status.
let online: boolean | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let subscribers = 0;
const listeners = new Set<() => void>();

function set(next: boolean) {
  if (next === online) return;
  online = next;
  listeners.forEach((l) => l());
}

function check() {
  api.health().then(set, () => set(false));
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** null = checking, true = API reachable, false = unreachable (or waking up). */
export function useHealth(intervalMs = 15000) {
  const value = useSyncExternalStore(subscribe, () => online);

  useEffect(() => {
    subscribers += 1;
    if (!timer) {
      check();
      timer = setInterval(check, intervalMs);
    }
    return () => {
      subscribers -= 1;
      if (subscribers === 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, [intervalMs]);

  return value;
}

export function recheckHealth() {
  check();
}
