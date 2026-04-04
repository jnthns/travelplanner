// Purpose: Builds a ready-to-paste prompt for local LLMs (e.g. Gemma 4).
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import type { Activity, AiPreferences, Trip } from './types';

function getSeason(dateStr: string): string {
    const month = parseISO(dateStr).getMonth() + 1; // 1-12
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'autumn';
    return 'winter';
}

function formatDate(dateStr: string): string {
    try {
        return format(parseISO(dateStr), 'MMM d');
    } catch {
        return dateStr;
    }
}

/**
 * Builds a complete, ready-to-paste LLM prompt with:
 *  1. System role framing (no web search, knowledge cutoff caveat)
 *  2. Trip context block: dates, season, destinations, preferences, activity list
 *  3. Three labeled starter questions the user deletes down to one before sending
 */
export function buildLlmCopyText(trip: Trip, activities: Activity[]): string {
    const tripName = trip.name?.trim() || 'Untitled Trip';
    const season = getSeason(trip.startDate);
    const dayCount = differenceInCalendarDays(parseISO(trip.endDate), parseISO(trip.startDate)) + 1;

    // Unique city-level destinations from itinerary days only.
    // Activity locations are too granular ("Restaurant near hotel") and are already
    // represented in the activity list — exclude them from the Destinations line.
    const locationSet = new Set<string>();
    for (const day of Object.values(trip.itinerary ?? {})) {
        if (day.locations && day.locations.length > 0) {
            day.locations.forEach(l => { if (l.trim()) locationSet.add(l.trim()); });
        } else if (day.location?.trim()) {
            locationSet.add(day.location.trim());
        }
    }

    // Activity list sorted by date then time — title + date + location only
    const sortedActivities = [...activities].sort((a, b) => {
        const dateCmp = a.date.localeCompare(b.date);
        if (dateCmp !== 0) return dateCmp;
        return (a.time ?? '').localeCompare(b.time ?? '');
    });

    const prefs: AiPreferences = trip.aiPreferences ?? {};
    const prefLines: string[] = [];
    if (prefs.pace) prefLines.push(`Pace: ${prefs.pace}`);
    if (prefs.budget) prefLines.push(`Budget: ${prefs.budget}`);
    if (prefs.groupType) prefLines.push(`Traveling as: ${prefs.groupType}`);
    if (prefs.interests && prefs.interests.length > 0) prefLines.push(`Interests: ${prefs.interests.join(', ')}`);
    if (prefs.dietaryNeeds) prefLines.push(`Dietary needs: ${prefs.dietaryNeeds}`);
    if (prefs.accessibilityNeeds) prefLines.push(`Accessibility: ${prefs.accessibilityNeeds}`);
    if (prefs.transportPreference) prefLines.push(`Transport: ${prefs.transportPreference}`);
    if (prefs.mustHave) prefLines.push(`Must-haves: ${prefs.mustHave}`);
    if (prefs.avoid) prefLines.push(`Avoid: ${prefs.avoid}`);
    if (prefs.notes) prefLines.push(`Notes: ${prefs.notes}`);

    const lines: string[] = [];

    // 1. System role
    lines.push('You are a travel planning assistant. Use your training knowledge to help with the trip below.');
    lines.push('Do not guess at current prices, real-time schedules, or events — your knowledge cuts off around early 2025.');
    lines.push('');

    // 2. Trip context
    lines.push('== TRIP CONTEXT ==');
    lines.push('');
    lines.push(`Trip: ${tripName}`);
    lines.push(`Dates: ${trip.startDate} to ${trip.endDate} (${dayCount} day${dayCount !== 1 ? 's' : ''}, ${season})`);

    if (locationSet.size > 0) {
        lines.push(`Destinations: ${[...locationSet].join(', ')}`);
    }

    if (prefLines.length > 0) {
        lines.push('');
        lines.push('My preferences:');
        prefLines.forEach(l => lines.push(`- ${l}`));
    }

    if (sortedActivities.length > 0) {
        lines.push('');
        lines.push('Planned activities:');
        for (const act of sortedActivities) {
            const time = act.time ? ` at ${act.time}` : '';
            const loc = act.location ? ` (${act.location})` : '';
            lines.push(`- ${formatDate(act.date)}${time}: ${act.title}${loc}`);
        }
    }

    // 3. Starter questions
    lines.push('');
    lines.push('== STARTER QUESTIONS — delete all but one before sending ==');
    lines.push('');
    lines.push('Q1 — Cultural tips: For each destination above, share one local custom or etiquette tip I should know, and one must-try local dish or drink.');
    lines.push('');
    lines.push('Q2 — Schedule review: Look at my planned activities and flag any days that seem too packed or too light. Suggest what I could add or cut.');
    lines.push('');
    lines.push('Q3 — Packing list: Based on the destinations, travel dates, season, and my preferences, suggest items I might not think to pack.');

    return lines.join('\n');
}
