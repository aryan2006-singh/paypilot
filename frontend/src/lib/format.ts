export function timeAgo(unixSeconds: number, now = Date.now()): string {
  const diff = Math.max(0, now / 1000 - unixSeconds);
  if (diff < 10) return "just now";
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function fullTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString([], { dateStyle: "medium", timeStyle: "medium" });
}

export function pct(part: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}
