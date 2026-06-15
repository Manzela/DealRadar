/**
 * Upstash Redis (REST) cache layer. TTL default 30 minutes — the hard freshness
 * bound from the project constraints ("never stale beyond 30 minutes").
 *
 * Degrades gracefully: if UPSTASH_* env vars are absent (local dev without
 * Redis), every get() misses and set() is a no-op, so the app still works —
 * it just hits Supabase every time.
 */
const URL_ = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export const CACHE_TTL_SECONDS = 30 * 60;

async function command<T>(args: (string | number)[]): Promise<T | null> {
  if (!URL_ || !TOKEN) return null;
  try {
    const res = await fetch(`${URL_}/${args.map((a) => encodeURIComponent(String(a))).join('/')}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { result: T };
    return body.result;
  } catch (e) {
    console.error('[redis] command failed:', e);
    return null;
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await command<string | null>(['GET', key]);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = CACHE_TTL_SECONDS): Promise<void> {
  await command(['SET', key, JSON.stringify(value), 'EX', ttlSeconds]);
}

/** Stable cache key from route + sorted params. */
export function cacheKey(scope: string, params: Record<string, string | number | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);
  return `dealradar:${scope}:${parts.join('&')}`;
}
