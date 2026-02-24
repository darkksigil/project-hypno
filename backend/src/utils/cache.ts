import NodeCache from 'node-cache';

// ─── Cache instance ───────────────────────────────────────────
// stdTTL: default time-to-live in seconds (0 = never expires)
// checkperiod: how often to scan for expired keys (seconds)
const cache = new NodeCache({ stdTTL: 0, checkperiod: 120 });

// ─── getOrSet ─────────────────────────────────────────────────
// Returns cached value if present, otherwise calls fetchFn,
// stores the result under key with the given TTL, then returns it.
export async function getOrSet<T>(
  key:     string,
  ttlSecs: number,
  fetchFn: () => Promise<T>,
): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached !== undefined) return cached;

  const fresh = await fetchFn();
  cache.set(key, fresh, ttlSecs);
  return fresh;
}

// ─── invalidate ───────────────────────────────────────────────
// Call this after any write so reads don't serve stale data.
export function invalidate(key: string): void {
  cache.del(key);
}

// ─── invalidatePrefix ─────────────────────────────────────────
// Bust all keys that start with a given prefix.
// Useful when a group of related keys need to be cleared at once.
export function invalidatePrefix(prefix: string): void {
  const keys = cache.keys().filter((k) => k.startsWith(prefix));
  cache.del(keys);
}