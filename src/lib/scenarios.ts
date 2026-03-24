import { useSyncExternalStore } from 'react';
import type { Activity, TransportRoute, Trip, TripScenario } from './types';
import {
    hydrateTripScenarioStore,
    saveTripScenarioStoreToIndexedDb,
    pruneTripScenarioStore,
    clearTripScenarioStoreIndexedDb,
    removeLegacyTripScenarioStoreFromLocalStorage,
    type TripScenarioStore,
} from './scenariosStorage';

const listeners = new Set<() => void>();

function createEmptyStore(): TripScenarioStore {
    return {
        byTripId: {},
        selectedByTripId: {},
    };
}

let currentStore: TripScenarioStore = createEmptyStore();
let hydrationStarted = false;

function startScenariosHydration() {
    if (typeof window === 'undefined' || hydrationStarted) return;
    hydrationStarted = true;
    void (async () => {
        currentStore = await hydrateTripScenarioStore();
        listeners.forEach((listener) => listener());
    })();
}

startScenariosHydration();

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

function persistStore(store: TripScenarioStore) {
    currentStore = pruneTripScenarioStore(store);
    listeners.forEach((listener) => listener());
    void saveTripScenarioStoreToIndexedDb(currentStore);
}

/** Clear all what-if scenarios from memory and persistent storage (IndexedDB + legacy localStorage). */
export async function clearAllScenariosStorage(): Promise<void> {
    currentStore = createEmptyStore();
    listeners.forEach((listener) => listener());
    removeLegacyTripScenarioStoreFromLocalStorage();
    await clearTripScenarioStoreIndexedDb();
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function getSnapshot(): TripScenarioStore {
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

/** Get the current scenario by trip and scenario id (for use outside React, e.g. Import page). */
export function getScenario(tripId: string, scenarioId: string): TripScenario | null {
    const store = getSnapshot();
    const scenarios = store.byTripId[tripId] ?? [];
    return scenarios.find((s) => s.id === scenarioId) ?? null;
}

/** Replace all activities for one day in a scenario with a new list. New items get generated ids. */
export function replaceScenarioDay(
    tripId: string,
    scenarioId: string,
    date: string,
    newActivities: Omit<Activity, 'id'>[],
) {
    updateTripScenario(tripId, scenarioId, (scenario) => {
        const kept = scenario.activitiesSnapshot.filter((a) => a.date !== date);
        const added = newActivities.map((base, i) =>
            createScenarioActivity({ ...base, tripId, date, order: i }),
        );
        const nextActivities = [...kept, ...added].sort(
            (a, b) => a.date.localeCompare(b.date) || a.order - b.order,
        );
        return touchScenario(scenario, { activitiesSnapshot: nextActivities });
    });
}

/** Replace all activities in a scenario with a new list. New items get generated ids. */
export function overwriteScenarioActivities(
    tripId: string,
    scenarioId: string,
    activities: Omit<Activity, 'id'>[],
) {
    updateTripScenario(tripId, scenarioId, (scenario) => {
        const nextActivities = activities.map((base, i) =>
            createScenarioActivity({ ...base, tripId, order: i }),
        );
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
