import { useSyncExternalStore } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { clearAllScenariosStorage } from './scenarios';
import type { LintRule } from './types';

export interface AppSettings {
  // Appearance
  darkMode: boolean;
  compactLayout: boolean;
  textSize: number;

  // Spreadsheet
  colorCodedTimeRows: boolean;
  colorCodingOpacity: number;
  headerRowColor: 'default' | 'primary' | 'accent' | 'secondary' | 'slate' | 'transparent';
  showUnscheduledSection: boolean;
  defaultSpreadsheetZoom: number;

  // Calendar
  defaultCalendarView: 'trip' | 'day';
  showAccommodationOnTripCards: boolean;

  // Planning
  showPlanningChecks: boolean;
  showBudgetWarnings: boolean;

  // AI defaults
  aiDefaultPace: 'relaxed' | 'balanced' | 'fast';
  aiDefaultBudget: 'budget' | 'mid-range' | 'luxury';
  aiDefaultGroupType: 'solo' | 'couple' | 'family' | 'group';
  aiDefaultInterests: string;
  aiDefaultTransportPreference: string;

  // Travel lint rules — user-level "never again" guardrails injected into every AI call
  travelLintRules: LintRule[];

  // Weather
  temperatureUnit: 'C' | 'F';
  /** Start hour for hourly forecast (0–23). Default 9 = 9am. */
  hourlyForecastStartHour: number;
  /** End hour for hourly forecast (0–23). Default 21 = 9pm. */
  hourlyForecastEndHour: number;
}

const DEFAULTS: AppSettings = {
  darkMode: false,
  compactLayout: false,
  textSize: 100,

  colorCodedTimeRows: false,
  colorCodingOpacity: 6,
  headerRowColor: 'default',
  showUnscheduledSection: true,
  defaultSpreadsheetZoom: 100,

  defaultCalendarView: 'trip',
  showAccommodationOnTripCards: true,

  showPlanningChecks: true,
  showBudgetWarnings: true,

  aiDefaultPace: 'balanced',
  aiDefaultBudget: 'mid-range',
  aiDefaultGroupType: 'solo',
  aiDefaultInterests: '',
  aiDefaultTransportPreference: '',

  travelLintRules: [],

  temperatureUnit: 'C',
  hourlyForecastStartHour: 9,
  hourlyForecastEndHour: 21,
};

const STORAGE_KEY = 'travelplanner_settings_v2';
const LEGACY_KEY = 'travelplanner_settings';

const listeners = new Set<() => void>();
let currentSettings: AppSettings = loadFromLocalStorage();

function loadFromLocalStorage(): AppSettings {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return { ...DEFAULTS, ...parsed };
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as Partial<AppSettings>;
      return { ...DEFAULTS, ...parsed };
    }
  } catch { /* corrupt storage */ }
  return { ...DEFAULTS };
}

function persistLocal(settings: AppSettings) {
  currentSettings = settings;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* storage full */ }
  listeners.forEach(l => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): AppSettings {
  return currentSettings;
}

export function useSettings(): AppSettings {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function updateSettings(patch: Partial<AppSettings>) {
  const next = { ...currentSettings, ...patch };
  persistLocal(next);
  scheduleCloudSync();
}

export function resetSettings() {
  persistLocal({ ...DEFAULTS });
  scheduleCloudSync();
}

export function getSettingsSnapshot(): AppSettings {
  return currentSettings;
}

export function getAiDefaults(): Pick<AppSettings, 'aiDefaultPace' | 'aiDefaultBudget' | 'aiDefaultGroupType' | 'aiDefaultInterests' | 'aiDefaultTransportPreference'> {
  return {
    aiDefaultPace: currentSettings.aiDefaultPace,
    aiDefaultBudget: currentSettings.aiDefaultBudget,
    aiDefaultGroupType: currentSettings.aiDefaultGroupType,
    aiDefaultInterests: currentSettings.aiDefaultInterests,
    aiDefaultTransportPreference: currentSettings.aiDefaultTransportPreference,
  };
}

export function getTravelLintRules(): LintRule[] {
  return currentSettings.travelLintRules ?? [];
}

export type { LintRule };

// --------------- Firestore sync ---------------

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let currentUid: string | null = null;

function getDocRef(uid: string) {
  return doc(db, 'users', uid, 'settings', 'preferences');
}

function scheduleCloudSync() {
  if (!currentUid) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    pushToCloud().catch(() => {});
  }, 1500);
}

async function pushToCloud() {
  if (!currentUid) return;
  try {
    await setDoc(getDocRef(currentUid), {
      ...currentSettings,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (e) {
    console.warn('Settings cloud sync failed:', e);
  }
}

/** Cloud doc shape: settings fields plus updatedAt */
type CloudSettings = Partial<AppSettings> & { updatedAt?: string };

async function pullFromCloud(uid: string): Promise<CloudSettings | null> {
  try {
    const snap = await getDoc(getDocRef(uid));
    if (!snap.exists()) return null;
    return snap.data() as CloudSettings;
  } catch {
    return null;
  }
}

export async function onAuthChange(uid: string | null, isAnonymous: boolean) {
  currentUid = (!isAnonymous && uid) ? uid : null;

  if (!currentUid) return;

  const cloud = await pullFromCloud(currentUid);
  if (!cloud) {
    await pushToCloud();
    return;
  }

  const cloudUpdated = cloud.updatedAt;
  const merged = { ...DEFAULTS, ...cloud };
  delete (merged as Record<string, unknown>).updatedAt;
  persistLocal(merged as AppSettings);

  if (!cloudUpdated) {
    await pushToCloud();
  }
}

/** Clears what-if scenario drafts (IndexedDB + any legacy localStorage key). */
export async function clearLocalDrafts() {
  await clearAllScenariosStorage();
}
