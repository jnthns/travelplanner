
import {
  recordAiRequestAttempt,
  recordAiRequestFailure,
  recordAiRequestRetry,
  recordAiRequestSuccess,
} from './aiUsage';

const MIN_CALL_SPACING_MS = 1200;
export const DEFAULT_GEMINI_MODEL = 'gemini-3-flash-preview';

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
  options?: { systemInstruction?: string; responseMimeType?: 'text/plain' | 'application/json', responseSchema?: Record<string, any>, model?: string }
): Promise<string> {
  const opts = options || {};
  const { systemInstruction, responseMimeType, responseSchema } = opts;
  const model = opts.model?.trim() || DEFAULT_GEMINI_MODEL;

  const key = `${model}:${responseMimeType || 'text/plain'}:${systemInstruction || ''}:${prompt}`;
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
        recordAiRequestAttempt(model);
        const response = await fetch(`${proxyUrl}/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, systemInstruction, responseMimeType, responseSchema, model }),
        });

        const data = await response.json() as { text?: string; error?: string };

        if (!response.ok) {
          throw new Error(data.error || `Proxy returned ${response.status}`);
        }

        const text = data.text?.trim() ?? '';
        if (!text) throw new Error('Empty response from AI proxy');
        recordAiRequestSuccess();
        return text;
      } catch (err) {
        if (attempt < 3 && isRateLimitError(err)) {
          const backoff = 1000 * Math.pow(2, attempt) + Math.random() * 500;
          attempt += 1;
          recordAiRequestRetry();
          await sleep(backoff);
          continue;
        }
        recordAiRequestFailure();
        throw err instanceof Error ? err : new Error(String(err));
      }
    }
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, p);
  return p;
}
