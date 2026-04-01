import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';

/** Whether `dateStr` (yyyy-MM-dd) falls within the trip's start/end (inclusive, local day bounds). */
export function isDateInTripRange(dateStr: string, trip: { startDate: string; endDate: string }): boolean {
    try {
        const d = parseISO(dateStr);
        const start = startOfDay(parseISO(trip.startDate));
        const end = endOfDay(parseISO(trip.endDate));
        if (Number.isNaN(d.getTime()) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
        return d >= start && d <= end;
    } catch {
        return false;
    }
}

/** If today falls within the trip (local calendar days), return today as yyyy-MM-dd; otherwise trip.startDate. */
export function getDefaultDayDateStr(trip: { startDate: string; endDate: string }): string {
    const start = startOfDay(parseISO(trip.startDate));
    const end = endOfDay(parseISO(trip.endDate));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return trip.startDate;
    }
    const today = new Date();
    if (isWithinInterval(today, { start, end })) {
        return format(today, 'yyyy-MM-dd');
    }
    return trip.startDate;
}
