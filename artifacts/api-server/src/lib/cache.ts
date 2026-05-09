// artifacts/api-server/src/lib/cache.ts
export interface CacheEntry<T> {
  data: T;
  exp: number;
}

const cache = new Map<string, CacheEntry<any>>();

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.exp > Date.now()) {
    return entry.data as T;
  }
  return null;
}

export function setCached<T>(key: string, data: T, ttlMs: number) {
  cache.set(key, {
    data,
    exp: Date.now() + ttlMs,
  });
}

export async function cachedWithRefresh<T>(
  key: string,
  ttlMs: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  let data = getCached<T>(key);
  if (data !== null) return data;

  data = await fetchFn();
  setCached(key, data, ttlMs);
  return data;
}
