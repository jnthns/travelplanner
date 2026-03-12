import { useSyncExternalStore } from 'react';
import type { Activity, TransportRoute, Trip, TripScenario } from './types';

interface TripScenarioStore {
    byTripId: Record<string, TripScenario[]>;
    selectedByTripId: Record<string, string | null>;
}

const STORAGE_KEY = 'travelplanner_trip_scenarios_v1';

const listeners = new Set<() => void>();

function createEmptyStore(): TripScenarioStore {
    return {
        byTripId: {},
        selectedByTripId: {},
    };
}

function cloneTrip(trip: Trip): Trip {
    return JSON.parse(JSON.stringify(trip)) as Trip;
}

function cloneActivities(activities: Activity[]): Activity[] {
    return JSON.parse(JSON.stringify(activities)) as Activity[];
}

function cloneRoutes(routes: TransportRoute[]): TransportRoute[] {
    return JSON.parse(JSON.stringify(routes)) as TransportRoute[];
}

function generateId(prefix: string): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return `${prefix}-${crypto.randomUUID()}`;
    }

    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readStore(): TripScenarioStore {
    if (typeof window === 'undefined') return createEmptyStore();

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return createEmptyStore();

        const parsed = JSON.parse(raw) as Partial<TripScenarioStore>;

        return {
            byTripId: parsed.byTripId ?? {},
            selectedByTripId: parsed.selectedByTripId ?? {},
        };
    } catch {
        return createEmptyStore();
    }
}

let currentStore = readStore();

function persistStore(store: TripScenarioStore) {
    currentStore = store;

    if (typeof window !== 'undefined') {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
        } catch {
            // Ignore local storage write failures and keep in-memory state.
        }
    }

    listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function getSnapshot() {
    return currentStore;
}

function updateStore(updater: (store: TripScenarioStore) => TripScenarioStore) {
    persistStore(updater(currentStore));
}

function touchScenario(scenario: TripScenario, updates: Partial<TripScenario>): TripScenario {
    return {
        ...scenario,
        ...updates,
        updatedAt: new Date().toISOString(),
    };
}

function updateTripScenario(tripId: string, scenarioId: string, updater: (scenario: TripScenario) => TripScenario) {
    updateStore((store) => ({
        ...store,
        byTripId: {
            ...store.byTripId,
            [tripId]: (store.byTripId[tripId] ?? []).map((scenario) =>
                scenario.id === scenarioId ? updater(scenario) : scenario,
            ),
        },
    }));
}

export function createTripScenario(params: {
    trip: Trip;
    activities: Activity[];
    routes: TransportRoute[];
    name?: string;
    objective?: string;
}): TripScenario {
    const { trip, activities, routes, name, objective } = params;
    const now = new Date().toISOString();
    const scenarioIndex = (currentStore.byTripId[trip.id] ?? []).length + 1;

    const scenario: TripScenario = {
        id: generateId('scenario'),
        tripId: trip.id,
        name: name?.trim() || `What if ${scenarioIndex}`,
        objective: objective?.trim() || undefined,
        createdAt: now,
        updatedAt: now,
        tripSnapshot: cloneTrip(trip),
        activitiesSnapshot: cloneActivities(activities),
        transportRoutesSnapshot: cloneRoutes(routes),
    };

    updateStore((store) => ({
        byTripId: {
            ...store.byTripId,
            [trip.id]: [...(store.byTripId[trip.id] ?? []), scenario],
        },
        selectedByTripId: {
            ...store.selectedByTripId,
            [trip.id]: scenario.id,
        },
    }));

    return scenario;
}

export function selectTripScenario(tripId: string, scenarioId: string | null) {
    updateStore((store) => ({
        ...store,
        selectedByTripId: {
            ...store.selectedByTripId,
            [tripId]: scenarioId,
        },
    }));
}

export function renameTripScenario(tripId: string, scenarioId: string, name: string) {
    updateTripScenario(tripId, scenarioId, (scenario) =>
        touchScenario(scenario, { name: name.trim() || scenario.name }),
    );
}

export function deleteTripScenario(tripId: string, scenarioId: string) {
    updateStore((store) => {
        const remaining = (store.byTripId[tripId] ?? []).filter((scenario) => scenario.id !== scenarioId);
        const selectedId = store.selectedByTripId[tripId] === scenarioId ? null : store.selectedByTripId[tripId] ?? null;

        return {
            byTripId: {
                ...store.byTripId,
                [tripId]: remaining,
            },
            selectedByTripId: {
                ...store.selectedByTripId,
                [tripId]: selectedId,
            },
        };
    });
}

export function updateScenarioTripSnapshot(
    tripId: string,
    scenarioId: string,
    updater: (trip: Trip) => Trip,
) {
    updateTripScenario(tripId, scenarioId, (scenario) =>
        touchScenario(scenario, { tripSnapshot: updater(cloneTrip(scenario.tripSnapshot)) }),
    );
}

export function upsertScenarioActivity(
    tripId: string,
    scenarioId: string,
    activity: Activity,
) {
    updateTripScenario(tripId, scenarioId, (scenario) => {
        const existingIndex = scenario.activitiesSnapshot.findIndex((item) => item.id === activity.id);
        const nextActivities = cloneActivities(scenario.activitiesSnapshot);

        if (existingIndex >= 0) {
            nextActivities[existingIndex] = activity;
        } else {
            nextActivities.push(activity);
        }

        return touchScenario(scenario, { activitiesSnapshot: nextActivities });
    });
}

export function removeScenarioActivity(tripId: string, scenarioId: string, activityId: string) {
    updateTripScenario(tripId, scenarioId, (scenario) =>
        touchScenario(scenario, {
            activitiesSnapshot: scenario.activitiesSnapshot.filter((activity) => activity.id !== activityId),
        }),
    );
}

export function reorderScenarioActivities(
    tripId: string,
    scenarioId: string,
    orderedActivities: Activity[],
) {
    updateTripScenario(tripId, scenarioId, (scenario) => {
        const updates = new Map(orderedActivities.map((activity, index) => [activity.id, index]));
        const nextActivities = cloneActivities(scenario.activitiesSnapshot).map((activity) => {
            const nextOrder = updates.get(activity.id);
            return nextOrder == null ? activity : { ...activity, order: nextOrder };
        });

        return touchScenario(scenario, { activitiesSnapshot: nextActivities });
    });
}

export function useTripScenarios(tripId: string | null) {
    const store = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    const scenarios = tripId ? store.byTripId[tripId] ?? [] : [];
    const activeScenarioId = tripId ? store.selectedByTripId[tripId] ?? null : null;
    const activeScenario = scenarios.find((scenario) => scenario.id === activeScenarioId) ?? null;

    return {
        scenarios,
        activeScenarioId,
        activeScenario,
    };
}

export function createScenarioActivity(
    base: Omit<Activity, 'id'>,
): Activity {
    return {
        ...base,
        id: generateId('activity'),
    };
}
