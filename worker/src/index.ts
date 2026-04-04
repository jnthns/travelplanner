import { GoogleGenAI } from '@google/genai';

interface Env {
    GEMINI_API_KEYS: string; // Comma-separated list of keys
    GOOGLE_PLACES_API_KEY: string;
    /** Firebase project ID — used as expected JWT aud and in iss host path. */
    FIREBASE_PROJECT_ID: string;
    /** Optional: comma-separated web origins (e.g. https://app.example.com). If unset, Access-Control-Allow-Origin is *. */
    ALLOWED_ORIGINS?: string;
    GEMINI_API_KEY?: string; // legacy single key (wrangler secret)
}

interface RequestBody {
    prompt: string;
    systemInstruction?: string;
    responseMimeType?: string;
    responseSchema?: Record<string, unknown>;
    model?: string;
}

const DEFAULT_GEMINI_MODEL = 'gemini-3-flash-preview';

/** Models the worker will call (prevents arbitrary / expensive model strings). Extend via code when you adopt new models. */
const ALLOWED_GEMINI_MODELS = new Set<string>([
    DEFAULT_GEMINI_MODEL,
    'gemini-2.0-flash',
    'gemini-2.5-flash-preview-05-20',
    'gemini-3.1-pro-preview',
]);

const MAX_JSON_BODY_BYTES = 512 * 1024;
const MAX_PROMPT_CHARS = 200_000;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_GENERATE = 60;
const RATE_MAX_PLACES = 120;

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

const FIREBASE_JWKS_URL =
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const JWKS_CACHE_TTL_MS = 3_600_000;
const JWT_CLOCK_SKEW_SEC = 60;

let jwksCache: { keys: unknown[]; fetchedAt: number } = { keys: [], fetchedAt: 0 };

interface FirebaseJwkKey {
    kid?: string;
    kty?: string;
    n?: string;
    e?: string;
}

function b64UrlToUint8Array(segment: string): Uint8Array {
    let base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    if (pad) base64 += '='.repeat(4 - pad);
    const binary = atob(base64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
}

async function getCachedJwksKeys(): Promise<unknown[]> {
    const now = Date.now();
    if (jwksCache.keys.length > 0 && now - jwksCache.fetchedAt < JWKS_CACHE_TTL_MS) {
        return jwksCache.keys;
    }
    const res = await fetch(FIREBASE_JWKS_URL);
    if (!res.ok) {
        throw new Error(`JWKS HTTP ${res.status}`);
    }
    const data = (await res.json()) as { keys?: unknown[] };
    const keys = Array.isArray(data.keys) ? data.keys : [];
    jwksCache = { keys, fetchedAt: now };
    return keys;
}

function isFirebaseJwkKey(k: unknown): k is FirebaseJwkKey {
    if (k === null || typeof k !== 'object') return false;
    const o = k as Record<string, unknown>;
    return o.kty === 'RSA' && typeof o.n === 'string' && typeof o.e === 'string';
}

async function importRsaVerifyKeyFromJwk(jwk: FirebaseJwkKey): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        'jwk',
        {
            kty: 'RSA',
            n: jwk.n,
            e: jwk.e,
            alg: 'RS256',
            ext: true,
        } as JsonWebKey,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify'],
    );
}

/**
 * Verifies Firebase ID token (RS256) via JWKS + Web Crypto. Returns null if valid.
 */
async function verifyFirebaseIdToken(token: string, projectId: string): Promise<string | null> {
    const parts = token.split('.');
    if (parts.length !== 3) return 'Malformed token';

    const [headerB64, payloadB64, sigB64] = parts;
    let headerJson: { alg?: string; kid?: string };
    let payload: Record<string, unknown>;
    try {
        headerJson = JSON.parse(new TextDecoder().decode(b64UrlToUint8Array(headerB64))) as {
            alg?: string;
            kid?: string;
        };
        payload = JSON.parse(new TextDecoder().decode(b64UrlToUint8Array(payloadB64))) as Record<
            string,
            unknown
        >;
    } catch {
        return 'Invalid token encoding';
    }

    if (headerJson.alg !== 'RS256') return 'Invalid algorithm';
    const kid = headerJson.kid;
    if (!kid || typeof kid !== 'string') return 'Missing key id';

    const keys = await getCachedJwksKeys();
    const jwk = keys.find((k) => isFirebaseJwkKey(k) && k.kid === kid);
    if (!jwk || !isFirebaseJwkKey(jwk)) return 'Unknown signing key';

    let cryptoKey: CryptoKey;
    try {
        cryptoKey = await importRsaVerifyKeyFromJwk(jwk);
    } catch {
        return 'Invalid signing key';
    }

    const signedBytes = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    let sigBytes: Uint8Array;
    try {
        sigBytes = b64UrlToUint8Array(sigB64);
    } catch {
        return 'Invalid signature encoding';
    }

    let ok: boolean;
    try {
        ok = await crypto.subtle.verify(
            { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
            cryptoKey,
            sigBytes,
            signedBytes,
        );
    } catch {
        return 'Verification failed';
    }
    if (!ok) return 'Invalid signature';

    const nowSec = Math.floor(Date.now() / 1000);
    const exp = payload.exp;
    if (typeof exp !== 'number' || exp < nowSec - JWT_CLOCK_SKEW_SEC) {
        return 'Token expired';
    }

    const expectedIss = `https://securetoken.google.com/${projectId}`;
    if (payload.iss !== expectedIss) return 'Invalid issuer';

    const aud = payload.aud;
    if (aud !== projectId) return 'Invalid audience';

    return null;
}

async function requireFirebaseAuth(
    request: Request,
    env: Env,
    cors: Record<string, string> | null,
): Promise<Response | null> {
    const projectId = env.FIREBASE_PROJECT_ID?.trim();
    if (!projectId) {
        return json({ error: 'Server misconfiguration' }, 500, cors);
    }

    const auth = request.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
        return json({ error: 'Unauthorized' }, 401, cors);
    }
    const token = auth.slice(7).trim();
    if (!token) {
        return json({ error: 'Unauthorized' }, 401, cors);
    }

    try {
        const err = await verifyFirebaseIdToken(token, projectId);
        if (err) {
            return json({ error: 'Unauthorized' }, 401, cors);
        }
    } catch {
        return json({ error: 'Unauthorized' }, 401, cors);
    }

    return null;
}

function getClientId(request: Request): string {
    return request.headers.get('CF-Connecting-IP')
        ?? request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
        ?? 'unknown';
}

function allowRequest(key: string, maxPerWindow: number): boolean {
    const now = Date.now();
    const entry = rateBuckets.get(key);
    if (!entry || now > entry.resetAt) {
        rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return true;
    }
    if (entry.count >= maxPerWindow) return false;
    entry.count += 1;
    return true;
}

function parseAllowedOrigins(env: Env): string[] {
    return (env.ALLOWED_ORIGINS ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

function corsHeadersFor(request: Request, env: Env): Record<string, string> | null {
    const allowed = parseAllowedOrigins(env);
    const origin = request.headers.get('Origin');
    const base: Record<string, string> = {
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    if (allowed.length === 0) {
        return { ...base, 'Access-Control-Allow-Origin': '*' };
    }
    if (!origin || allowed.includes(origin)) {
        const o = origin ?? allowed[0];
        return { ...base, 'Access-Control-Allow-Origin': o, Vary: 'Origin' };
    }
    return null;
}

function json(data: unknown, status = 200, cors: Record<string, string> | null): Response {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(cors ?? { 'Access-Control-Allow-Origin': '*' }),
    };
    return new Response(JSON.stringify(data), { status, headers });
}

/** Generic client-safe message; full detail is logged via logWorkerError. */
function sanitizeClientError(status: number): string {
    if (status === 400) return 'Invalid request parameters';
    if (status === 429) return 'Too many requests';
    if (status >= 500) return 'Upstream service error';
    return 'Request failed';
}

function logWorkerError(path: string, status: number, detail: string): void {
    console.error('Worker error:', { path, status, detail });
}

async function readJsonBody(request: Request, cors: Record<string, string> | null): Promise<unknown | Response> {
    const len = request.headers.get('content-length');
    if (len) {
        const n = parseInt(len, 10);
        if (Number.isFinite(n) && n > MAX_JSON_BODY_BYTES) {
            return json({ error: 'Payload too large' }, 413, cors);
        }
    }
    try {
        const text = await request.text();
        if (text.length > MAX_JSON_BODY_BYTES) {
            return json({ error: 'Payload too large' }, 413, cors);
        }
        return text ? JSON.parse(text) : {};
    } catch {
        return json({ error: 'Invalid JSON body' }, 400, cors);
    }
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

async function handlePlacesNearby(request: Request, env: Env, cors: Record<string, string> | null): Promise<Response> {
    const key = env.GOOGLE_PLACES_API_KEY;
    if (!key?.trim()) return json({ error: 'GOOGLE_PLACES_API_KEY not configured' }, 500, cors);

    const parsed = await readJsonBody(request, cors);
    if (parsed instanceof Response) return parsed;

    const body = parsed as { location?: string; maxResults?: number; category?: string; title?: string };
    const location = typeof body.location === 'string' ? body.location.trim() : '';
    if (!location) return json({ error: 'location is required' }, 400, cors);

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
            const outStatus = res.status >= 500 ? 502 : res.status;
            logWorkerError(new URL(request.url).pathname, res.status, errMsg);
            return json({ error: sanitizeClientError(outStatus) }, outStatus, cors);
        }
        return json(data, 200, cors);
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logWorkerError(new URL(request.url).pathname, 502, msg);
        return json({ error: sanitizeClientError(502) }, 502, cors);
    }
}

async function handlePlacesDetails(request: Request, env: Env, cors: Record<string, string> | null): Promise<Response> {
    const key = env.GOOGLE_PLACES_API_KEY;
    if (!key?.trim()) return json({ error: 'GOOGLE_PLACES_API_KEY not configured' }, 500, cors);

    const parsed = await readJsonBody(request, cors);
    if (parsed instanceof Response) return parsed;

    const body = parsed as { query?: string; placeId?: string; mode: 'resolve' | 'details' };

    const mode = body.mode;
    if (mode === 'resolve') {
        const query = typeof body.query === 'string' ? body.query.trim() : '';
        if (!query) return json({ error: 'query is required for resolve mode' }, 400, cors);
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
            const data = await res.json() as { places?: Array<{ id?: string }>; error?: { message?: string } };
            if (!res.ok) {
                const errMsg = data.error?.message ?? `Google returned ${res.status}`;
                const outStatus = res.status >= 500 ? 502 : res.status;
                logWorkerError(new URL(request.url).pathname, res.status, errMsg);
                return json({ error: sanitizeClientError(outStatus) }, outStatus, cors);
            }
            const placeId = data.places?.[0]?.id ?? null;
            return json({ placeId }, 200, cors);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            logWorkerError(new URL(request.url).pathname, 502, msg);
            return json({ error: sanitizeClientError(502) }, 502, cors);
        }
    }

    if (mode === 'details') {
        const rawId = typeof body.placeId === 'string' ? body.placeId.trim() : '';
        if (!rawId) return json({ error: 'placeId is required for details mode' }, 400, cors);
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
                const outStatus = res.status >= 500 ? 502 : res.status;
                logWorkerError(new URL(request.url).pathname, res.status, errMsg);
                return json({ error: sanitizeClientError(outStatus) }, outStatus, cors);
            }
            return json(data, 200, cors);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            logWorkerError(new URL(request.url).pathname, 502, msg);
            return json({ error: sanitizeClientError(502) }, 502, cors);
        }
    }

    return json({ error: 'mode must be resolve or details' }, 400, cors);
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const cors = corsHeadersFor(request, env);
        if (!cors) {
            // Reflect the origin so the browser can read the error body (non-sensitive).
            const blockedOrigin = request.headers.get('Origin') ?? '*';
            return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
                status: 403,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': blockedOrigin,
                    'Vary': 'Origin',
                },
            });
        }

        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: { ...cors, 'Access-Control-Max-Age': '86400' },
            });
        }

        if (request.method !== 'POST') {
            return json({ error: 'Method not allowed' }, 405, cors);
        }

        const url = new URL(request.url);
        const requiresFirebaseAuth =
            url.pathname.endsWith('/generate') ||
            url.pathname.endsWith('/places/nearby') ||
            url.pathname.endsWith('/places/details');
        if (requiresFirebaseAuth) {
            const authResponse = await requireFirebaseAuth(request, env, cors);
            if (authResponse) return authResponse;
        }

        const clientId = getClientId(request);

        if (url.pathname.endsWith('/places/nearby')) {
            if (!allowRequest(`places:nearby:${clientId}`, RATE_MAX_PLACES)) {
                return json({ error: 'Too many requests' }, 429, cors);
            }
            return handlePlacesNearby(request, env, cors);
        }
        if (url.pathname.endsWith('/places/details')) {
            if (!allowRequest(`places:details:${clientId}`, RATE_MAX_PLACES)) {
                return json({ error: 'Too many requests' }, 429, cors);
            }
            return handlePlacesDetails(request, env, cors);
        }

        if (!url.pathname.endsWith('/generate')) {
            return json({ error: 'Not found' }, 404, cors);
        }

        if (!allowRequest(`generate:${clientId}`, RATE_MAX_GENERATE)) {
            return json({ error: 'Too many requests' }, 429, cors);
        }

        const parsed = await readJsonBody(request, cors);
        if (parsed instanceof Response) return parsed;

        const body = parsed as RequestBody;

        const { prompt, systemInstruction, responseMimeType, responseSchema } = body;
        const modelRaw = typeof body.model === 'string' && body.model.trim()
            ? body.model.trim()
            : DEFAULT_GEMINI_MODEL;

        if (!ALLOWED_GEMINI_MODELS.has(modelRaw)) {
            return json({ error: 'Model not allowed' }, 400, cors);
        }
        const model = modelRaw;

        if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
            return json({ error: 'prompt is required' }, 400, cors);
        }
        if (prompt.length > MAX_PROMPT_CHARS) {
            return json({ error: 'prompt too long' }, 400, cors);
        }

        const keys = (env.GEMINI_API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);

        if (keys.length === 0) {
            const legacyKey = env.GEMINI_API_KEY;
            if (legacyKey) keys.push(legacyKey.trim());
            else return json({ error: 'No API keys configured. Set GEMINI_API_KEYS secret.' }, 500, cors);
        }

        const config: Record<string, unknown> = {};
        if (responseMimeType) config.responseMimeType = responseMimeType;
        if (responseSchema) config.responseJsonSchema = responseSchema;
        if (systemInstruction) config.systemInstruction = systemInstruction;

        const startIndex = Math.floor(Math.random() * keys.length);
        let lastError: unknown = null;

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

                return json({ text, model }, 200, cors);
            } catch (err) {
                lastError = err;
                const message = err instanceof Error ? err.message : String(err);

                if (/429|quota|rate|exhausted/i.test(message)) {
                    console.log(`Key at index ${keyIndex} rate limited. Attempting next key...`);
                    continue;
                }

                if (/400|invalid|bad/i.test(message)) {
                    logWorkerError(url.pathname, 400, message);
                    return json({ error: sanitizeClientError(400) }, 400, cors);
                }
            }
        }

        const finalMessage = lastError instanceof Error ? lastError.message : String(lastError);
        const status = /429|quota|rate/i.test(finalMessage) ? 429 : 500;
        logWorkerError(url.pathname, status, finalMessage);
        return json({ error: sanitizeClientError(status) }, status, cors);
    },
};
