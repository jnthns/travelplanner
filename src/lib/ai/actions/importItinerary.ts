import { getCachedAiText } from '../cache';
import { generateWithGemini } from '../../gemini';

export interface ParsedActivity {
  date: string;
  title: string;
  details?: string;
  time?: string | null;
  location?: string;
  category?: 'sightseeing' | 'food' | 'accommodation' | 'transport' | 'shopping' | 'other';
}

export interface ParsedItinerary {
  tripName: string;
  startDate: string;
  endDate: string;
  activities: ParsedActivity[];
}

export const ITINERARY_SCHEMA = {
  type: 'object',
  properties: {
    tripName: { type: 'string' },
    startDate: { type: 'string', description: 'YYYY-MM-DD' },
    endDate: { type: 'string', description: 'YYYY-MM-DD' },
    activities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD' },
          title: { type: 'string' },
          details: { type: 'string' },
          time: { type: 'string', description: 'HH:mm or null' },
          location: { type: 'string' },
          category: { type: 'string', enum: ['sightseeing', 'food', 'accommodation', 'transport', 'shopping', 'other'] },
        },
        required: ['date', 'title', 'category'],
      },
    },
  },
  required: ['tripName', 'startDate', 'endDate', 'activities'],
};

export function buildItineraryPrompt(raw: string): string {
  const year = new Date().getFullYear();
  return `Parse this travel itinerary. Be concise: keep details under 80 chars.

Rules:
- Split each distinct activity/place into its own entry.
- Infer category from context.
- If year is not specified, assume ${year}.
- Use 09:00 for morning, 13:00 for afternoon, 18:00 for evening if exact time unknown.
- Order activities chronologically within each day.

Itinerary:
${raw}`;
}

export function tryParseItineraryJson(text: string): { data: ParsedItinerary | null; cleanText: string } {
  let cleanText = text.trim();
  cleanText = cleanText.replace(/^```(?:json)?\s*/i, '');
  cleanText = cleanText.replace(/\s*```$/, '');

  try {
    const parsed = JSON.parse(cleanText) as Partial<ParsedItinerary>;
    if (Array.isArray(parsed.activities) && parsed.activities.length > 0) {
      const data: ParsedItinerary = {
        tripName: parsed.tripName || 'Imported Trip',
        startDate: parsed.startDate || parsed.activities[0]?.date || new Date().toISOString().split('T')[0],
        endDate: parsed.endDate || parsed.activities[parsed.activities.length - 1]?.date || new Date().toISOString().split('T')[0],
        activities: parsed.activities,
      };
      return { data, cleanText };
    }
  } catch {
    // Let callers inspect cleanText for truncation/error handling.
  }

  return { data: null, cleanText };
}

export async function parseItineraryChunk(text: string): Promise<ParsedItinerary> {
  const normalizedText = text.trim();
  const response = await getCachedAiText({
    namespace: 'import-itinerary',
    cacheKey: normalizedText,
    producer: () =>
      generateWithGemini(buildItineraryPrompt(normalizedText), {
        responseMimeType: 'application/json',
        responseSchema: ITINERARY_SCHEMA,
      }),
    ttlMs: 7 * 24 * 60 * 60 * 1000,
  });

  const { data: result, cleanText } = tryParseItineraryJson(response);
  if (!result) {
    const isTruncated = !/}\s*$/.test(cleanText);
    throw new Error(
      isTruncated
        ? 'TRUNCATED'
        : 'Failed to parse AI response as JSON. Try again or simplify your input.',
    );
  }

  return result;
}
