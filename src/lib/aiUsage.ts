import { useSyncExternalStore } from 'react';

export interface AiUsageSnapshot {
  dateKey: string;
  attempted: number;
  succeeded: number;
  failed: number;
  retried: number;
  lastModel: string | null;
}

const STORAGE_KEY = 'travelplanner_ai_usage_v1';
const PST_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Gemini API daily rate limits (requests per day, PST rollover). Used for header display. */
export const GEMINI_RATE_LIMITS = {
  free: 250,
  tier1: 1500,
  tier2: 4000,
} as const;
const RESET_CHECK_INTERVAL_MS = 60 * 1000;

const listeners = new Set<() => void>();

let cachedSnapshot: AiUsageSnapshot | null = null;
let resetIntervalId: number | null = null;
let storageListenerAttached = false;

function getCurrentPstDateKey(now = new Date()): string {
  // Fixed UTC-8 reset boundary so the counter rolls over at 00:00 PST.
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const pstMs = utcMs - PST_OFFSET_MS;
  return new Date(pstMs).toISOString().slice(0, 10);
}

function createEmptySnapshot(dateKey = getCurrentPstDateKey()): AiUsageSnapshot {
  return {
    dateKey,
    attempted: 0,
    succeeded: 0,
    failed: 0,
    retried: 0,
    lastModel: null,
  };
}

function toNonNegativeInt(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function normalizeSnapshot(value: unknown): AiUsageSnapshot {
  if (!value || typeof value !== 'object') return createEmptySnapshot();

  const raw = value as Partial<AiUsageSnapshot>;
  const dateKey = typeof raw.dateKey === 'string' ? raw.dateKey : getCurrentPstDateKey();

  return {
    dateKey,
    attempted: toNonNegativeInt(raw.attempted),
    succeeded: toNonNegativeInt(raw.succeeded),
    failed: toNonNegativeInt(raw.failed),
    retried: toNonNegativeInt(raw.retried),
    lastModel: typeof raw.lastModel === 'string' && raw.lastModel.trim() ? raw.lastModel : null,
  };
}

function readSnapshotFromStorage(): AiUsageSnapshot {
  if (typeof window === 'undefined') return createEmptySnapshot();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptySnapshot();

    const snapshot = normalizeSnapshot(JSON.parse(raw));
    return snapshot.dateKey === getCurrentPstDateKey()
      ? snapshot
      : createEmptySnapshot();
  } catch {
    return createEmptySnapshot();
  }
}

function writeSnapshotToStorage(snapshot: AiUsageSnapshot) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage failures and keep the in-memory snapshot usable.
  }
}

function emitChange() {
  listeners.forEach((listener) => listener());
}

function ensureCurrentSnapshot(): AiUsageSnapshot {
  if (!cachedSnapshot) {
    cachedSnapshot = readSnapshotFromStorage();
    return cachedSnapshot;
  }

  const currentDateKey = getCurrentPstDateKey();
  if (cachedSnapshot.dateKey !== currentDateKey) {
    cachedSnapshot = createEmptySnapshot(currentDateKey);
    writeSnapshotToStorage(cachedSnapshot);
  }

  return cachedSnapshot;
}

function checkForDailyReset() {
  const previousDateKey = cachedSnapshot?.dateKey;
  const snapshot = ensureCurrentSnapshot();

  if (previousDateKey && previousDateKey !== snapshot.dateKey) {
    emitChange();
  }
}

function handleStorageChange(event: StorageEvent) {
  if (event.key !== STORAGE_KEY) return;

  cachedSnapshot = readSnapshotFromStorage();
  emitChange();
}

function startBackgroundSync() {
  if (typeof window === 'undefined') return;

  if (resetIntervalId === null) {
    resetIntervalId = window.setInterval(checkForDailyReset, RESET_CHECK_INTERVAL_MS);
  }

  if (!storageListenerAttached) {
    window.addEventListener('storage', handleStorageChange);
    storageListenerAttached = true;
  }
}

function stopBackgroundSyncIfIdle() {
  if (listeners.size > 0 || typeof window === 'undefined') return;

  if (resetIntervalId !== null) {
    window.clearInterval(resetIntervalId);
    resetIntervalId = null;
  }

  if (storageListenerAttached) {
    window.removeEventListener('storage', handleStorageChange);
    storageListenerAttached = false;
  }
}

function updateSnapshot(updater: (snapshot: AiUsageSnapshot) => AiUsageSnapshot) {
  const nextSnapshot = updater(ensureCurrentSnapshot());
  cachedSnapshot = nextSnapshot;
  writeSnapshotToStorage(nextSnapshot);
  emitChange();
}

export function getAiUsageSnapshot(): AiUsageSnapshot {
  return ensureCurrentSnapshot();
}

export function subscribeToAiUsage(listener: () => void): () => void {
  listeners.add(listener);
  startBackgroundSync();

  return () => {
    listeners.delete(listener);
    stopBackgroundSyncIfIdle();
  };
}

export function useAiUsage(): AiUsageSnapshot {
  return useSyncExternalStore(subscribeToAiUsage, getAiUsageSnapshot, getAiUsageSnapshot);
}

export function recordAiRequestAttempt(model?: string) {
  updateSnapshot((snapshot) => ({
    ...snapshot,
    attempted: snapshot.attempted + 1,
    lastModel: model?.trim() || snapshot.lastModel,
  }));
}

export function recordAiRequestSuccess() {
  updateSnapshot((snapshot) => ({
    ...snapshot,
    succeeded: snapshot.succeeded + 1,
  }));
}

export function recordAiRequestFailure() {
  updateSnapshot((snapshot) => ({
    ...snapshot,
    failed: snapshot.failed + 1,
  }));
}

export function recordAiRequestRetry() {
  updateSnapshot((snapshot) => ({
    ...snapshot,
    retried: snapshot.retried + 1,
  }));
}
