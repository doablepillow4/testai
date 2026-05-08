interface CacheEntry<T> {
  value: T;
  expiry: number;
}

export class TTLCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private staleStore = new Map<string, unknown>();
  private refreshing = new Set<string>();
  private maxSize: number;

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  getStale<T>(key: string): T | undefined {
    return this.staleStore.get(key) as T | undefined;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    if (this.store.size >= this.maxSize) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }
    this.store.set(key, { value, expiry: Date.now() + ttlMs });
    this.staleStore.set(key, value);
  }

  isRefreshing(key: string): boolean {
    return this.refreshing.has(key);
  }

  markRefreshing(key: string): void {
    this.refreshing.add(key);
  }

  clearRefreshing(key: string): void {
    this.refreshing.delete(key);
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    let count = 0;
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiry) this.store.delete(key);
      else count++;
    }
    return count;
  }
}

export const marketCache = new TTLCache(200);
export const latticeCache = new TTLCache(100);
export const polymarketCache = new TTLCache(50);
export const fearGreedCache = new TTLCache(10);

export const TTL = {
  MARKET_PRICE: 5 * 60 * 1000,
  MARKET_HISTORY: 10 * 60 * 1000,
  LATTICE_RUN: 5 * 60 * 1000,
  POLYMARKET: 5 * 60 * 1000,
  FEAR_GREED: 30 * 60 * 1000,
  NEWS: 10 * 60 * 1000,
} as const;

export async function getOrFetch<T>(
  cache: TTLCache,
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached !== undefined) return cached;

  const stale = cache.getStale<T>(key);
  if (stale !== undefined) {
    if (!cache.isRefreshing(key)) {
      cache.markRefreshing(key);
      fetcher()
        .then((value) => {
          cache.set(key, value, ttlMs);
        })
        .catch(() => {
          cache.set(key, stale, Math.min(60_000, ttlMs));
        })
        .finally(() => {
          cache.clearRefreshing(key);
        });
    }
    return stale;
  }

  try {
    const value = await fetcher();
    cache.set(key, value, ttlMs);
    return value;
  } catch (err) {
    const fallbackStale = cache.getStale<T>(key);
    if (fallbackStale !== undefined) {
      cache.set(key, fallbackStale, Math.min(60_000, ttlMs));
      return fallbackStale;
    }
    throw err;
  }
}
