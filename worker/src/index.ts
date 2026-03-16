import { GoogleGenAI } from '@google/genai';

interface Env {
    GEMINI_API_KEYS: string; // Comma-separated list of keys
    GOOGLE_PLACES_API_KEY: string;
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

const PLACES_BASE = 'https://places.googleapis.com/v1';

const GENERIC_TITLES = new Set(['breakfast', 'lunch', 'dinner', 'meal', 'eat', 'food', 'coffee', 'snack', 'stay', 'sleep', 'shop', 'sightsee', 'see', 'activity']);

function buildNearbyQuery(location: string, category?: string, title?: string): { textQuery: string; includedType?: string } {
    const rawTitle = typeof title === 'string' ? title.trim() : '';
    const isUsableTitle = rawTitle.length >= 3 && !GENERIC_TITLES.has(rawTitle.toLowerCase());
    if (isUsableTitle) {
        return { textQuery: `${rawTitle} near ${location}` };
    }
    const cat = typeof category === 'string' ? category.toLowerCase() : '';
    switch (cat) {
        case 'food':
            return { textQuery: `restaurants and cafes near ${location}`, includedType: 'restaurant' };
        case 'accommodation':
            return { textQuery: `hotels and lodgings near ${location}` };
        case 'shopping':
            return { textQuery: `shops and stores near ${location}` };
        case 'sightseeing':
            return { textQuery: `sights and attractions near ${location}` };
        case 'transport':
        case 'other':
        default:
            return { textQuery: `places near ${location}` };
    }
}

async function handlePlacesNearby(request: Request, env: Env): Promise<Response> {
    const key = env.GOOGLE_PLACES_API_KEY;
    if (!key?.trim()) return json({ error: 'GOOGLE_PLACES_API_KEY not configured' }, 500);

    let body: { location?: string; maxResults?: number; category?: string; title?: string };
    try {
        body = await request.json() as { location?: string; maxResults?: number; category?: string; title?: string };
    } catch {
        return json({ error: 'Invalid JSON body' }, 400);
    }
    const location = typeof body.location === 'string' ? body.location.trim() : '';
    if (!location) return json({ error: 'location is required' }, 400);

    const maxResults = typeof body.maxResults === 'number' && body.maxResults > 0 ? Math.min(body.maxResults, 20) : 5;
    const { textQuery, includedType } = buildNearbyQuery(location, body.category, body.title);

    const payload: { textQuery: string; pageSize: number; rankPreference: string; includedType?: string } = {
        textQuery,
        pageSize: maxResults,
        rankPreference: 'RELEVANCE',
    };
    if (includedType) payload.includedType = includedType;

    const fieldMask = 'places.id,places.displayName,places.primaryTypeDisplayName,places.priceLevel,places.rating,places.userRatingCount,places.formattedAddress,places.currentOpeningHours';

    try {
        const res = await fetch(`${PLACES_BASE}/places:searchText`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': key,
                'X-Goog-FieldMask': fieldMask,
            },
            body: JSON.stringify(payload),
        });
        const data = await res.json() as Record<string, unknown>;
        if (!res.ok) {
            const errMsg = (data as { error?: { message?: string } }).error?.message ?? `Google returned ${res.status}`;
            return json({ error: errMsg }, res.status >= 500 ? 502 : res.status);
        }
        return json(data);
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return json({ error: msg }, 502);
    }
}

async function handlePlacesDetails(request: Request, env: Env): Promise<Response> {
    const key = env.GOOGLE_PLACES_API_KEY;
    if (!key?.trim()) return json({ error: 'GOOGLE_PLACES_API_KEY not configured' }, 500);

    let body: { query?: string; placeId?: string; mode: 'resolve' | 'details' };
    try {
        body = await request.json() as { query?: string; placeId?: string; mode: 'resolve' | 'details' };
    } catch {
        return json({ error: 'Invalid JSON body' }, 400);
    }

    const mode = body.mode;
    if (mode === 'resolve') {
        const query = typeof body.query === 'string' ? body.query.trim() : '';
        if (!query) return json({ error: 'query is required for resolve mode' }, 400);
        try {
            const res = await fetch(`${PLACES_BASE}/places:searchText`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': key,
                    'X-Goog-FieldMask': 'places.id,places.displayName',
                },
                body: JSON.stringify({ textQuery: query, pageSize: 1 }),
            });
            const data = await res.json() as { places?: Array<{ id?: string }> };
            if (!res.ok) return json({ error: 'Place resolution failed' }, res.status >= 500 ? 502 : res.status);
            const placeId = data.places?.[0]?.id ?? null;
            return json({ placeId });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return json({ error: msg }, 502);
        }
    }

    if (mode === 'details') {
        const rawId = typeof body.placeId === 'string' ? body.placeId.trim() : '';
        if (!rawId) return json({ error: 'placeId is required for details mode' }, 400);
        const pathId = rawId.startsWith('places/') ? rawId.slice(7) : rawId;
        const fieldMask = 'displayName,rating,userRatingCount,reviews,reviewSummary,reviewSummary.reviewsUri,reviewSummary.disclosureText';
        try {
            const res = await fetch(`${PLACES_BASE}/places/${encodeURIComponent(pathId)}`, {
                method: 'GET',
                headers: {
                    'X-Goog-Api-Key': key,
                    'X-Goog-FieldMask': fieldMask,
                },
            });
            const data = await res.json() as Record<string, unknown>;
            if (!res.ok) {
                const errMsg = (data as { error?: { message?: string } }).error?.message ?? `Google returned ${res.status}`;
                return json({ error: errMsg }, res.status >= 500 ? 502 : res.status);
            }
            return json(data);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return json({ error: msg }, 502);
        }
    }

    return json({ error: 'mode must be resolve or details' }, 400);
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

        if (url.pathname.endsWith('/places/nearby')) {
            return handlePlacesNearby(request, env);
        }
        if (url.pathname.endsWith('/places/details')) {
            return handlePlacesDetails(request, env);
        }

        if (!url.pathname.endsWith('/generate')) {
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
