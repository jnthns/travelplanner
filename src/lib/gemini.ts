import { GoogleGenAI } from '@google/genai';

const MODEL = 'gemini-2.5-flash';
const MIN_CALL_SPACING_MS = 1200;
const MAX_RETRIES = 2;

let lastCallAt = 0;
const inflight = new Map<string, Promise<string>>();

function getClient() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey?.trim()) {
    throw new Error('Gemini API key is not set. Add VITE_GEMINI_API_KEY to your environment.');
  }
  return new GoogleGenAI({ apiKey });
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
 * This ensures we do NOT send multiple requests for a single “Suggest” click.
 */
export async function generateWithGemini(prompt: string, maxTokens = 500): Promise<string> {
  const key = `${MODEL}:${maxTokens}:${prompt}`;
  const existing = inflight.get(key);
  if (existing) return existing;

  const p = (async () => {
    // Basic spacing to reduce accidental bursts across the app.
    const now = Date.now();
    const waitFor = Math.max(0, MIN_CALL_SPACING_MS - (now - lastCallAt));
    if (waitFor > 0) await sleep(waitFor);
    lastCallAt = Date.now();

    const ai = getClient();
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const response = await ai.models.generateContent({
          model: MODEL,
          contents: prompt,
          config: {
            maxOutputTokens: maxTokens,
            temperature: 0.4,
          },
        });
        const text = response.text?.trim?.() ?? '';
        if (!text) throw new Error('Empty or invalid response from Gemini');
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
