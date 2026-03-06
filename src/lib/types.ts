export const TRIP_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16',
];

export interface Trip {
    id: string;
    userId: string;
    name: string;
    startDate: string; // ISO date
    endDate: string;   // ISO date
    description?: string;
    defaultCurrency?: string;
    color?: string; // hex for calendar overlay and UI
    dayLocations?: Record<string, string>; // "YYYY-MM-DD" -> location name
    budgetTarget?: number;
    budgetCurrency?: string;
}

export const ACTIVITY_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#64748b',
];

export interface Activity {
    id: string;
    userId: string;
    tripId: string;
    date: string; // ISO date YYYY-MM-DD
    title: string;
    details?: string;
    time?: string;     // HH:mm
    location?: string;
    category?: 'sightseeing' | 'food' | 'accommodation' | 'transport' | 'shopping' | 'other';
    cost?: number;
    currency?: string;
    notes?: string;
    order: number; // for sorting within a day
    color?: string; // optional override for prioritization/organization
    tags?: string[];
}

export interface TransportRoute {
    id: string;
    userId: string;
    tripId: string;
    date: string;
    type: 'flight' | 'train' | 'bus' | 'car' | 'ferry' | 'taxi' | 'walk' | 'other';
    from: string;
    to: string;
    departureTime?: string;
    arrivalTime?: string;
    cost?: number;
    currency?: string;
    bookingRef?: string;
    notes?: string;
}

export interface Note {
    id: string;
    userId: string;
    tripId: string;
    title: string;
    content: string;
    format: 'freeform' | 'bullet' | 'numbered';
    order: number;
    color?: string;
    images?: string[]; // Firebase Storage download URLs
    createdAt: string; // ISO datetime
    updatedAt: string; // ISO datetime
}

export const NOTE_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#64748b',
];

export const CATEGORY_COLORS: Record<string, string> = {
    sightseeing: '#3b82f6',
    food: '#f59e0b',
    accommodation: '#8b5cf6',
    transport: '#10b981',
    shopping: '#ec4899',
    other: '#64748b',
};

export const CATEGORY_EMOJIS: Record<string, string> = {
    sightseeing: '🏛️',
    food: '🍽️',
    accommodation: '🏨',
    transport: '🚌',
    shopping: '🛍️',
    other: '📌',
};

export const TRANSPORT_EMOJIS: Record<string, string> = {
    flight: '✈️',
    train: '🚂',
    bus: '🚌',
    car: '🚗',
    ferry: '⛴️',
    taxi: '🚕',
    walk: '🚶',
    other: '🔄',
};
