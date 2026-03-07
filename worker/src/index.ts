import { GoogleGenAI } from '@google/genai';

interface Env {
    GEMINI_API_KEY: string;
}

interface RequestBody {
    prompt: string;
    maxTokens?: number;
}

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
        // Handle CORS preflight
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

        const { prompt, maxTokens = 500, systemInstruction, responseMimeType } = body as RequestBody & { systemInstruction?: string, responseMimeType?: string };

        if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
            return json({ error: 'prompt is required' }, 400);
        }

        const clampedTokens = Math.min(Math.max(1, maxTokens), 65536);

        try {
            const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    maxOutputTokens: clampedTokens,
                    temperature: 0.4,
                    ...(systemInstruction ? { systemInstruction } : {}),
                    ...(responseMimeType ? { responseMimeType } : {}),
                },
            });

            const text = response.text?.trim() ?? '';
            if (!text) {
                return json({ error: 'Empty response from model' }, 502);
            }

            return json({ text });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const status = /429|rate/i.test(message) ? 429 : 500;
            return json({ error: message }, status);
        }
    },
} satisfies ExportedHandler<Env>;
