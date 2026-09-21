export function timeAgo(value?: string | number): string {
  if (!value) return "";
  const ts = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(ts)) return "";
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function utcClock(now: Date): string {
  return now.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

export function gibsDate(offsetDays = 1): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return d.toISOString().slice(0, 10);
}

export function compact(n?: number): string {
  if (n == null) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
