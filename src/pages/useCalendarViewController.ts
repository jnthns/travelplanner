import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { useTrips, useActivities, useTransportRoutes } from '../lib/store';
import { CATEGORY_COLORS } from '../lib/types';
import { useToast } from '../components/Toast';
import { logEvent } from '../lib/amplitude';
import { generateDayActivityDescriptions, generateDaySummary, generateOptimizedRoute } from '../lib/ai/actions/calendar';
import { getNearbyPlacesLabel } from '../lib/services/placesService';
import { getTripPlanningConflicts } from '../lib/planning/conflicts';
import { useSettings } from '../lib/settings';
import { useWeatherForTrip } from '../lib/weather';
import { compareActivitiesByTimeThenOrder, getEffectiveDayLocations } from '../lib/itinerary';
import {
    createScenarioActivity,
    removeScenarioActivity,
    reorderScenarioActivities,
    updateScenarioTripSnapshot,
    upsertScenarioActivity,
    useTripScenarios,
} from '../lib/scenarios';
import { prefetchTripDocumentsForOfflineCache } from '../lib/prefetchTripCache';
import type { Activity } from '../lib/types';

const CALENDAR_VIEW_KEY = 'travelplanner_calendar_view';

export type CalendarViewMode = 'day' | 'trip';

interface CalendarPrefs {
    viewMode: CalendarViewMode;
    selectedTripId: string | null;
    currentDateStr: string | null;
}

export interface PendingActivityDescription {
    activityId: string;
    title: string;
    summary: string;
    tips: string[];
}

function loadCalendarPrefs(): CalendarPrefs {
    try {
        const raw = localStorage.getItem(CALENDAR_VIEW_KEY);
        if (!raw) return { viewMode: 'trip', selectedTripId: null, currentDateStr: null };
        const p = JSON.parse(raw) as Partial<CalendarPrefs>;
        const viewMode = p.viewMode === 'day' || p.viewMode === 'trip' ? p.viewMode : 'trip';
        return { viewMode, selectedTripId: p.selectedTripId ?? null, currentDateStr: p.currentDateStr ?? null };
    } catch {
        return { viewMode: 'trip', selectedTripId: null, currentDateStr: null };
    }
}

function saveCalendarPrefs(viewMode: CalendarViewMode, selectedTripId: string | null, currentDateStr: string | null) {
    try {
        localStorage.setItem(CALENDAR_VIEW_KEY, JSON.stringify({ viewMode, selectedTripId, currentDateStr }));
    } catch {
        /* ignore */
    }
}

export function useCalendarViewController() {
    const { trips, updateItineraryDay } = useTrips();
    const { activities, addActivity, updateActivity, deleteActivity, restoreActivity, reorderActivities } =
        useActivities();
    const { getRoutesByTrip } = useTransportRoutes();
    const { showToast } = useToast();
    const appSettings = useSettings();

    const savedPrefs = useMemo(() => loadCalendarPrefs(), []);
    const [currentDate, setCurrentDate] = useState(() => {
        if (savedPrefs.currentDateStr) {
            try {
                return parseISO(savedPrefs.currentDateStr);
            } catch {
                /* fallback */
            }
        }
        return new Date();
    });
    const [viewMode, setViewMode] = useState<CalendarViewMode>(savedPrefs.viewMode);
    const [selectedTripId, setSelectedTripId] = useState<string | null>(savedPrefs.selectedTripId);
    const [addingActivityForDate, setAddingActivityForDate] = useState<string | null>(null);
    const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
    const [tripSummary, setTripSummary] = useState<{ summary: string; highlights: string[] } | null>(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [summaryError, setSummaryError] = useState<string | null>(null);
    const [optimizationLoading, setOptimizationLoading] = useState(false);
    const [optimizationError, setOptimizationError] = useState<string | null>(null);
    const [optimizedRoute, setOptimizedRoute] = useState<{ recommendation: string; optimizedOrder: string[] } | null>(
        null,
    );
    const [descriptionLoading, setDescriptionLoading] = useState(false);
    const [descriptionError, setDescriptionError] = useState<string | null>(null);
    const [pendingDescriptions, setPendingDescriptions] = useState<PendingActivityDescription[] | null>(null);
    const [accommodationEditDate, setAccommodationEditDate] = useState<string | null>(null);
    const [accommodationCityInput, setAccommodationCityInput] = useState('');
    const [accommodationNameInput, setAccommodationNameInput] = useState('');
    const [showNearbyRestaurantsForActivityId, setShowNearbyRestaurantsForActivityId] = useState<string | null>(null);
    const [reviewsActivityId, setReviewsActivityId] = useState<string | null>(null);
    const [conflictsExpandedDate, setConflictsExpandedDate] = useState<string | null>(null);
    const latestDescriptionContextRef = useRef({
        currentDateStr: '',
        selectedTripId: null as string | null,
        scenarioId: null as string | null,
    });

    const selectedTrip = trips.find((t) => t.id === selectedTripId);
    const { weatherByDate, loading: weatherLoading } = useWeatherForTrip(selectedTrip ?? undefined);
    const { activeScenario } = useTripScenarios(selectedTripId);
    const effectiveTrip = activeScenario?.tripSnapshot ?? selectedTrip;
    const hasLocationForDate = useCallback(
        (dateStr: string) =>
            getEffectiveDayLocations(effectiveTrip?.itinerary?.[dateStr], effectiveTrip?.dayLocations?.[dateStr]).length >=
            1,
        [effectiveTrip],
    );
    const tripRoutes = useMemo(
        () => (selectedTripId ? getRoutesByTrip(selectedTripId) : []),
        [selectedTripId, getRoutesByTrip],
    );
    const effectiveRoutes = activeScenario?.transportRoutesSnapshot ?? tripRoutes;
    const tripActivities = useMemo(
        () => (selectedTripId ? activities.filter((activity) => activity.tripId === selectedTripId) : []),
        [selectedTripId, activities],
    );
    const effectiveActivities = activeScenario?.activitiesSnapshot ?? tripActivities;
    const currentDateStr = format(currentDate, 'yyyy-MM-dd');
    const currentDayLocations = getEffectiveDayLocations(
        effectiveTrip?.itinerary?.[currentDateStr],
        effectiveTrip?.dayLocations?.[currentDateStr],
    );

    useEffect(() => {
        if (!accommodationEditDate || !effectiveTrip) return;
        const dayData = effectiveTrip.itinerary?.[accommodationEditDate];
        const cityDisplay = getEffectiveDayLocations(
            dayData,
            effectiveTrip.dayLocations?.[accommodationEditDate],
        ).join(', ');
        setAccommodationCityInput(cityDisplay);
        setAccommodationNameInput(dayData?.accommodation?.name ?? '');
    }, [accommodationEditDate, effectiveTrip]);

    useEffect(() => {
        saveCalendarPrefs(viewMode, selectedTripId, format(currentDate, 'yyyy-MM-dd'));
    }, [viewMode, selectedTripId, currentDate]);

    /** Warm Firestore persistent cache for the selected trip while online. */
    useEffect(() => {
        if (!selectedTripId) return;
        if (typeof navigator !== 'undefined' && !navigator.onLine) return;
        void prefetchTripDocumentsForOfflineCache(selectedTripId);
    }, [selectedTripId]);

    useEffect(() => {
        if (!effectiveTrip) return;
        try {
            const tripStart = parseISO(effectiveTrip.startDate);
            const tripEnd = parseISO(effectiveTrip.endDate);
            if (currentDate < tripStart || currentDate > tripEnd) {
                setCurrentDate(tripStart);
            }
        } catch {
            /* ignore */
        }
    }, [effectiveTrip?.id, effectiveTrip?.startDate, effectiveTrip?.endDate, currentDate]);

    useEffect(() => {
        latestDescriptionContextRef.current = {
            currentDateStr,
            selectedTripId,
            scenarioId: activeScenario?.id ?? null,
        };
        setPendingDescriptions(null);
        setDescriptionError(null);
        setDescriptionLoading(false);
    }, [currentDateStr, selectedTripId, activeScenario?.id]);

    const handleSelectTrip = (tripId: string | null) => {
        setSelectedTripId(tripId);
        if (tripId) {
            const trip = trips.find((t) => t.id === tripId);
            if (trip) {
                try {
                    setCurrentDate(parseISO(trip.startDate));
                } catch {
                    /* ignore */
                }
            }
        }
    };

    const hasDaySummaryContent =
        !!descriptionError ||
        !!summaryError ||
        !!optimizationError ||
        !!pendingDescriptions ||
        !!optimizedRoute;

    const calendarDays = useMemo(() => {
        if (viewMode === 'trip' && selectedTrip) {
            try {
                return eachDayOfInterval({
                    start: parseISO(effectiveTrip?.startDate ?? selectedTrip.startDate),
                    end: parseISO(effectiveTrip?.endDate ?? selectedTrip.endDate),
                });
            } catch {
                return [];
            }
        }
        if (viewMode === 'day') {
            return [currentDate];
        }
        return [];
    // Intentionally mirrors original deps: selectedTrip + effectiveTrip read inside without listing effectiveTrip (scenario date range).
    }, [currentDate, viewMode, selectedTrip]);

    const getActivitiesForDate = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return effectiveActivities.filter((a) => a.date === dateStr);
    };

    const tripDays = useMemo(() => {
        if (!effectiveTrip) return [];
        try {
            return eachDayOfInterval({
                start: parseISO(effectiveTrip.startDate),
                end: parseISO(effectiveTrip.endDate),
            });
        } catch {
            return [];
        }
    }, [effectiveTrip]);

    const handleReorderActivities = useCallback(
        (reordered: Activity[]) => {
            const updates = reordered
                .map((act, idx) => ({ id: act.id, order: idx }))
                .filter((u, idx) => reordered[idx].order !== u.order);
            if (updates.length > 0) {
                if (selectedTripId && activeScenario) {
                    reorderScenarioActivities(selectedTripId, activeScenario.id, reordered);
                } else {
                    reorderActivities(updates);
                }
                logEvent('Activities Reordered', { count: updates.length, source: 'calendar_day' });
            }
        },
        [activeScenario, reorderActivities, selectedTripId],
    );

    const getActivityColor = (activity: { category?: string; color?: string }) =>
        activity.color ?? CATEGORY_COLORS[activity.category ?? 'other'];

    const dayViewActivities = effectiveActivities
        .filter((a) => a.date === currentDateStr)
        .sort(compareActivitiesByTimeThenOrder);

    const planningConflicts = useMemo(() => {
        if (!effectiveTrip) return [];
        return getTripPlanningConflicts({
            trip: effectiveTrip,
            activities: effectiveActivities,
            routes: effectiveRoutes,
        });
    }, [effectiveTrip, effectiveActivities, effectiveRoutes]);

    const conflictCountsByDate = useMemo(() => {
        const counts: Record<string, number> = {};
        planningConflicts.forEach((conflict) => {
            if (!conflict.date) return;
            counts[conflict.date] = (counts[conflict.date] || 0) + 1;
        });
        return counts;
    }, [planningConflicts]);

    const handleSaveAccommodationForDate = useCallback(() => {
        if (!accommodationEditDate || !selectedTripId || !effectiveTrip) {
            setAccommodationEditDate(null);
            return;
        }
        const dateStr = accommodationEditDate;
        const dayData = effectiveTrip.itinerary?.[dateStr];

        const parsedCities = accommodationCityInput
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);

        const locationUpdates =
            parsedCities.length === 0
                ? { location: '', locations: [] as string[] }
                : parsedCities.length === 1
                  ? { location: parsedCities[0], locations: [parsedCities[0]] }
                  : { location: parsedCities[0], locations: parsedCities };

        const hasAccommodationText = accommodationNameInput.trim().length > 0;

        const nextAccommodation = hasAccommodationText
            ? {
                  ...(dayData?.accommodation ?? {}),
                  name: accommodationNameInput.trim() || dayData?.accommodation?.name || '',
              }
            : undefined;

        const updates: {
            location: string;
            locations: string[];
            accommodation?: {
                name: string;
                cost?: number;
                currency?: string;
            };
        } = {
            location: locationUpdates.location,
            locations: locationUpdates.locations,
        };

        if (nextAccommodation) {
            updates.accommodation = nextAccommodation;
        }

        if (activeScenario) {
            updateScenarioTripSnapshot(selectedTripId, activeScenario.id, (trip) => ({
                ...trip,
                itinerary: {
                    ...(trip.itinerary || {}),
                    [dateStr]: {
                        ...(trip.itinerary?.[dateStr] || {}),
                        ...updates,
                    },
                },
            }));
        } else {
            updateItineraryDay(selectedTripId, dateStr, updates);
        }

        setAccommodationEditDate(null);
        showToast('Accommodation updated');
    }, [
        accommodationCityInput,
        accommodationNameInput,
        accommodationEditDate,
        selectedTripId,
        effectiveTrip,
        activeScenario,
        updateItineraryDay,
        showToast,
    ]);

    const handleSaveActivity = (
        activityData:
            | Omit<Activity, 'id' | 'userId' | 'tripMembers'>
            | ({ id: string } & Partial<Omit<Activity, 'userId'>>),
        forDate?: string,
    ) => {
        const targetDate = forDate ?? currentDateStr;
        if ('id' in activityData && activityData.id) {
            if (selectedTripId && activeScenario) {
                const existingActivity = effectiveActivities.find((activity) => activity.id === activityData.id);
                if (!existingActivity) return;
                upsertScenarioActivity(selectedTripId, activeScenario.id, { ...existingActivity, ...activityData });
            } else {
                updateActivity(activityData.id, activityData);
            }
        } else if (selectedTripId && targetDate) {
            const orderFallback = dayViewActivities.length;
            if (activeScenario) {
                const scenarioActivity = createScenarioActivity({
                    ...(activityData as Omit<Activity, 'id'>),
                    tripId: selectedTripId,
                    date: targetDate,
                    order: ('order' in activityData ? activityData.order : orderFallback) ?? orderFallback,
                    title: ('title' in activityData ? activityData.title : '') || 'Activity',
                    userId: selectedTrip?.userId || 'scenario-user',
                    tripMembers: selectedTrip?.members || [],
                });
                upsertScenarioActivity(selectedTripId, activeScenario.id, scenarioActivity);
            } else {
                addActivity(
                    {
                        ...activityData,
                        tripId: selectedTripId,
                        date: targetDate,
                        order: ('order' in activityData ? activityData.order : orderFallback) ?? orderFallback,
                        title: ('title' in activityData ? activityData.title : '') || 'Activity',
                    } as Omit<Activity, 'id' | 'userId' | 'tripMembers'>,
                    selectedTrip?.members || [],
                );
            }
        }
        setAddingActivityForDate(null);
        setEditingActivityId(null);
    };

    const handleGenerateSummary = async () => {
        if (!selectedTrip || dayViewActivities.length === 0) return;
        setSummaryLoading(true);
        setSummaryError(null);
        setTripSummary(null);

        logEvent('Trip Summary Requested', {
            trip_name: selectedTrip.name,
            activity_count: dayViewActivities.length,
            date: currentDateStr,
        });
        try {
            const parsed = await generateDaySummary({
                trip: effectiveTrip ?? selectedTrip,
                currentDate,
                currentDateStr,
                activities: dayViewActivities,
            });
            if (!parsed.summary || !Array.isArray(parsed.highlights)) throw new Error('Invalid response format');
            setTripSummary(parsed);
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Summary generation failed';
            setSummaryError(/429|quota|rate/i.test(msg) ? 'API rate limit reached — please wait a minute and try again.' : msg);
        } finally {
            setSummaryLoading(false);
        }
    };

    const handleOptimizeRoute = async () => {
        if (!selectedTrip || dayViewActivities.length < 2) return;
        setOptimizationLoading(true);
        setOptimizationError(null);
        setOptimizedRoute(null);

        logEvent('Route Optimization Requested', { date: currentDateStr, activity_count: dayViewActivities.length });
        try {
            const parsed = await generateOptimizedRoute({
                trip: effectiveTrip ?? selectedTrip,
                currentDateStr,
                activities: dayViewActivities,
            });
            if (
                !parsed.recommendation ||
                !Array.isArray(parsed.optimizedOrder) ||
                parsed.optimizedOrder.length !== dayViewActivities.length
            ) {
                throw new Error('Invalid response format');
            }
            setOptimizedRoute(parsed);
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Optimization failed';
            setOptimizationError(/429|quota|rate/i.test(msg) ? 'API rate limit reached — please wait a minute and try again.' : msg);
        } finally {
            setOptimizationLoading(false);
        }
    };

    const handleGenerateDescriptions = async () => {
        if (!selectedTrip || dayViewActivities.length === 0) return;
        const requestContext = {
            currentDateStr,
            selectedTripId,
            scenarioId: activeScenario?.id ?? null,
        };
        setDescriptionLoading(true);
        setDescriptionError(null);
        setPendingDescriptions(null);

        logEvent('Activity Descriptions Requested', {
            trip_name: selectedTrip.name,
            activity_count: dayViewActivities.length,
            date: currentDateStr,
        });

        try {
            const parsed = await generateDayActivityDescriptions({
                trip: effectiveTrip ?? selectedTrip,
                currentDateStr,
                activities: dayViewActivities,
            });

            const nextSuggestions = parsed
                .map((item) => {
                    const activity = dayViewActivities.find((candidate) => candidate.id === item.activityId);
                    if (!activity) return null;
                    return {
                        activityId: item.activityId,
                        title: activity.title,
                        summary: item.summary.trim(),
                        tips: item.tips.map((tip) => tip.trim()).filter(Boolean),
                    };
                })
                .filter((item): item is PendingActivityDescription => Boolean(item));

            if (nextSuggestions.length !== dayViewActivities.length) {
                throw new Error('Missing one or more activity descriptions');
            }

            const latestContext = latestDescriptionContextRef.current;
            if (
                latestContext.currentDateStr !== requestContext.currentDateStr ||
                latestContext.selectedTripId !== requestContext.selectedTripId ||
                latestContext.scenarioId !== requestContext.scenarioId
            ) {
                return;
            }

            setPendingDescriptions(nextSuggestions);
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Description generation failed';
            const latestContext = latestDescriptionContextRef.current;
            if (
                latestContext.currentDateStr !== requestContext.currentDateStr ||
                latestContext.selectedTripId !== requestContext.selectedTripId ||
                latestContext.scenarioId !== requestContext.scenarioId
            ) {
                return;
            }
            setDescriptionError(/429|quota|rate/i.test(msg) ? 'API rate limit reached — please wait a minute and try again.' : msg);
        } finally {
            const latestContext = latestDescriptionContextRef.current;
            if (
                latestContext.currentDateStr === requestContext.currentDateStr &&
                latestContext.selectedTripId === requestContext.selectedTripId &&
                latestContext.scenarioId === requestContext.scenarioId
            ) {
                setDescriptionLoading(false);
            }
        }
    };

    const dismissPendingDescription = (activityId: string) => {
        setPendingDescriptions((current) => {
            if (!current) return null;
            const next = current.filter((item) => item.activityId !== activityId);
            return next.length > 0 ? next : null;
        });
        logEvent('Activity Description Declined', { activity_id: activityId, date: currentDateStr });
    };

    const applyPendingDescription = async (activityId: string, summary: string, tips: string[]) => {
        const activity = dayViewActivities.find((candidate) => candidate.id === activityId);
        if (!activity) return;
        const details = `${summary}\n\n${tips.map((tip) => `- ${tip}`).join('\n')}`;

        if (selectedTripId && activeScenario) {
            upsertScenarioActivity(selectedTripId, activeScenario.id, { ...activity, details });
        } else {
            await updateActivity(activityId, { details });
        }

        setPendingDescriptions((current) => {
            if (!current) return null;
            const next = current.filter((item) => item.activityId !== activityId);
            return next.length > 0 ? next : null;
        });

        logEvent('Activity Description Accepted', {
            activity_id: activityId,
            activity_title: activity.title,
            date: currentDateStr,
        });
    };

    const handleAcceptAllDescriptions = async () => {
        if (!pendingDescriptions || pendingDescriptions.length === 0) return;

        const count = pendingDescriptions.length;
        await Promise.all(
            pendingDescriptions.map((item) => applyPendingDescription(item.activityId, item.summary, item.tips)),
        );
        setPendingDescriptions(null);

        logEvent('All Activity Descriptions Accepted', {
            count,
            date: currentDateStr,
        });
    };

    return {
        trips,
        updateItineraryDay,
        activities,
        addActivity,
        updateActivity,
        deleteActivity,
        restoreActivity,
        reorderActivities,
        showToast,
        appSettings,
        currentDate,
        setCurrentDate,
        viewMode,
        setViewMode,
        selectedTripId,
        setSelectedTripId,
        selectedTrip,
        addingActivityForDate,
        setAddingActivityForDate,
        editingActivityId,
        setEditingActivityId,
        tripSummary,
        setTripSummary,
        summaryLoading,
        summaryError,
        optimizationLoading,
        optimizationError,
        optimizedRoute,
        setOptimizedRoute,
        descriptionLoading,
        descriptionError,
        pendingDescriptions,
        setPendingDescriptions,
        accommodationEditDate,
        setAccommodationEditDate,
        accommodationCityInput,
        setAccommodationCityInput,
        accommodationNameInput,
        setAccommodationNameInput,
        showNearbyRestaurantsForActivityId,
        setShowNearbyRestaurantsForActivityId,
        reviewsActivityId,
        setReviewsActivityId,
        conflictsExpandedDate,
        setConflictsExpandedDate,
        weatherByDate,
        weatherLoading,
        activeScenario,
        effectiveTrip,
        hasLocationForDate,
        effectiveRoutes,
        effectiveActivities,
        currentDateStr,
        currentDayLocations,
        handleSelectTrip,
        calendarDays,
        getActivitiesForDate,
        tripDays,
        handleReorderActivities,
        getActivityColor,
        dayViewActivities,
        planningConflicts,
        conflictCountsByDate,
        handleSaveAccommodationForDate,
        handleSaveActivity,
        handleGenerateSummary,
        handleOptimizeRoute,
        handleGenerateDescriptions,
        dismissPendingDescription,
        applyPendingDescription,
        handleAcceptAllDescriptions,
        hasDaySummaryContent,
        getNearbyPlacesLabel,
        updateScenarioTripSnapshot,
        getEffectiveDayLocations,
        reorderScenarioActivities,
        removeScenarioActivity,
    };
}
