// Purpose: Shared calendar-selected trip → Day view href and active state for Sidebar and BottomTabBar.
import { useLocation, matchPath } from 'react-router-dom';
import { useTrips } from './store';
import { getDefaultDayDateStr } from './tripDefaultDay';

export const CALENDAR_VIEW_KEY = 'travelplanner_calendar_view';

export function getCalendarSelectedTripId(): string | null {
    try {
        const raw = localStorage.getItem(CALENDAR_VIEW_KEY);
        if (!raw) return null;
        const p = JSON.parse(raw) as { selectedTripId?: string | null };
        return p.selectedTripId ?? null;
    } catch {
        return null;
    }
}

export function useDayNavHref(): {
    dayHref: string;
    isDayActive: boolean;
    selectedTripId: string | null;
} {
    const location = useLocation();
    const { trips } = useTrips();
    const selectedTripId = getCalendarSelectedTripId();
    const trip = selectedTripId ? trips.find((t) => t.id === selectedTripId) : undefined;

    const dayHref =
        !selectedTripId
            ? '/spreadsheet'
            : trip
              ? `/trip/${selectedTripId}/day/${getDefaultDayDateStr(trip)}`
              : `/trip/${selectedTripId}`;

    const isDayActive =
        matchPath({ path: '/trip/:tripId/day/:date', end: false }, location.pathname) != null;

    return { dayHref, isDayActive, selectedTripId };
}
