import "server-only";

/**
 * A tiny generic in-memory TTL cache with single-flight de-duplication.
 *
 * Single-flight matters here: it coalesces concurrent loads for the same key
 * into one upstream call, which protects the Finnhub free-tier 60 calls/min
 * budget when many requests (or many screener rows) ask for the same symbol at
 * once.
 *
 * Scope note: state is per Node process (not shared across instances) and is
 * lost on restart. That is acceptable for this single-instance assignment; see
 * docs/DECISIONS.md.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

// Values are heterogeneous across keys, so they are stored as `unknown` and
// narrowed back to T by the typed accessors below.
const store = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

/** Suggested time-to-live values per data type. */
export const TTL = {
  PROFILE_MS: 12 * 60 * 60 * 1000,
  METRICS_MS: 60 * 60 * 1000,
  QUOTE_MS: 8 * 1000,
} as const;

export function get<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (entry === undefined) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function set<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function invalidate(key: string): void {
  store.delete(key);
  inflight.delete(key);
}

/**
 * Return the cached value for `key`, or run `loader` (deduped across concurrent
 * callers), cache its result for `ttlMs`, and return it. A throwing loader is
 * NOT cached, so transient failures don't get pinned for the whole TTL.
 */
export async function getOrSet<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const cached = get<T>(key);
  if (cached !== undefined) return cached;

  const existing = inflight.get(key);
  if (existing !== undefined) return existing as Promise<T>;

  const promise = (async () => {
    try {
      const value = await loader();
      set(key, value, ttlMs);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}
