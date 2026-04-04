// Shared URL-keyed cache — 60s TTL keeps us within API rate limits
// Supports custom headers for authenticated APIs (CoinGecko Pro, Etherscan)

const cache = new Map<string, { data: unknown; expires: number }>();

export async function cachedFetch<T>(
  url: string,
  ttlMs = 60_000,
  headers?: Record<string, string>,
): Promise<T> {
  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) return hit.data as T;

  const res = await fetch(url, headers ? { headers } : undefined);
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);

  const data = await res.json();
  cache.set(url, { data, expires: Date.now() + ttlMs });
  return data as T;
}
