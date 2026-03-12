import { eachDayOfInterval, format, parseISO } from 'date-fns';
import type { Activity, Note, TransportRoute, Trip } from './types';

export interface TripExportPayload {
    version: '1.0.0';
    exportedAt: string;
    app: 'travelplanner';
    trip: Omit<Trip, '_pendingWrite'>;
    activities: Array<Omit<Activity, '_pendingWrite'>>;
    transportRoutes: Array<Omit<TransportRoute, '_pendingWrite'>>;
    notes: Array<Omit<Note, '_pendingWrite'>>;
}

export function buildTripExportPayload(data: {
    trip: Trip;
    activities: Activity[];
    transportRoutes: TransportRoute[];
    notes: Note[];
}): TripExportPayload {
    const { trip, activities, transportRoutes, notes } = data;
    return {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        app: 'travelplanner',
        trip: stripPending(trip),
        activities: activities.map(stripPending),
        transportRoutes: transportRoutes.map(stripPending),
        notes: notes.map(stripPending),
    };
}

function stripPending<T extends { _pendingWrite?: boolean }>(obj: T): Omit<T, '_pendingWrite'> {
    const { _pendingWrite: _unused, ...rest } = obj;
    return rest;
}

const CSV_COLUMNS = [
    'tripId',
    'tripName',
    'startDate',
    'endDate',
    'defaultCurrency',
    'recordType',
    'date',
    'time',
    'title',
    'content',
    'location',
    'category',
    'cost',
    'currency',
    'notes',
    'routeType',
    'from',
    'to',
    'departureTime',
    'arrivalTime',
    'bookingRef',
    'noteFormat',
    'color',
    'images',
    'order',
] as const;

type CsvColumn = typeof CSV_COLUMNS[number];
type CsvRow = Partial<Record<CsvColumn, string | number>>;

function csvEscape(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (/[",\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function rowToCsv(row: CsvRow): string {
    return CSV_COLUMNS.map((k) => csvEscape(row[k])).join(',');
}

function getTripDays(trip: Trip): string[] {
    try {
        return eachDayOfInterval({
            start: parseISO(trip.startDate),
            end: parseISO(trip.endDate),
        }).map((d) => format(d, 'yyyy-MM-dd'));
    } catch {
        return [];
    }
}

export function toTripCsv(data: {
    trip: Trip;
    activities: Activity[];
    transportRoutes: TransportRoute[];
    notes: Note[];
}): string {
    const { trip, activities, transportRoutes, notes } = data;
    const rows: CsvRow[] = [];

    rows.push({
        tripId: trip.id,
        tripName: trip.name,
        startDate: trip.startDate,
        endDate: trip.endDate,
        defaultCurrency: trip.defaultCurrency || '',
        recordType: 'trip_meta',
        color: trip.color || '',
        notes: trip.description || '',
    });

    const tripDays = getTripDays(trip);
    for (const day of tripDays) {
        const dayData = trip.itinerary?.[day];
        const dayLocation = dayData?.location || trip.dayLocations?.[day] || '';
        rows.push({
            tripId: trip.id,
            tripName: trip.name,
            startDate: trip.startDate,
            endDate: trip.endDate,
            defaultCurrency: trip.defaultCurrency || '',
            recordType: 'itinerary_day',
            date: day,
            location: dayLocation,
            title: dayData?.accommodation?.name || '',
            time: dayData?.accommodation?.checkInTime || '',
            cost: dayData?.accommodation?.cost ?? '',
            currency: dayData?.accommodation?.currency || '',
        });
    }

    for (const a of activities) {
        rows.push({
            tripId: trip.id,
            tripName: trip.name,
            startDate: trip.startDate,
            endDate: trip.endDate,
            defaultCurrency: trip.defaultCurrency || '',
            recordType: 'activity',
            date: a.date,
            time: a.time || '',
            title: a.title,
            content: a.details || '',
            location: a.location || '',
            category: a.category || '',
            cost: a.cost ?? '',
            currency: a.currency || '',
            notes: a.notes || '',
            color: a.color || '',
            order: a.order,
        });
    }

    for (const r of transportRoutes) {
        rows.push({
            tripId: trip.id,
            tripName: trip.name,
            startDate: trip.startDate,
            endDate: trip.endDate,
            defaultCurrency: trip.defaultCurrency || '',
            recordType: 'transport_route',
            date: r.date,
            routeType: r.type,
            from: r.from,
            to: r.to,
            departureTime: r.departureTime || '',
            arrivalTime: r.arrivalTime || '',
            bookingRef: r.bookingRef || '',
            cost: r.cost ?? '',
            currency: r.currency || '',
            notes: r.notes || '',
        });
    }

    for (const n of notes) {
        rows.push({
            tripId: trip.id,
            tripName: trip.name,
            startDate: trip.startDate,
            endDate: trip.endDate,
            defaultCurrency: trip.defaultCurrency || '',
            recordType: 'note',
            date: n.date || '',
            content: n.content,
            noteFormat: n.format,
            color: n.color || '',
            images: n.images?.join('|') || '',
            order: n.order,
        });
    }

    return [CSV_COLUMNS.join(','), ...rows.map(rowToCsv)].join('\n');
}

export function downloadTextFile(filename: string, text: string, mimeType = 'text/plain;charset=utf-8'): void {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export function slugifyFilename(input: string): string {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64) || 'trip';
}

