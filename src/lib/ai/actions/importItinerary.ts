import { getCachedAiText } from '../cache';
import { generateWithGemini } from '../../gemini';

export interface ParsedActivity {
  date: string;
  title: string;
  details?: string;
  time?: string | null;
  location?: string;
  category?: 'sightseeing' | 'food' | 'accommodation' | 'transport' | 'shopping' | 'other';
  notes?: string;
  cost?: number;
  currency?: string;
}

export type ParsedTransportType = 'flight' | 'train' | 'bus' | 'car' | 'ferry' | 'taxi' | 'walk' | 'other';

export interface ParsedTransportRoute {
  date: string;
  type: ParsedTransportType;
  from: string;
  to: string;
  departureTime?: string;
  arrivalTime?: string;
  bookingRef?: string;
  notes?: string;
  cost?: number;
  currency?: string;
}

export interface ParsedItinerary {
  tripName: string;
  startDate: string;
  endDate: string;
  activities: ParsedActivity[];
  transportRoutes?: ParsedTransportRoute[];
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
          notes: { type: 'string', description: 'Reservation info, ticket instructions, cancel policy, etc.' },
          cost: { type: 'number' },
          currency: { type: 'string' },
        },
        required: ['date', 'title', 'category'],
      },
    },
    transportRoutes: {
      type: 'array',
      description: 'Flights, trains, buses, ferries, etc. with from/to and times. Do not put these in activities.',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD' },
          type: { type: 'string', enum: ['flight', 'train', 'bus', 'car', 'ferry', 'taxi', 'walk', 'other'] },
          from: { type: 'string' },
          to: { type: 'string' },
          departureTime: { type: 'string', description: 'HH:mm' },
          arrivalTime: { type: 'string', description: 'HH:mm' },
          bookingRef: { type: 'string', description: 'e.g. booking confirmation, "Cyn booked"' },
          notes: { type: 'string' },
          cost: { type: 'number' },
          currency: { type: 'string' },
        },
        required: ['date', 'type', 'from', 'to'],
      },
    },
  },
  required: ['tripName', 'startDate', 'endDate', 'activities'],
};

/** If input looks like tab-separated columns (consistent tab count), return a hint for the model. */
export function detectFormatHint(text: string): string | undefined {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) return undefined;
  const tabCounts = lines.map((l) => (l.match(/\t/g) ?? []).length);
  const mode = tabCounts.sort((a, b) => a - b)[Math.floor(tabCounts.length / 2)];
  if (mode < 1) return undefined;
  const withSameTabs = tabCounts.filter((c) => c === mode).length;
  if (withSameTabs < lines.length * 0.6) return undefined;
  return 'The following is tab-separated: column 1 = date (or empty for same day), column 2 = time of day or day name, column 3 = activity/location, column 4 = type/category, column 5 = notes.';
}

export interface ParseItineraryOptions {
  formatHint?: string;
  /** When set, ask the model to limit output to avoid truncation (e.g. when parsing a chunk). */
  maxActivitiesPerChunk?: number;
  maxTransportPerChunk?: number;
}

export function buildItineraryPrompt(raw: string, formatHint?: string, limits?: { maxActivities?: number; maxTransport?: number }): string {
  const year = new Date().getFullYear();
  const hintBlock = formatHint ? `\n${formatHint}\n\n` : '';
  const limitLine =
    limits?.maxActivities ?? limits?.maxTransport
      ? `\n- Output at most ${limits.maxActivities ?? 30} activities and ${limits.maxTransport ?? 15} transport routes to avoid truncation.`
      : '';
  return `Parse this travel itinerary into structured activities.
${hintBlock}Rules:
- The input may be tab- or comma-separated with columns like: date, time-of-day, activity/location, type/category, notes. If the first line looks like a header (e.g. "Activity:" or "Notes"), treat it as a header and do not create an activity from it; use the following rows as data.
- Split each distinct activity or place into its own entry. For rows that list multiple places (e.g. "Place A Place B Place C"), create one entry per place or one entry with a clear combined title and details.
- When the user provides an explicit time (e.g. 17:35, 21:00, 09:30), put it in the time field as HH:mm. Use 09:00 for morning, 13:00 for afternoon, 18:00 for evening only when no exact time is given.
- Infer category from context (sightseeing, food, accommodation, transport, shopping, other).
- If year is not specified, assume ${year}. Output all dates as YYYY-MM-DD.
- Order activities chronologically within each day.
- For continuation rows (empty date column), use the same date as the previous row. Keep details and notes as provided; do not truncate reservation info, ticket instructions, or similar.
- Extract transport (flights, trains, buses, ferries, etc.) into the transportRoutes array: use from/to, departureTime, arrivalTime, and bookingRef (e.g. "Cyn booked") when mentioned. Do not put transport legs in activities; only put them in transportRoutes.${limitLine}

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
      const activities = parsed.activities;
      const transportRoutes = Array.isArray(parsed.transportRoutes) ? parsed.transportRoutes : [];
      const data: ParsedItinerary = {
        tripName: parsed.tripName || 'Imported Trip',
        startDate: parsed.startDate || activities[0]?.date || new Date().toISOString().split('T')[0],
        endDate: parsed.endDate || activities[activities.length - 1]?.date || new Date().toISOString().split('T')[0],
        activities,
        transportRoutes,
      };
      return { data, cleanText };
    }
  } catch {
    // Let callers inspect cleanText for truncation/error handling.
  }

  return { data: null, cleanText };
}

export async function parseItineraryChunk(text: string, options?: ParseItineraryOptions): Promise<ParsedItinerary> {
  const normalizedText = text.trim();
  const hint = options?.formatHint ?? detectFormatHint(normalizedText);
  const limits =
    options?.maxActivitiesPerChunk ?? options?.maxTransportPerChunk
      ? { maxActivities: options.maxActivitiesPerChunk ?? 30, maxTransport: options.maxTransportPerChunk ?? 15 }
      : undefined;
  const response = await getCachedAiText({
    namespace: 'import-itinerary',
    cacheKey: normalizedText,
    producer: () =>
      generateWithGemini(buildItineraryPrompt(normalizedText, hint, limits), {
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
