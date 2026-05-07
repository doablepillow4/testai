interface CacheEntry<T> {
  value: T;
  expiry: number;
}

export class TTLCache {
  private store = new Map<string, CacheEntry<unknown>>();
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

  set<T>(key: string, value: T, ttlMs: number): void {
    if (this.store.size >= this.maxSize) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }
    this.store.set(key, { value, expiry: Date.now() + ttlMs });
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
  MARKET_HISTORY: 5 * 60 * 1000,
  LATTICE_RUN: 5 * 60 * 1000,
  POLYMARKET: 5 * 60 * 1000,
  FEAR_GREED: 30 * 60 * 1000,
  NEWS: 5 * 60 * 1000,
} as const;

export async function getOrFetch<T>(
  cache: TTLCache,
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached !== undefined) return cached;
  const value = await fetcher();
  cache.set(key, value, ttlMs);
  return value;
}
