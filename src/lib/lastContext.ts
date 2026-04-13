// Purpose: Unified "last viewed" trip context for the Dashboard hero card.

export interface LastContext {
  tripId: string;
  date: string;
  viewedAt: string;
}

const STORAGE_KEY = 'travelplanner_last_context';

export function getLastContext(): LastContext | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LastContext;
  } catch {
    return null;
  }
}

export function setLastContext(tripId: string, date: string): void {
  try {
    const ctx: LastContext = { tripId, date, viewedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
  } catch {
    // storage full — non-critical
  }
}
