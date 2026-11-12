import { useCallback, useEffect, useSyncExternalStore } from "react";

export type ThemePref = "light" | "dark" | "system";
type Theme = "dark" | "light";

const KEY = "paypilot-theme";
const listeners = new Set<() => void>();
const media = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;

function readPref(): ThemePref {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    /* storage blocked: fall back to system */
  }
  return "system";
}

let pref: ThemePref = readPref();

function resolve(p: ThemePref): Theme {
  if (p === "system") return media?.matches ? "dark" : "light";
  return p;
}

function apply() {
  document.documentElement.classList.toggle("dark", resolve(pref) === "dark");
}

media?.addEventListener("change", () => {
  if (pref === "system") {
    apply();
    listeners.forEach((l) => l());
  }
});

function setPref(next: ThemePref) {
  pref = next;
  try {
    if (next === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch {
    /* ignore */
  }
  apply();
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Shared theme state: every caller sees the same value and updates together. */
export function useTheme() {
  const current = useSyncExternalStore(subscribe, () => pref);
  const theme = resolve(current);

  useEffect(apply, []);

  const toggle = useCallback(() => setPref(resolve(pref) === "dark" ? "light" : "dark"), []);

  return { theme, pref: current, setPref, toggle };
}
