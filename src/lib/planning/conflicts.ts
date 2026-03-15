import { eachDayOfInterval, format, parseISO } from 'date-fns';
import type { Activity, TransportRoute, Trip } from '../types';
import type { PlanningConflict } from './conflictTypes';
import { compareActivitiesByTimeThenOrder, getEffectiveDayLocations } from '../itinerary';

function parseTimeToMinutes(time?: string): number | null {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [hours, minutes] = time.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function getTripDates(trip: Trip): string[] {
  try {
    return eachDayOfInterval({
      start: parseISO(trip.startDate),
      end: parseISO(trip.endDate),
    }).map((day) => format(day, 'yyyy-MM-dd'));
  } catch {
    return [];
  }
}

function getTripLocation(trip: Trip, date: string): string {
  const locs = getEffectiveDayLocations(trip.itinerary?.[date], trip.dayLocations?.[date]);
  return locs[0] ?? '';
}

function buildConflictId(parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(':');
}

export function getTripPlanningConflicts(args: {
  trip: Trip;
  activities: Activity[];
  routes: TransportRoute[];
}): PlanningConflict[] {
  const { trip, activities, routes } = args;
  const tripDates = getTripDates(trip);
  const conflicts: PlanningConflict[] = [];

  const activitiesByDate = new Map<string, Activity[]>();
  const routesByDate = new Map<string, TransportRoute[]>();

  for (const activity of activities) {
    const list = activitiesByDate.get(activity.date) ?? [];
    list.push(activity);
    activitiesByDate.set(activity.date, list);
  }

  for (const route of routes) {
    const list = routesByDate.get(route.date) ?? [];
    list.push(route);
    routesByDate.set(route.date, list);
  }

  for (const date of tripDates) {
    const dayActivities = (activitiesByDate.get(date) ?? []).slice().sort(compareActivitiesByTimeThenOrder);
    const dayRoutes = routesByDate.get(date) ?? [];

    const unscheduledCount = dayActivities.filter((activity) => !activity.time).length;
    if (unscheduledCount > 0) {
      conflicts.push({
        id: buildConflictId(['unscheduled-activities', date]),
        type: 'unscheduled-activities',
        scope: 'day',
        severity: unscheduledCount >= 3 ? 'warning' : 'info',
        title: 'Unscheduled activities',
        message: `${unscheduledCount} activit${unscheduledCount === 1 ? 'y has' : 'ies have'} no assigned time yet.`,
        date,
      });
    }

    const timedActivities = dayActivities.filter((activity) => activity.time);
    const byTime = new Map<string, Activity[]>();
    for (const activity of timedActivities) {
      const time = activity.time!;
      const list = byTime.get(time) ?? [];
      list.push(activity);
      byTime.set(time, list);
    }

    for (const [time, matchingActivities] of byTime.entries()) {
      if (matchingActivities.length > 1) {
        conflicts.push({
          id: buildConflictId(['duplicate-time', date, time]),
          type: 'duplicate-time',
          scope: 'day',
          severity: 'warning',
          title: 'Duplicate activity time',
          message: `${matchingActivities.length} activities share the same ${time} start time.`,
          date,
        });
      }
    }

    for (const route of dayRoutes) {
      const departureMinutes = parseTimeToMinutes(route.departureTime);
      const arrivalMinutes = parseTimeToMinutes(route.arrivalTime);

      if (!route.departureTime || !route.arrivalTime) {
        conflicts.push({
          id: buildConflictId(['route-missing-time', route.id]),
          type: 'route-missing-time',
          scope: 'route',
          severity: 'info',
          title: 'Incomplete transport timing',
          message: `Add both departure and arrival times for ${route.from} to ${route.to} to improve planning accuracy.`,
          date: route.date,
          routeId: route.id,
        });
      }

      if (departureMinutes !== null && arrivalMinutes !== null && arrivalMinutes < departureMinutes) {
        conflicts.push({
          id: buildConflictId(['route-time-order', route.id]),
          type: 'route-time-order',
          scope: 'route',
          severity: 'warning',
          title: 'Arrival before departure',
          message: `${route.from} to ${route.to} arrives earlier than it departs. Check whether this route crosses midnight or needs corrected times.`,
          date: route.date,
          routeId: route.id,
        });
      }

      const accommodation = trip.itinerary?.[route.date]?.accommodation;
      const checkInMinutes = parseTimeToMinutes(accommodation?.checkInTime);

      if (arrivalMinutes !== null && checkInMinutes !== null && arrivalMinutes < checkInMinutes) {
        const gapMinutes = checkInMinutes - arrivalMinutes;
        const roundedHours = Math.max(1, Math.round(gapMinutes / 60));
        conflicts.push({
          id: buildConflictId(['early-arrival-check-in', route.id]),
          type: 'early-arrival-check-in',
          scope: 'route',
          severity: gapMinutes >= 180 ? 'warning' : 'info',
          title: 'Arrival before check-in',
          message: `${route.to} arrives about ${roundedHours} hour${roundedHours === 1 ? '' : 's'} before accommodation check-in.`,
          date: route.date,
          routeId: route.id,
        });
      }

      if (arrivalMinutes !== null && arrivalMinutes >= 22 * 60) {
        conflicts.push({
          id: buildConflictId(['late-arrival', route.id]),
          type: 'late-arrival',
          scope: 'route',
          severity: 'warning',
          title: 'Late arrival',
          message: `${route.from} to ${route.to} arrives late in the evening. Double-check transfers and accommodation access.`,
          date: route.date,
          routeId: route.id,
        });
      }
    }
  }

  for (let index = 1; index < tripDates.length; index += 1) {
    const previousDate = tripDates[index - 1];
    const currentDate = tripDates[index];
    const previousLocation = getTripLocation(trip, previousDate);
    const currentLocation = getTripLocation(trip, currentDate);

    if (!previousLocation || !currentLocation || previousLocation === currentLocation) continue;

    const boundaryRoutes = routes.filter((route) => route.date === previousDate || route.date === currentDate);
    if (boundaryRoutes.length === 0) {
      conflicts.push({
        id: buildConflictId(['location-change-no-route', previousDate, currentDate]),
        type: 'location-change-no-route',
        scope: 'trip',
        severity: 'warning',
        title: 'Location change without transport',
        message: `The trip moves from ${previousLocation} to ${currentLocation}, but no transport route is logged for the change.`,
        date: currentDate,
      });
    }
  }

  return conflicts;
}

export function getBudgetConflicts(args: {
  spent: number | null;
  target: number | null | undefined;
  currency: string;
}): PlanningConflict[] {
  const { spent, target, currency } = args;
  if (spent == null || !target || target <= 0) return [];

  const ratio = spent / target;
  if (ratio >= 1) {
    return [{
      id: buildConflictId(['budget-overrun', currency]),
      type: 'budget-overrun',
      scope: 'budget',
      severity: 'warning',
      title: 'Budget exceeded',
      message: `Spending has reached ${currency} ${spent.toFixed(2)} against a target of ${currency} ${target.toFixed(2)}.`,
    }];
  }

  if (ratio >= 0.9) {
    return [{
      id: buildConflictId(['budget-near-limit', currency]),
      type: 'budget-near-limit',
      scope: 'budget',
      severity: 'info',
      title: 'Budget nearly used',
      message: `Spending is at ${Math.round(ratio * 100)}% of the ${currency} ${target.toFixed(2)} budget target.`,
    }];
  }

  return [];
}
