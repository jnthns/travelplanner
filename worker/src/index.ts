import { GoogleGenAI } from '@google/genai';

interface Env {
    GEMINI_API_KEYS: string; // Comma-separated list of keys
}

interface RequestBody {
    prompt: string;
    systemInstruction?: string;
    responseMimeType?: string;
    responseSchema?: Record<string, unknown>;
    model?: string;
}

const DEFAULT_GEMINI_MODEL = 'gemini-3-flash-preview';

const CORS_HEADERS: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: CORS_HEADERS });
        }

        if (request.method !== 'POST') {
            return json({ error: 'Method not allowed' }, 405);
        }

        const url = new URL(request.url);
        if (url.pathname !== '/generate') {
            return json({ error: 'Not found' }, 404);
        }

        let body: RequestBody;
        try {
            body = await request.json() as RequestBody;
        } catch {
            return json({ error: 'Invalid JSON body' }, 400);
        }

        const { prompt, systemInstruction, responseMimeType, responseSchema } = body;
        const model = typeof body.model === 'string' && body.model.trim()
            ? body.model.trim()
            : DEFAULT_GEMINI_MODEL;

        if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
            return json({ error: 'prompt is required' }, 400);
        }

        const keys = (env.GEMINI_API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);

        if (keys.length === 0) {
            // Fallback for transition period if the user still only has the old GEMINI_API_KEY bound
            const legacyKey = (env as any).GEMINI_API_KEY;
            if (legacyKey) keys.push(legacyKey.trim());
            else return json({ error: 'No API keys configured. Set GEMINI_API_KEYS secret.' }, 500);
        }

        const config: Record<string, unknown> = {};
        if (responseMimeType) config.responseMimeType = responseMimeType;
        if (responseSchema) config.responseJsonSchema = responseSchema;
        if (systemInstruction) config.systemInstruction = systemInstruction;

        // Start at a random index to softly balance load across keys
        const startIndex = Math.floor(Math.random() * keys.length);
        let lastError: any = null;

        for (let i = 0; i < keys.length; i++) {
            const keyIndex = (startIndex + i) % keys.length;
            const currentKey = keys[keyIndex];

            try {
                const ai = new GoogleGenAI({ apiKey: currentKey });

                const response = await ai.models.generateContent({
                    model,
                    contents: prompt,
                    config,
                });

                const text = response.text?.trim() ?? '';

                if (!text) {
                    throw new Error('Empty response from model');
                }

                return json({ text, model });
            } catch (err) {
                lastError = err;
                const message = err instanceof Error ? err.message : String(err);

                // If rate limited or quota exceeded, loop to the next key.
                if (/429|quota|rate|exhausted/i.test(message)) {
                    console.log(`Key at index ${keyIndex} rate limited. Attempting next key...`);
                    continue;
                }

                // If it's a 400 bad request (like malformed JSON schema), fail immediately. 
                // There's no point wasting other keys on a bad request.
                if (/400|invalid|bad/i.test(message)) {
                    return json({ error: message }, 400);
                }
            }
        }

        // If we exhaust all keys and break out of the loop
        const finalMessage = lastError instanceof Error ? lastError.message : String(lastError);
        const status = /429|quota|rate/i.test(finalMessage) ? 429 : 500;
        return json({ error: `All keys failed. Last error: ${finalMessage}` }, status);
    },
};
