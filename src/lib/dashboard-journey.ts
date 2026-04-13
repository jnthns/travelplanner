// Purpose: Build dashboard “Your Journey” stops from saved per-day cities (itinerary / dayLocations), with a non-accommodation activity fallback.

import { eachDayOfInterval, format, parseISO } from 'date-fns';
import type { Activity, Trip } from './types';

export interface DashboardJourneyStop {
  location: string;
  dateLabel: string;
  emoji: string;
}

export interface DashboardJourneyResult {
  stops: DashboardJourneyStop[];
  /** Distinct place names across the timeline (unique cities / segments). */
  cityCount: number;
}

interface CitySegment {
  city: string;
  start: Date;
  end: Date;
}

function getDayCityLabel(trip: Trip, dateStr: string): string | undefined {
  const day = trip.itinerary?.[dateStr];
  const fromLocation = day?.location?.trim();
  if (fromLocation) return fromLocation;
  const firstLoc = day?.locations?.find((l) => l?.trim());
  if (firstLoc) return firstLoc.trim();
  const legacy = trip.dayLocations?.[dateStr]?.trim();
  if (legacy) return legacy;
  return undefined;
}

function formatSegmentDateRange(start: Date, end: Date): string {
  if (start.getTime() === end.getTime()) {
    return format(start, 'MMM d');
  }
  if (format(start, 'yyyy') === format(end, 'yyyy')) {
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`;
  }
  return `${format(start, 'MMM d, y')} – ${format(end, 'MMM d, y')}`;
}

function buildStopsFromSavedCities(trip: Trip): DashboardJourneyStop[] {
  try {
    const start = parseISO(trip.startDate);
    const end = parseISO(trip.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

    const days = eachDayOfInterval({ start, end });
    const segments: CitySegment[] = [];

    for (const d of days) {
      const dateStr = format(d, 'yyyy-MM-dd');
      const city = getDayCityLabel(trip, dateStr);
      if (!city) continue;
      const last = segments[segments.length - 1];
      if (last && last.city === city) {
        last.end = d;
      } else {
        segments.push({ city, start: d, end: d });
      }
    }

    return segments.map((seg) => ({
      location: seg.city,
      dateLabel: formatSegmentDateRange(seg.start, seg.end),
      emoji: '🏙️',
    }));
  } catch {
    return [];
  }
}

const CATEGORY_EMOJI: Record<string, string> = {
  sightseeing: '🏛️',
  food: '🍜',
  accommodation: '🏨',
  transport: '🚆',
  shopping: '🛍️',
  other: '📍',
};

function getCategoryEmoji(category?: string): string {
  return CATEGORY_EMOJI[category ?? 'other'] ?? '📍';
}

// ASSUMPTION: When itinerary/dayLocations are empty, exclude only accommodation activities; other POIs may still appear until the user sets day cities.
function buildStopsFromActivities(tripId: string, activities: Activity[]): DashboardJourneyStop[] {
  const tripActivities = activities
    .filter((a) => a.tripId === tripId && a.location && a.category !== 'accommodation')
    .sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);

  const stops: DashboardJourneyStop[] = [];
  let lastLocation = '';

  for (const act of tripActivities) {
    if (act.location && act.location !== lastLocation) {
      const dateStr = format(parseISO(act.date), 'MMM d');
      stops.push({
        location: act.location,
        dateLabel: dateStr,
        emoji: getCategoryEmoji(act.category),
      });
      lastLocation = act.location;
    }
  }

  return stops;
}

export function deriveDashboardJourney(trip: Trip, activities: Activity[]): DashboardJourneyResult {
  const fromSaved = buildStopsFromSavedCities(trip);
  if (fromSaved.length > 0) {
    return {
      stops: fromSaved,
      cityCount: new Set(fromSaved.map((s) => s.location)).size,
    };
  }

  const fromActs = buildStopsFromActivities(trip.id, activities);
  return {
    stops: fromActs,
    cityCount: new Set(fromActs.map((s) => s.location)).size,
  };
}
