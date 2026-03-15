/**
 * Helpers for trip itinerary day locations. Use getEffectiveDayLocations() everywhere
 * we need "locations for this day" so that location + locations + deprecated dayLocations
 * are handled in one place.
 */

import type { ItineraryDay, Trip } from './types';

/**
 * Returns the list of location strings for a day (cities). Prefers itinerary.locations,
 * then itinerary.location, then deprecated dayLocations for that date.
 */
export function getEffectiveDayLocations(
  day: ItineraryDay | undefined,
  dayLocationsDate?: string
): string[] {
  if (day?.locations?.length) return day.locations;
  if (day?.location?.trim()) return [day.location.trim()];
  if (dayLocationsDate?.trim()) return [dayLocationsDate.trim()];
  return [];
}

/**
 * Returns trip date strings (YYYY-MM-DD) that have no location set.
 * Used for non-blocking hints (e.g. Weather page banner).
 */
export function getDatesMissingLocation(trip: Trip | null | undefined): string[] {
  if (!trip?.startDate || !trip?.endDate) return [];
  const out: string[] = [];
  try {
    const start = new Date(trip.startDate + 'T12:00:00Z');
    const end = new Date(trip.endDate + 'T12:00:00Z');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      const locs = getEffectiveDayLocations(
        trip.itinerary?.[dateStr],
        trip.dayLocations?.[dateStr]
      );
      if (locs.length === 0) out.push(dateStr);
    }
  } catch {
    // ignore
  }
  return out;
}
