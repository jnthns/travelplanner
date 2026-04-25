import { getAuth } from 'firebase/auth';

import {
  recordAiRequestAttempt,
  recordAiRequestFailure,
  recordAiRequestRetry,
  recordAiRequestSuccess,
} from './aiUsage';
import { emitGeminiRequestToast } from './geminiToastBridge';
import { getProxyUrl } from './proxyUrl';

const MIN_CALL_SPACING_MS = 1200;
export const DEFAULT_GEMINI_MODEL = 'gemini-3-flash-preview';

let lastCallAt = 0;
const inflight = new Map<string, Promise<string>>();

function isRateLimitError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof Error) return /\b429\b/.test(err.message) || /rate/i.test(err.message);
  if (typeof err === 'string') return /\b429\b/.test(err) || /rate/i.test(err);
  return false;
}

/** Thrown for proxy/body errors after the error toast was already emitted. */
class GeminiRequestError extends Error {
  readonly statusCode: number | null;

  constructor(message: string, statusCode: number | null) {
    super(message);
    this.name = 'GeminiRequestError';
    this.statusCode = statusCode;
  }
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
  options?: {
    systemInstruction?: string;
    responseMimeType?: 'text/plain' | 'application/json';
    responseSchema?: Record<string, unknown>;
    model?: string;
  }
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
    for (;;) {
      try {
        recordAiRequestAttempt(model);
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const token = await getAuth().currentUser?.getIdToken();
        if (token) headers.Authorization = `Bearer ${token}`;
        const response = await fetch(`${proxyUrl}/generate`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ prompt, systemInstruction, responseMimeType, responseSchema, model }),
        });

        const data = await response.json() as { text?: string; error?: string };

        if (!response.ok) {
          const msg = (data.error || 'Request failed').trim() || 'Request failed';
          emitGeminiRequestToast({ kind: 'error', message: msg, statusCode: response.status });
          throw new GeminiRequestError(data.error || `Proxy returned ${response.status}`, response.status);
        }

        const text = data.text?.trim() ?? '';
        if (!text) {
          const emptyMsg = 'Empty response from AI proxy';
          emitGeminiRequestToast({ kind: 'error', message: emptyMsg, statusCode: response.status });
          throw new GeminiRequestError('Empty response from AI proxy', response.status);
        }
        recordAiRequestSuccess();
        emitGeminiRequestToast({ kind: 'success', model });
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
        if (err instanceof GeminiRequestError) {
          // Error toast was already emitted in the try block.
          throw err;
        }
        const message =
          err instanceof Error
            ? err.message || 'Request failed'
            : String(err);
        emitGeminiRequestToast({ kind: 'error', message, statusCode: null });
        throw err instanceof Error ? err : new Error(String(err));
      }
    }
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, p);
  return p;
}
