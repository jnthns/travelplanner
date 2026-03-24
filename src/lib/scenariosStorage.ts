import type { TripScenario } from './types';

/** Same shape as internal store in scenarios.ts */
export interface TripScenarioStore {
    byTripId: Record<string, TripScenario[]>;
    selectedByTripId: Record<string, string | null>;
}

const DB_NAME = 'travelplanner_scenarios';
const DB_VERSION = 1;
const KV_STORE = 'kv';
const IDB_KEY = 'trip_scenario_store_v1';

/** Legacy key — migrated once into IndexedDB, then removed */
export const LEGACY_LOCALSTORAGE_KEY = 'travelplanner_trip_scenarios_v1';

/** Cap scenarios per trip to keep storage bounded */
export const MAX_SCENARIOS_PER_TRIP = 20;

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve(req.result);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(KV_STORE)) {
                db.createObjectStore(KV_STORE);
            }
        };
    });
}

function isStoreEmpty(store: TripScenarioStore): boolean {
    return Object.keys(store.byTripId).length === 0;
}

/** Keep newest scenarios per trip by updatedAt (fallback createdAt). */
export function pruneTripScenarioStore(store: TripScenarioStore): TripScenarioStore {
    const byTripId: Record<string, TripScenario[]> = {};
    const selectedByTripId = { ...store.selectedByTripId };

    for (const [tripId, scenarios] of Object.entries(store.byTripId)) {
        const sorted = [...scenarios].sort((a, b) => {
            const tb = b.updatedAt || b.createdAt;
            const ta = a.updatedAt || a.createdAt;
            return tb.localeCompare(ta);
        });
        const kept = sorted.slice(0, MAX_SCENARIOS_PER_TRIP);
        byTripId[tripId] = kept;

        const sel = selectedByTripId[tripId];
        if (sel && !kept.some((s) => s.id === sel)) {
            selectedByTripId[tripId] = kept[0]?.id ?? null;
        }
    }

    return { byTripId, selectedByTripId };
}

export async function loadTripScenarioStoreFromIndexedDb(): Promise<TripScenarioStore | null> {
    try {
        const db = await openDb();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(KV_STORE, 'readonly');
            const req = tx.objectStore(KV_STORE).get(IDB_KEY);
            req.onsuccess = () => resolve((req.result as TripScenarioStore | undefined) ?? null);
            req.onerror = () => reject(req.error);
        });
    } catch {
        return null;
    }
}

export async function saveTripScenarioStoreToIndexedDb(store: TripScenarioStore): Promise<void> {
    try {
        const db = await openDb();
        const pruned = pruneTripScenarioStore(store);
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(KV_STORE, 'readwrite');
            tx.objectStore(KV_STORE).put(pruned, IDB_KEY);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch {
        /* ignore IDB failures; in-memory store still works */
    }
}

export function readLegacyTripScenarioStoreFromLocalStorage(): TripScenarioStore | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(LEGACY_LOCALSTORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<TripScenarioStore>;
        return {
            byTripId: parsed.byTripId ?? {},
            selectedByTripId: parsed.selectedByTripId ?? {},
        };
    } catch {
        return null;
    }
}

export function removeLegacyTripScenarioStoreFromLocalStorage(): void {
    try {
        window.localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
    } catch {
        /* ignore */
    }
}

/** Clear persisted scenarios (e.g. settings “clear drafts”). */
export async function clearTripScenarioStoreIndexedDb(): Promise<void> {
    try {
        const db = await openDb();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(KV_STORE, 'readwrite');
            tx.objectStore(KV_STORE).delete(IDB_KEY);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch {
        /* ignore */
    }
}

export async function hydrateTripScenarioStore(): Promise<TripScenarioStore> {
    let store = await loadTripScenarioStoreFromIndexedDb();

    if (!store || isStoreEmpty(store)) {
        const legacy = readLegacyTripScenarioStoreFromLocalStorage();
        if (legacy && !isStoreEmpty(legacy)) {
            store = pruneTripScenarioStore(legacy);
            removeLegacyTripScenarioStoreFromLocalStorage();
            await saveTripScenarioStoreToIndexedDb(store);
        } else {
            store = { byTripId: {}, selectedByTripId: {} };
        }
    } else {
        const pruned = pruneTripScenarioStore(store);
        if (JSON.stringify(pruned) !== JSON.stringify(store)) {
            await saveTripScenarioStoreToIndexedDb(pruned);
        }
        store = pruned;
    }

    return store;
}
