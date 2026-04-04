export const TRIP_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16',
];

export interface Accommodation {
    name: string;
    checkInTime?: string;
    cost?: number;
    currency?: string;
}

export interface ItineraryDay {
    location?: string;
    /** Optional array of city names for the day (e.g. transit). Use getEffectiveDayLocations() to read. */
    locations?: string[];
    accommodation?: Accommodation;
}

export interface AiPreferences {
    pace?: 'relaxed' | 'balanced' | 'fast';
    budget?: 'budget' | 'mid-range' | 'luxury';
    groupType?: 'solo' | 'couple' | 'family' | 'group';
    interests?: string[];
    dietaryNeeds?: string;
    accessibilityNeeds?: string;
    transportPreference?: string;
    mustHave?: string;
    avoid?: string;
    notes?: string;
}

export interface Trip {
    id: string;
    userId: string; // owner UID
    name: string;
    startDate: string; // ISO date
    endDate: string;   // ISO date
    description?: string;
    defaultCurrency?: string;
    color?: string; // hex for calendar overlay and UI
    dayLocations?: Record<string, string>; // DEPRECATED: "YYYY-MM-DD" -> location name (moving to itinerary)
    itinerary?: Record<string, ItineraryDay>; // "YYYY-MM-DD" -> day details
    budgetTarget?: number;
    budgetCurrency?: string;
    aiPreferences?: AiPreferences;
    members: string[];          // [ownerUid, ...collaboratorUids]
    sharedWithEmails: string[]; // display-only mirror of members
    _pendingWrite?: boolean;
}

export interface TripScenario {
    id: string;
    tripId: string;
    name: string;
    objective?: string;
    createdAt: string;
    updatedAt: string;
    tripSnapshot: Trip;
    activitiesSnapshot: Activity[];
    transportRoutesSnapshot: TransportRoute[];
}

export interface UserProfile {
    uid: string;
    email: string;
    displayName?: string | null;
}

export interface ChatMessage {
    id: string; // usually same as createdAt timestamp for ease
    userId: string;
    tripId: string; // The trip context this chat was attached to
    tripMembers: string[]; // denormalized from trip.members for security rules
    role: 'user' | 'model';
    content: string;
    createdAt: string; // ISO datetime. We will use this to age out older than 7 days.
    _pendingWrite?: boolean;
}

export const ACTIVITY_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#64748b',
];

export interface Activity {
    id: string;
    userId: string;
    tripId: string;
    tripMembers: string[]; // denormalized from trip.members for security rules
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
    _pendingWrite?: boolean;
}

export interface TransportRoute {
    id: string;
    userId: string;
    tripId: string;
    tripMembers: string[]; // denormalized from trip.members for security rules
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
    _pendingWrite?: boolean;
}

export interface Note {
    id: string;
    userId: string;
    tripId: string;
    tripMembers: string[]; // denormalized from trip.members for security rules
    date?: string; // ISO date YYYY-MM-DD (optional; absence means "General")
    content: string;
    format: 'freeform' | 'bullet' | 'numbered';
    order: number;
    color?: string;
    images?: string[]; // Firebase Storage download URLs
    createdAt: string; // ISO datetime
    updatedAt: string; // ISO datetime
    _pendingWrite?: boolean;
}

/** System-seeded defaults vs user-added rows (older docs may omit; treat as `custom`). */
export type PackingListGroup = 'essential' | 'custom';

export interface PackingItem {
    id: string;
    userId: string;
    tripId: string;
    tripMembers: string[]; // denormalized from trip.members for security rules
    title: string;
    /** Defaults from trip creation use `essential`; user adds use `custom`. */
    listGroup?: PackingListGroup;
    category?: 'documents' | 'clothing' | 'toiletries' | 'electronics' | 'medication' | 'other';
    quantity?: number;
    packed: boolean;
    notes?: string;
    order: number;
    createdAt: string; // ISO datetime
    updatedAt: string; // ISO datetime
    _pendingWrite?: boolean;
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
