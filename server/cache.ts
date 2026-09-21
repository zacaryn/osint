type Entry<T> = { exp: number; value: T; inflight?: Promise<T> };

const store = new Map<string, Entry<unknown>>();

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.exp > Date.now()) return hit.value;
  if (hit?.inflight) return hit.inflight;

  const inflight = fn()
    .then((value) => {
      store.set(key, { exp: Date.now() + ttlMs, value });
      return value;
    })
    .catch((err) => {
      store.delete(key);
      throw err;
    });

  store.set(key, { exp: 0, value: hit?.value as T, inflight });
  return inflight;
}

/** Forces the next read of a key to refetch, e.g. after the account list changes. */
export function clearCache(key: string): void {
  store.delete(key);
}
