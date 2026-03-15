/**
 * Google Places API (New) — all calls via Cloudflare Worker proxy.
 * Never call places.googleapis.com from the frontend.
 */

import { getCachedAiText } from './ai/cache';
import { generateWithGemini } from './gemini';

const placeIdCache = new Map<string, string>(); // key: `${title}:${location}`

function getProxyUrl(): string {
  const url = import.meta.env.VITE_AI_PROXY_URL as string | undefined;
  if (!url?.trim()) throw new Error('VITE_AI_PROXY_URL is not set.');
  return url.replace(/\/+$/, '');
}

function mapPriceLevel(v?: string): PlaceResult['priceLevel'] {
  switch (v) {
    case 'PRICE_LEVEL_FREE': return 'Free';
    case 'PRICE_LEVEL_INEXPENSIVE': return '$';
    case 'PRICE_LEVEL_MODERATE': return '$$';
    case 'PRICE_LEVEL_EXPENSIVE': return '$$$';
    case 'PRICE_LEVEL_VERY_EXPENSIVE': return '$$$$';
    default: return 'Unknown';
  }
}

export interface PlaceResult {
  id: string;
  name: string;
  primaryType: string;
  priceLevel: '$' | '$$' | '$$$' | '$$$$' | 'Free' | 'Unknown';
  rating: number | null;
  ratingCount: number | null;
  isOpenNow: boolean | null;
  address: string | null;
}

export interface PlaceReview {
  text: string;
  rating: number;
  authorName: string;
  relativeTime: string;
}

export interface PlaceDetails {
  id: string;
  name: string;
  rating: number | null;
  ratingCount: number | null;
  reviewSummary: string | null;
  reviewSummaryDisclosure: string | null;
  reviews: PlaceReview[];
  reviewsUri?: string | null;
}

export interface PlaceProsCons {
  pros: string[];
  cons: string[];
  verdict: string;
}

export async function fetchNearbyRestaurants(location: string): Promise<PlaceResult[]> {
  const raw = await getCachedAiText({
    namespace: 'places-nearby',
    cacheKey: location,
    ttlMs: 3 * 60 * 60 * 1000,
    producer: async () => {
      const res = await fetch(`${getProxyUrl()}/places/nearby`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location, maxResults: 5 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed: ${res.status}`);
      return JSON.stringify(data);
    },
  });

  const data = JSON.parse(raw) as { places?: Array<{
    id?: string;
    displayName?: { text?: string };
    primaryTypeDisplayName?: { text?: string };
    priceLevel?: string;
    rating?: number;
    userRatingCount?: number;
    formattedAddress?: string;
    currentOpeningHours?: { openNow?: boolean };
  }> };

  const places = data.places ?? [];
  return places.map((p) => ({
    id: p.id ?? '',
    name: p.displayName?.text ?? '',
    primaryType: p.primaryTypeDisplayName?.text ?? '',
    priceLevel: mapPriceLevel(p.priceLevel),
    rating: typeof p.rating === 'number' ? p.rating : null,
    ratingCount: typeof p.userRatingCount === 'number' ? p.userRatingCount : null,
    isOpenNow: p.currentOpeningHours?.openNow ?? null,
    address: p.formattedAddress ?? null,
  }));
}

export async function resolvePlaceId(activityTitle: string, location: string): Promise<string | null> {
  const key = `${activityTitle}:${location}`;
  const cached = placeIdCache.get(key);
  if (cached) return cached;

  const query = `${activityTitle} ${location}`.trim();
  const res = await fetch(`${getProxyUrl()}/places/details`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, mode: 'resolve' }),
  });
  const data = (await res.json()) as { placeId?: string | null; error?: string };
  if (!res.ok) throw new Error(data.error ?? `Resolve failed: ${res.status}`);
  const placeId = data.placeId ?? null;
  if (placeId) placeIdCache.set(key, placeId);
  return placeId;
}

export async function fetchPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const raw = await getCachedAiText({
    namespace: 'place-details',
    cacheKey: placeId,
    ttlMs: 6 * 60 * 60 * 1000,
    producer: async () => {
      const res = await fetch(`${getProxyUrl()}/places/details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId, mode: 'details' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed: ${res.status}`);
      return JSON.stringify(data);
    },
  });

  const data = JSON.parse(raw) as {
    displayName?: { text?: string };
    rating?: number;
    userRatingCount?: number;
    reviewSummary?: { text?: string; reviewsUri?: string; disclosureText?: string };
    reviews?: Array<{
      text?: { text?: string };
      rating?: number;
      authorAttribution?: { displayName?: string };
      relativePublishTimeDescription?: string;
    }>;
  };

  const name = data.displayName?.text ?? '';
  const reviews: PlaceReview[] = (data.reviews ?? []).map((r) => ({
    text: r.text?.text ?? '',
    rating: r.rating ?? 0,
    authorName: r.authorAttribution?.displayName ?? '',
    relativeTime: r.relativePublishTimeDescription ?? '',
  }));

  return {
    id: placeId,
    name,
    rating: typeof data.rating === 'number' ? data.rating : null,
    ratingCount: typeof data.userRatingCount === 'number' ? data.userRatingCount : null,
    reviewSummary: data.reviewSummary?.text ?? null,
    reviewSummaryDisclosure: data.reviewSummary?.disclosureText ?? null,
    reviewsUri: data.reviewSummary?.reviewsUri ?? null,
    reviews,
  };
}

const PROS_CONS_SCHEMA = {
  type: 'object',
  properties: {
    pros: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 },
    cons: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 },
    verdict: { type: 'string' },
  },
  required: ['pros', 'cons', 'verdict'],
  additionalProperties: false,
};

export async function generateProsCons(placeName: string, reviews: PlaceReview[], placeId: string): Promise<PlaceProsCons> {
  const raw = await getCachedAiText({
    namespace: 'place-pros-cons',
    cacheKey: placeId,
    ttlMs: 24 * 60 * 60 * 1000,
    producer: async () => {
      const reviewText = reviews.map((r) => `[${r.rating}★] ${r.authorName}: ${r.text}`).join('\n\n');
      const prompt = `Place: ${placeName}\n\nReviews:\n${reviewText}\n\nIdentify the 3 most commonly mentioned pros and 3 cons. Be specific and factual. One sentence verdict.`;
      return generateWithGemini(prompt, {
        systemInstruction: 'You are a concise travel assistant. Analyze these reviews and identify the 3 most commonly mentioned pros and cons. Be specific and factual.',
        responseMimeType: 'application/json',
        responseSchema: PROS_CONS_SCHEMA as Record<string, unknown>,
      });
    },
  });

  const parsed = JSON.parse(raw) as { pros?: string[]; cons?: string[]; verdict?: string };
  return {
    pros: Array.isArray(parsed.pros) ? parsed.pros.slice(0, 3) : [],
    cons: Array.isArray(parsed.cons) ? parsed.cons.slice(0, 3) : [],
    verdict: typeof parsed.verdict === 'string' ? parsed.verdict : '',
  };
}
