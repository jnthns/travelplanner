const MIN_CALL_SPACING_MS = 1200;
const MAX_RETRIES = 2;

let lastCallAt = 0;
const inflight = new Map<string, Promise<string>>();

function getProxyUrl(): string {
  const url = import.meta.env.VITE_AI_PROXY_URL as string | undefined;
  if (!url?.trim()) {
    throw new Error('AI proxy URL is not set. Add VITE_AI_PROXY_URL to your environment.');
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error(`AI proxy URL must be an absolute address (e.g. https://your-worker.workers.dev). Currently set to: "${url}"`);
  }
  return url.replace(/\/+$/, '');
}

function isRateLimitError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof Error) return /\b429\b/.test(err.message) || /rate/i.test(err.message);
  if (typeof err === 'string') return /\b429\b/.test(err) || /rate/i.test(err);
  return false;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Single-flight + spaced calls + retry-on-429 wrapper.
 * Calls the Cloudflare Worker proxy instead of Gemini directly.
 */
export async function generateWithGemini(
  prompt: string,
  options?: { maxTokens?: number; systemInstruction?: string; responseMimeType?: 'text/plain' | 'application/json' } | number
): Promise<string> {
  const opts = typeof options === 'number' ? { maxTokens: options } : (options || {});
  const { maxTokens = 500, systemInstruction, responseMimeType } = opts;

  const key = `${maxTokens}:${responseMimeType || 'text/plain'}:${systemInstruction || ''}:${prompt}`;
  const existing = inflight.get(key);
  if (existing) return existing;

  const p = (async () => {
    const now = Date.now();
    const waitFor = Math.max(0, MIN_CALL_SPACING_MS - (now - lastCallAt));
    if (waitFor > 0) await sleep(waitFor);
    lastCallAt = Date.now();

    const proxyUrl = getProxyUrl();
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const response = await fetch(`${proxyUrl}/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, maxTokens, systemInstruction, responseMimeType }),
        });

        const data = await response.json() as { text?: string; error?: string };

        if (!response.ok) {
          throw new Error(data.error || `Proxy returned ${response.status}`);
        }

        console.log('Gemini raw response:', data);
        const text = data.text?.trim() ?? '';
        if (!text) throw new Error('Empty response from AI proxy');
        return text;
      } catch (err) {
        if (attempt < MAX_RETRIES && isRateLimitError(err)) {
          const backoff = 1000 * Math.pow(2, attempt);
          attempt += 1;
          await sleep(backoff);
          continue;
        }
        throw err instanceof Error ? err : new Error(String(err));
      }
    }
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, p);
  return p;
}
