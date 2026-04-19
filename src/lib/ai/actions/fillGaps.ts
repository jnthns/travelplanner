// Purpose: Gemini JSON suggestions for activities that fit free time windows (≥60 min) on a day.
import { formatAiPreferenceContext } from './calendar';
import { generateWithGemini } from '../../gemini';
import type { Activity, Trip } from '../../types';

export interface FillGapSuggestionRow {
    windowStart: string;
    windowEnd: string;
    suggestion: {
        title: string;
        category: string;
        time: string;
        details: string;
        location: string;
    };
}

const gapItemSchema = {
    type: 'object',
    properties: {
        windowStart: { type: 'string', description: 'Start of free window HH:MM' },
        windowEnd: { type: 'string', description: 'End of free window HH:MM' },
        suggestion: {
            type: 'object',
            properties: {
                title: { type: 'string' },
                category: { type: 'string' },
                time: { type: 'string', description: 'Suggested start time HH:MM within the window' },
                details: { type: 'string' },
                location: { type: 'string' },
            },
            required: ['title', 'category', 'time', 'details', 'location'],
            additionalProperties: false,
        },
    },
    required: ['windowStart', 'windowEnd', 'suggestion'],
    additionalProperties: false,
} as const;

/**
 * Returns 0–3 gap windows with one activity suggestion each (Gemini infers gaps ≥60 minutes).
 */
export async function generateFillGapsSuggestions(args: {
    trip: Trip;
    dateStr: string;
    location: string;
    activities: Pick<Activity, 'title' | 'time' | 'category'>[];
}): Promise<FillGapSuggestionRow[]> {
    const { trip, dateStr, location, activities } = args;

    const sorted = [...activities]
        .filter((a) => typeof a.time === 'string' && a.time.trim().length > 0)
        .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));

    const scheduleLines = sorted.map(
        (a) => `- ${a.time} | ${a.title} | category: ${a.category ?? 'other'}`,
    );

    const maxPerDay = trip.aiPreferences?.maxActivitiesPerDay;
    const remainingSlots = maxPerDay != null ? Math.max(0, maxPerDay - sorted.length) : null;

    const prompt = `You are planning a single calendar day for the trip "${trip.name}".

Date: ${dateStr}
Primary location context for the day: ${location}

Scheduled activities (sorted by time; only these have fixed times):
${scheduleLines.join('\n')}

${formatAiPreferenceContext(trip)}

Task:
1. Infer **free time windows** between the day boundaries (assume a typical day roughly 08:00–22:00 local unless activities imply otherwise) and between timed activities.
2. Only include windows that are **at least 60 minutes** long.
3. Return **at most ${remainingSlots !== null ? Math.min(3, remainingSlots) : 3}** windows total${remainingSlots !== null ? ` (the traveler's max-activities-per-day limit leaves only ${remainingSlots} slot(s) open)` : ''}, each with **exactly one** concrete activity suggestion that fits entirely inside that window.
4. Each suggestion must align with the AI preferences above — match the pace, reflect stated interests, respect dietary and accessibility needs, and avoid anything listed under "Avoid". Respect all travel guardrails as hard constraints.
5. Each suggestion must include a plausible **time** (HH:MM) within the window for starting the activity.
6. If there are no qualifying gaps${remainingSlots === 0 ? ' or no remaining slots allowed' : ''}, return an empty array.
7. windowStart and windowEnd must be HH:MM (24h) strings.

Respond with a JSON **array** only, matching the schema (no markdown).`;

    const raw = await generateWithGemini(prompt, {
        systemInstruction:
            'You are a concise travel planner. Output only valid JSON array matching the schema. Use realistic pacing and respect user AI preferences as hard constraints.',
        responseMimeType: 'application/json',
        responseSchema: {
            type: 'array',
            items: gapItemSchema as unknown as Record<string, unknown>,
            minItems: 0,
            maxItems: remainingSlots !== null ? Math.min(3, remainingSlots) : 3,
        },
    });

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
        throw new Error('Invalid fill-gaps response: expected array');
    }

    const out: FillGapSuggestionRow[] = [];
    for (const item of parsed) {
        if (!item || typeof item !== 'object') continue;
        const row = item as {
            windowStart?: unknown;
            windowEnd?: unknown;
            suggestion?: unknown;
        };
        if (typeof row.windowStart !== 'string' || typeof row.windowEnd !== 'string') continue;
        const sug = row.suggestion;
        if (!sug || typeof sug !== 'object') continue;
        const s = sug as Record<string, unknown>;
        if (
            typeof s.title !== 'string' ||
            typeof s.category !== 'string' ||
            typeof s.time !== 'string' ||
            typeof s.details !== 'string' ||
            typeof s.location !== 'string'
        ) {
            continue;
        }
        out.push({
            windowStart: row.windowStart.trim(),
            windowEnd: row.windowEnd.trim(),
            suggestion: {
                title: s.title.trim(),
                category: s.category.trim(),
                time: s.time.trim(),
                details: s.details.trim(),
                location: s.location.trim(),
            },
        });
    }

    return out;
}
