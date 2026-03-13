import { format } from 'date-fns';
import { getCachedAiText } from '../cache';
import { generateWithGemini } from '../../gemini';
import type { Activity, Trip } from '../../types';

export interface DaySummaryResponse {
  summary: string;
  highlights: string[];
}

export interface RouteOptimizationResponse {
  recommendation: string;
  optimizedOrder: string[];
}

export interface ActivityDescriptionSuggestion {
  activityId: string;
  summary: string;
  tips: string[];
}

export interface NearbyRecommendation {
  name: string;
  type: 'unesco' | 'craft_workshop' | 'shopping_street' | 'major_attraction' | 'other';
  location: string;
  weight: number;
  reason: string;
  crowded?: boolean;
}

export interface NearbyRecommendationsResponse {
  recommendations: NearbyRecommendation[];
}

const ACTIVITY_DESCRIPTION_CACHE_VERSION = 'v3';

function normalizeActivityDescriptionSuggestion(
  value: unknown,
): ActivityDescriptionSuggestion | null {
  if (!value || typeof value !== 'object') return null;

  const item = value as {
    activityId?: unknown;
    summary?: unknown;
    tips?: unknown;
    description?: unknown;
  };

  if (typeof item.activityId !== 'string' || !item.activityId.trim()) {
    return null;
  }

  if (typeof item.summary === 'string' && Array.isArray(item.tips)) {
    const tips = item.tips
      .filter((tip): tip is string => typeof tip === 'string')
      .map((tip) => tip.trim())
      .filter(Boolean);

    if (!item.summary.trim() || tips.length < 3) return null;

    return {
      activityId: item.activityId,
      summary: item.summary.trim(),
      tips,
    };
  }

  // Backward compatibility for older cached responses using a single markdown string.
  if (typeof item.description === 'string' && item.description.trim()) {
    const lines = item.description
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const tips = lines
      .filter((line) => /^[-*]\s+/.test(line))
      .map((line) => line.replace(/^[-*]\s+/, '').trim())
      .filter(Boolean);

    const summaryParts = lines.filter((line) => !/^[-*]\s+/.test(line));
    const summary = summaryParts.slice(0, 2).join(' ').trim();

    if (!summary || tips.length < 3) return null;

    return {
      activityId: item.activityId,
      summary,
      tips,
    };
  }

  return null;
}

export async function generateDaySummary(args: {
  trip: Trip;
  currentDate: Date;
  currentDateStr: string;
  activities: Activity[];
}): Promise<DaySummaryResponse> {
  const { trip, currentDate, currentDateStr, activities } = args;
  const dayData = trip.itinerary?.[currentDateStr];
  const dayLocation = dayData?.location || trip.dayLocations?.[currentDateStr];
  const dayAccommodation = dayData?.accommodation?.name;
  const dayItinerary = activities
    .map((activity) => `${activity.time || 'TBD'} - ${activity.title}${activity.location ? ` (${activity.location})` : ''}`)
    .join('; ');

  const prompt = `Here is the itinerary for ${format(currentDate, 'EEEE, MMM d, yyyy')} on a trip to "${trip.name}":

Location: ${dayLocation || 'Not specified'}
Accommodation: ${dayAccommodation || 'Not specified'}
Activities: ${dayItinerary}

Respond with a JSON object matching this exact schema:
{
  "summary": "A 2-3 sentence overview covering route optimization, expected travel/wait times between activities, and suggested improvements to the day's plan. 80 words max.",
  "highlights": [
    "First highlight: an attraction, culinary, cultural, or historical point along the route",
    "Second highlight: a seasonal or current event for the given day, or a hidden gem near the itinerary",
    "Third highlight: a practical tip about timing, crowds, or money-saving for this route"
  ]
}

Be specific to the actual destinations and activities. Each highlight should be one concise sentence. Do not include activities already in the itinerary in the highlights.`;

  const raw = await getCachedAiText({
    namespace: 'calendar-day-summary',
    cacheKey: JSON.stringify({
      tripId: trip.id,
      currentDateStr,
      activities: activities.map((activity) => ({
        id: activity.id,
        title: activity.title,
        time: activity.time,
        location: activity.location,
        details: activity.details,
      })),
      itineraryDay: dayData,
    }),
    producer: () =>
      generateWithGemini(prompt, {
        systemInstruction: 'You are a day-itinerary travel assistant. Summarize only the provided day context and activities.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            highlights: {
              type: 'array',
              items: { type: 'string' },
              minItems: 0,
              maxItems: 3,
            },
          },
          required: ['summary', 'highlights'],
          additionalProperties: false,
        },
      }),
    ttlMs: 24 * 60 * 60 * 1000,
  });

  return JSON.parse(raw) as DaySummaryResponse;
}

export async function generateNearbyRecommendations(args: {
  trip: Trip;
  currentDateStr: string;
  activities: Activity[];
}): Promise<NearbyRecommendationsResponse> {
  const { trip, currentDateStr, activities } = args;
  const dayData = trip.itinerary?.[currentDateStr];
  const dayLocation = dayData?.location || trip.dayLocations?.[currentDateStr];
  const dayAccommodation = dayData?.accommodation?.name;
  const currentDayActs = activities
    .map((a) => `${a.title}${a.location ? ` (${a.location})` : ''}${a.time ? ` @ ${a.time}` : ''}`)
    .join('; ');
  const itineraryLocations = [...new Set(activities.map((a) => a.location).filter(Boolean))].join(', ') || dayLocation || 'Not specified';

  const prompt = `You are a travel recommendation engine for a user traveling through Japan (Kobe, Osaka, Kyoto, Nara) and Taiwan.

Current day context for ${currentDateStr} on trip "${trip.name}":
- Day location: ${dayLocation || 'Not specified'}
- Accommodation: ${dayAccommodation || 'Not specified'}
- Activities today: ${currentDayActs}
- Nearby areas: ${itineraryLocations}

Generate 4-6 nearby location recommendations for the current day's itinerary using a WEIGHTED system.

User preferences (prioritize in this order):
1. UNESCO World Heritage sites (weight 0.9-1.0)
2. Craft workshops and craftsmanship-focused experiences (weight 0.85-0.95)
3. Shopping streets and major tourist attractions (weight 0.8-0.9)
4. Heavily crowded areas: apply LOWER weight (deprioritize, weight 0.3-0.5)

Respond with a JSON object matching this exact schema:
{
  "recommendations": [
    {
      "name": "Place or experience name",
      "type": "unesco" | "craft_workshop" | "shopping_street" | "major_attraction" | "other",
      "location": "City or district (e.g. Kyoto, Kobe, Osaka, Nara, Taipei)",
      "weight": 0.0 to 1.0,
      "reason": "One sentence why it fits the user's preferences",
      "crowded": true | false
    }
  ]
}

Rules:
- Only recommend places in Japan (Kobe, Osaka, Kyoto, Nara) or Taiwan relevant to the day's location.
- If crowded is true, the weight must be 0.5 or lower.
- Sort by weight descending (highest first).
- Do not duplicate activities already in the itinerary.`;

  const raw = await getCachedAiText({
    namespace: 'calendar-nearby-recommendations',
    cacheKey: JSON.stringify({
      tripId: trip.id,
      currentDateStr,
      activities: activities.map((a) => ({ id: a.id, title: a.title, location: a.location })),
      itineraryDay: dayData,
    }),
    producer: () =>
      generateWithGemini(prompt, {
        systemInstruction: 'You are a weighted recommendation engine for travelers in Japan and Taiwan. Prioritize UNESCO sites, craft workshops, shopping streets; deprioritize crowded areas.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string', enum: ['unesco', 'craft_workshop', 'shopping_street', 'major_attraction', 'other'] },
                  location: { type: 'string' },
                  weight: { type: 'number' },
                  reason: { type: 'string' },
                  crowded: { type: 'boolean' },
                },
                required: ['name', 'type', 'location', 'weight', 'reason'],
                additionalProperties: true,
              },
              minItems: 1,
              maxItems: 8,
            },
          },
          required: ['recommendations'],
          additionalProperties: false,
        },
      }),
    ttlMs: 24 * 60 * 60 * 1000,
  });

  const parsed = JSON.parse(raw) as NearbyRecommendationsResponse;
  if (!parsed?.recommendations || !Array.isArray(parsed.recommendations)) {
    throw new Error('Invalid nearby recommendations response format');
  }
  return parsed;
}

export async function generateOptimizedRoute(args: {
  trip: Trip;
  currentDateStr: string;
  activities: Activity[];
}): Promise<RouteOptimizationResponse> {
  const { trip, currentDateStr, activities } = args;

  const currentDayActs = activities
    .map((activity) => `ID: ${activity.id} | Title: ${activity.title} | Time: ${activity.time || 'flexible'} | Location: ${activity.location || 'none'} | Details: ${activity.details || 'none'}`)
    .join('\n');

  const prompt = `Here are the activities planned for ${currentDateStr} on a trip to "${trip.name}":

${currentDayActs}

Respond with a JSON object matching this exact schema:
{
  "recommendation": "A 2-3 sentence explanation of why this new order is better (e.g. groups nearby locations, fixes awkward timing).",
  "optimizedOrder": ["ID_1", "ID_2", "..."] // An array containing the exact IDs of all provided activities, but reordered for the most optimal route.
}

Ensure all provided activity IDs are included in the optimizedOrder array.`;

  const raw = await getCachedAiText({
    namespace: 'calendar-route-optimization',
    cacheKey: JSON.stringify({
      tripId: trip.id,
      currentDateStr,
      activities: activities.map((activity) => ({
        id: activity.id,
        title: activity.title,
        time: activity.time,
        location: activity.location,
        details: activity.details,
      })),
    }),
    producer: () =>
      generateWithGemini(prompt, {
        responseMimeType: 'application/json',
        systemInstruction: 'You are an expert travel logistician. Your goal is to minimize transit time and provide smooth chronological schedules.',
      }),
    ttlMs: 24 * 60 * 60 * 1000,
  });

  return JSON.parse(raw) as RouteOptimizationResponse;
}

export async function generateDayActivityDescriptions(args: {
  trip: Trip;
  currentDateStr: string;
  activities: Activity[];
}): Promise<ActivityDescriptionSuggestion[]> {
  const { trip, currentDateStr, activities } = args;
  const dayData = trip.itinerary?.[currentDateStr];
  const dayLocation = dayData?.location || trip.dayLocations?.[currentDateStr];
  const dayAccommodation = dayData?.accommodation?.name;
  const currentDayActs = activities
    .map((activity) =>
      `ID: ${activity.id} | Title: ${activity.title} | Time: ${activity.time || 'flexible'} | Location: ${activity.location || 'none'} | Category: ${activity.category || 'other'} | Existing details: ${activity.details || 'none'}`,
    )
    .join('\n');

  const prompt = `Create concise travel activity descriptions for every activity on ${currentDateStr} for the trip "${trip.name}".

Day context:
- Day location: ${dayLocation || 'Not specified'}
- Accommodation: ${dayAccommodation || 'Not specified'}

Activities:
${currentDayActs}

Respond with a JSON array matching this exact schema:
[
  {
    "activityId": "exact activity id from the list above",
    "summary": "Exactly two short sentences. Maximum 45 words total.",
    "tips": [
      "One concise local recommendation or practical tip",
      "One concise local recommendation or practical tip",
      "One concise local recommendation or practical tip"
    ]
  }
]

Rules:
- Include every provided activity exactly once.
- Keep each summary and tip specific to the activity title, timing, location, and category.
- The summary should be only two short sentences.
- Do not mention that this was AI-generated.
- Return at least 3 useful tips per activity.
- The tips should prioritize practical local advice, nearby food or cultural context, crowd/timing advice, or smart combinations nearby.
- If an activity already has details, improve and rewrite them rather than repeating them.`;

  const raw = await getCachedAiText({
    namespace: 'calendar-day-activity-descriptions',
    cacheKey: JSON.stringify({
      version: ACTIVITY_DESCRIPTION_CACHE_VERSION,
      tripId: trip.id,
      currentDateStr,
      activities: activities.map((activity) => ({
        id: activity.id,
        title: activity.title,
        time: activity.time,
        location: activity.location,
        category: activity.category,
        details: activity.details,
      })),
      itineraryDay: dayData,
    }),
    producer: () =>
      generateWithGemini(prompt, {
        systemInstruction: 'You are an expert travel writer creating helpful activity descriptions for a day itinerary.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              activityId: { type: 'string' },
              summary: { type: 'string' },
              tips: {
                type: 'array',
                items: { type: 'string' },
                minItems: 3,
                maxItems: 5,
              },
            },
            required: ['activityId', 'summary', 'tips'],
            additionalProperties: false,
          },
        },
      }),
    ttlMs: 24 * 60 * 60 * 1000,
  });

  const parsedRaw = JSON.parse(raw) as unknown;
  const parsed = Array.isArray(parsedRaw)
    ? parsedRaw.map(normalizeActivityDescriptionSuggestion).filter((item): item is ActivityDescriptionSuggestion => Boolean(item))
    : [];
  const activityIds = new Set(activities.map((activity) => activity.id));
  if (
    parsed.length !== activities.length ||
    parsed.some(
      (item) =>
        !activityIds.has(item.activityId) ||
        !item.summary?.trim() ||
        !Array.isArray(item.tips) ||
        item.tips.length < 3 ||
        item.tips.some((tip) => !tip?.trim()),
    )
  ) {
    throw new Error('Invalid activity descriptions response format');
  }

  return parsed;
}
