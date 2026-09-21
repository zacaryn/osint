const UA = "OSINT-Watch/1.0 (local research dashboard)";

export async function fetchText(
  url: string,
  timeoutMs = 16000,
  extraHeaders: Record<string, string> = {},
): Promise<{ ok: boolean; status: number; text: string; ms: number }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        Accept: "application/json, application/xml, text/xml, text/csv, */*",
        ...extraHeaders,
      },
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, ms: Date.now() - started };
  } finally {
    clearTimeout(t);
  }
}

export async function fetchJson<T>(url: string, timeoutMs = 16000): Promise<{ data: T; ms: number }> {
  const res = await fetchText(url, timeoutMs);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return { data: JSON.parse(res.text) as T, ms: res.ms };
}

export function timed<T>(
  id: string,
  fn: () => Promise<T>,
): Promise<{ id: string; ok: true; value: T; ms: number } | { id: string; ok: false; error: string; ms: number }> {
  const started = Date.now();
  return fn()
    .then((value) => ({ id, ok: true as const, value, ms: Date.now() - started }))
    .catch((err: unknown) => ({
      id,
      ok: false as const,
      error: err instanceof Error ? err.message : String(err),
      ms: Date.now() - started,
    }));
}
