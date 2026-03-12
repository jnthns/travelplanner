interface CachedAiEntry {
  expiresAt: number;
  value: string;
}

const CACHE_PREFIX = 'travelplanner_ai_cache_v1';
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;

function hashString(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function getCacheStorageKey(namespace: string, cacheKey: string): string {
  return `${CACHE_PREFIX}:${namespace}:${hashString(cacheKey)}`;
}

function readCacheEntry(storageKey: string): CachedAiEntry | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CachedAiEntry>;
    if (typeof parsed.value !== 'string' || typeof parsed.expiresAt !== 'number') {
      window.localStorage.removeItem(storageKey);
      return null;
    }

    if (parsed.expiresAt <= Date.now()) {
      window.localStorage.removeItem(storageKey);
      return null;
    }

    return { value: parsed.value, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

function writeCacheEntry(storageKey: string, value: string, ttlMs: number) {
  if (typeof window === 'undefined') return;

  try {
    const entry: CachedAiEntry = {
      value,
      expiresAt: Date.now() + ttlMs,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(entry));
  } catch {
    // Ignore cache write failures and fall back to uncached behavior.
  }
}

export async function getCachedAiText(args: {
  namespace: string;
  cacheKey: string;
  producer: () => Promise<string>;
  ttlMs?: number;
}): Promise<string> {
  const { namespace, cacheKey, producer, ttlMs = DEFAULT_TTL_MS } = args;
  const storageKey = getCacheStorageKey(namespace, cacheKey);
  const existing = readCacheEntry(storageKey);
  if (existing) return existing.value;

  const value = await producer();
  writeCacheEntry(storageKey, value, ttlMs);
  return value;
}
