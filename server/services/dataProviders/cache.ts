interface CacheEntry<T> {
  value: T;
  storedAt: number;
  ttlMs: number;
}

class DataCache {
  private store = new Map<string, CacheEntry<any>>();

  get<T>(key: string): { value: T; stale: boolean } | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.storedAt;
    const stale = age > entry.ttlMs;

    return { value: entry.value as T, stale };
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, {
      value,
      storedAt: Date.now(),
      ttlMs,
    });
  }

  clear(): void {
    this.store.clear();
  }
}

export const dataCache = new DataCache();

// TTL constants
export const FAST_TTL = 5 * 60_000;        // 5 min  — market prices
export const MEDIUM_TTL = 2 * 60 * 60_000; // 2 hours — policy rates
export const SLOW_TTL = 6 * 60 * 60_000;   // 6 hours — statistics
