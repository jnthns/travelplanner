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

export type ActivityCategory = 'sightseeing' | 'food' | 'accommodation' | 'transport' | 'shopping' | 'other';

const NEARBY_PLACES_LABELS: Record<ActivityCategory, { button: string; panel: string }> = {
  food: { button: 'Find restaurants', panel: 'Restaurants nearby' },
  accommodation: { button: 'Find accommodations', panel: 'Accommodations nearby' },
  shopping: { button: 'Find shops', panel: 'Shops nearby' },
  sightseeing: { button: 'Find sights', panel: 'Sights nearby' },
  transport: { button: 'Find places', panel: 'Places nearby' },
  other: { button: 'Find places', panel: 'Places nearby' },
};

export function getNearbyPlacesLabel(category: ActivityCategory | undefined): { button: string; panel: string } {
  const key = (category && category in NEARBY_PLACES_LABELS ? category : 'other') as ActivityCategory;
  return NEARBY_PLACES_LABELS[key];
}

interface PlacesNearbyResponse {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    primaryTypeDisplayName?: { text?: string };
    priceLevel?: string;
    rating?: number;
    userRatingCount?: number;
    formattedAddress?: string;
    currentOpeningHours?: { openNow?: boolean };
  }>;
}

function parseNearbyResponse(raw: string): PlaceResult[] {
  const data = JSON.parse(raw) as PlacesNearbyResponse;
  const places = data.places ?? [];
  const results: PlaceResult[] = places.map((p) => ({
    id: p.id ?? '',
    name: p.displayName?.text ?? '',
    primaryType: p.primaryTypeDisplayName?.text ?? '',
    priceLevel: mapPriceLevel(p.priceLevel),
    rating: typeof p.rating === 'number' ? p.rating : null,
    ratingCount: typeof p.userRatingCount === 'number' ? p.userRatingCount : null,
    isOpenNow: p.currentOpeningHours?.openNow ?? null,
    address: p.formattedAddress ?? null,
  }));
  results.sort((a, b) => (b.ratingCount ?? 0) - (a.ratingCount ?? 0));
  return results;
}

export async function fetchNearbyPlaces(
  location: string,
  category?: string,
  title?: string
): Promise<PlaceResult[]> {
  const cacheKey = [location, category ?? '', title ?? ''].join('|');
  const raw = await getCachedAiText({
    namespace: 'places-nearby',
    cacheKey,
    ttlMs: 3 * 60 * 60 * 1000,
    producer: async () => {
      const res = await fetch(`${getProxyUrl()}/places/nearby`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location, category, title, maxResults: 20 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed: ${res.status}`);
      return JSON.stringify(data);
    },
  });
  return parseNearbyResponse(raw);
}

export async function fetchNearbyRestaurants(location: string): Promise<PlaceResult[]> {
  return fetchNearbyPlaces(location, 'food');
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
    displayName?: { text?: string; languageCode?: string } | string;
    rating?: number;
    userRatingCount?: number;
    reviewSummary?: {
      text?: string | { text?: string; languageCode?: string };
      reviewsUri?: string;
      disclosureText?: string | { text?: string; languageCode?: string };
    };
    reviews?: Array<{
      text?: { text?: string; languageCode?: string } | string;
      rating?: number;
      authorAttribution?: { displayName?: string };
      relativePublishTimeDescription?: string;
    }>;
  };

  // Places API (New) can return LocalizedText as { text, languageCode }; always normalize to string for React
  const textOf = (v: string | { text?: string; languageCode?: string } | null | undefined): string =>
    typeof v === 'string' ? v : (v && typeof v === 'object' && typeof (v as { text?: string }).text === 'string' ? (v as { text: string }).text : '');

  const name = textOf(data.displayName);
  const reviews: PlaceReview[] = (data.reviews ?? []).map((r) => ({
    text: textOf(r.text),
    rating: r.rating ?? 0,
    authorName: r.authorAttribution?.displayName ?? '',
    relativeTime: r.relativePublishTimeDescription ?? '',
  }));

  const reviewSummaryRaw = data.reviewSummary?.text;
  const disclosureRaw = data.reviewSummary?.disclosureText;

  return {
    id: placeId,
    name,
    rating: typeof data.rating === 'number' ? data.rating : null,
    ratingCount: typeof data.userRatingCount === 'number' ? data.userRatingCount : null,
    reviewSummary: textOf(reviewSummaryRaw) || null,
    reviewSummaryDisclosure: textOf(disclosureRaw) || null,
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
