import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  /** True while re-fetching data we already have (keeps old data on screen). */
  refreshing: boolean;
  updatedAt: number | null;
  reload: () => void;
}

/**
 * Small data-fetching hook with loading, error, retry and optional polling.
 * Keeps showing the last good data during background refreshes so the UI
 * never flashes back to a skeleton.
 */
export function useAsync<T>(fn: () => Promise<T>, opts: { pollMs?: number; initial?: T | null } = {}): AsyncState<T> {
  const { pollMs, initial = null } = opts;
  const [data, setData] = useState<T | null>(initial);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(initial === null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const hasData = useRef(initial !== null);
  const alive = useRef(true);

  const run = useCallback(() => {
    if (hasData.current) setRefreshing(true);
    else setLoading(true);
    fnRef.current()
      .then((d) => {
        if (!alive.current) return;
        hasData.current = true;
        setData(d);
        setError(null);
        setUpdatedAt(Date.now());
      })
      .catch((e: unknown) => {
        if (!alive.current) return;
        setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (!alive.current) return;
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    alive.current = true;
    run();
    if (!pollMs) return () => { alive.current = false; };
    const id = setInterval(() => {
      if (document.visibilityState === "visible") run();
    }, pollMs);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [run, pollMs]);

  return { data, error, loading, refreshing, updatedAt, reload: run };
}
