import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
    format,
    eachDayOfInterval,
    isSameDay,
    parseISO,
} from 'date-fns';
import { AlertTriangle, Info, Plus, Pencil, GripVertical, Loader2 } from 'lucide-react';
import { useTrips, useActivities, useTransportRoutes } from '../lib/store';
import { CATEGORY_EMOJIS, CATEGORY_COLORS } from '../lib/types';
import ActivityForm from '../components/ActivityForm';
import DraggableList from '../components/DraggableList';
import Markdown from '../components/Markdown';
import { useToast } from '../components/Toast';
import { logEvent } from '../lib/amplitude';
import { generateDayActivityDescriptions, generateNearbyRecommendations, generateOptimizedRoute } from '../lib/ai/actions/calendar';
import ScenarioSwitcher from '../components/ScenarioSwitcher';
import { getTripPlanningConflicts } from '../lib/planning/conflicts';
import { useSettings } from '../lib/settings';
import {
    createScenarioActivity,
    removeScenarioActivity,
    reorderScenarioActivities,
    updateScenarioTripSnapshot,
    upsertScenarioActivity,
    useTripScenarios,
} from '../lib/scenarios';
import styles from './CalendarView.module.css';

const CALENDAR_VIEW_KEY = 'travelplanner_calendar_view';

type ViewMode = 'day' | 'trip';

interface CalendarPrefs {
    viewMode: ViewMode;
    selectedTripId: string | null;
    currentDateStr: string | null;
}

interface PendingActivityDescription {
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
        const viewMode = (p.viewMode === 'day' || p.viewMode === 'trip') ? p.viewMode : 'trip';
        return { viewMode, selectedTripId: p.selectedTripId ?? null, currentDateStr: p.currentDateStr ?? null };
    } catch {
        return { viewMode: 'trip', selectedTripId: null, currentDateStr: null };
    }
}

function saveCalendarPrefs(viewMode: ViewMode, selectedTripId: string | null, currentDateStr: string | null) {
    try {
        localStorage.setItem(CALENDAR_VIEW_KEY, JSON.stringify({ viewMode, selectedTripId, currentDateStr }));
    } catch { /* ignore */ }
}

const CalendarView: React.FC = () => {
    const { trips, updateItineraryDay } = useTrips();
    const { activities, addActivity, updateActivity, deleteActivity, restoreActivity, reorderActivities } = useActivities();
    const { getRoutesByTrip } = useTransportRoutes();
    const { showToast } = useToast();
    const appSettings = useSettings();

    const savedPrefs = useMemo(() => loadCalendarPrefs(), []);
    const [currentDate, setCurrentDate] = useState(() => {
        if (savedPrefs.currentDateStr) {
            try { return parseISO(savedPrefs.currentDateStr); } catch { /* fallback */ }
        }
        return new Date();
    });
    const [viewMode, setViewMode] = useState<ViewMode>(savedPrefs.viewMode);
    const [selectedTripId, setSelectedTripId] = useState<string | null>(savedPrefs.selectedTripId);
    const [addingActivityForDate, setAddingActivityForDate] = useState<string | null>(null);
    const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
    const [nearbyRecommendations, setNearbyRecommendations] = useState<{ name: string; location?: string; reason: string; weight: number; crowded?: boolean }[] | null>(null);
    const [recommendationsLoading, setRecommendationsLoading] = useState(false);
    const [recommendationsError, setRecommendationsError] = useState<string | null>(null);
    const [optimizationLoading, setOptimizationLoading] = useState(false);
    const [optimizationError, setOptimizationError] = useState<string | null>(null);
    const [optimizedRoute, setOptimizedRoute] = useState<{ recommendation: string; optimizedOrder: string[] } | null>(null);
    const [descriptionLoading, setDescriptionLoading] = useState(false);
    const [descriptionError, setDescriptionError] = useState<string | null>(null);
    const [pendingDescriptions, setPendingDescriptions] = useState<PendingActivityDescription[] | null>(null);
    const [showAccommodationPanel, setShowAccommodationPanel] = useState(false);
    const [conflictsExpandedDate, setConflictsExpandedDate] = useState<string | null>(null);
    const latestDescriptionContextRef = useRef({
        currentDateStr: '',
        selectedTripId: null as string | null,
        scenarioId: null as string | null,
    });

    const selectedTrip = trips.find(t => t.id === selectedTripId);
    const { activeScenario } = useTripScenarios(selectedTripId);
    const effectiveTrip = activeScenario?.tripSnapshot ?? selectedTrip;
    const tripRoutes = useMemo(() => selectedTripId ? getRoutesByTrip(selectedTripId) : [], [selectedTripId, getRoutesByTrip]);
    const effectiveRoutes = activeScenario?.transportRoutesSnapshot ?? tripRoutes;
    const tripActivities = useMemo(
        () => selectedTripId ? activities.filter((activity) => activity.tripId === selectedTripId) : [],
        [selectedTripId, activities],
    );
    const effectiveActivities = activeScenario?.activitiesSnapshot ?? tripActivities;
    const currentDateStr = format(currentDate, 'yyyy-MM-dd');

    useEffect(() => {
        saveCalendarPrefs(viewMode, selectedTripId, format(currentDate, 'yyyy-MM-dd'));
    }, [viewMode, selectedTripId, currentDate]);

    useEffect(() => {
        if (!effectiveTrip) return;
        try {
            const tripStart = parseISO(effectiveTrip.startDate);
            const tripEnd = parseISO(effectiveTrip.endDate);
            if (currentDate < tripStart || currentDate > tripEnd) {
                setCurrentDate(tripStart);
            }
        } catch { /* ignore */ }
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
            const trip = trips.find(t => t.id === tripId);
            if (trip) {
                try {
                    setCurrentDate(parseISO(trip.startDate));
                } catch { /* ignore */ }
            }
        }
    };

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
    }, [currentDate, viewMode, selectedTrip]);

    const getActivitiesForDate = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return effectiveActivities.filter(a => a.date === dateStr);
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

    const handleReorderActivities = useCallback((reordered: import('../lib/types').Activity[]) => {
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
    }, [activeScenario, reorderActivities, selectedTripId]);

    const getActivityColor = (activity: { category?: string; color?: string }) =>
        activity.color ?? CATEGORY_COLORS[activity.category ?? 'other'];

    const dayViewActivities = effectiveActivities
        .filter(a => a.date === currentDateStr)
        .sort((a, b) => a.order - b.order);

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

    const handleSaveActivity = (
        activityData: Omit<import('../lib/types').Activity, 'id' | 'userId' | 'tripMembers'> | ({ id: string } & Partial<Omit<import('../lib/types').Activity, 'userId'>>),
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
                    ...(activityData as Omit<import('../lib/types').Activity, 'id'>),
                    tripId: selectedTripId,
                    date: targetDate,
                    order: ('order' in activityData ? activityData.order : orderFallback) ?? orderFallback,
                    title: ('title' in activityData ? activityData.title : '') || 'Activity',
                    userId: selectedTrip?.userId || 'scenario-user',
                    tripMembers: selectedTrip?.members || [],
                });
                upsertScenarioActivity(selectedTripId, activeScenario.id, scenarioActivity);
            } else {
                addActivity({
                    ...activityData,
                    tripId: selectedTripId,
                    date: targetDate,
                    order: ('order' in activityData ? activityData.order : orderFallback) ?? orderFallback,
                    title: ('title' in activityData ? activityData.title : '') || 'Activity',
                } as Omit<import('../lib/types').Activity, 'id' | 'userId' | 'tripMembers'>, selectedTrip?.members || []);
            }
        }
        setAddingActivityForDate(null);
        setEditingActivityId(null);
    };

    const handleGenerateRecommendations = async () => {
        if (!selectedTrip || dayViewActivities.length === 0) return;
        setRecommendationsLoading(true);
        setRecommendationsError(null);
        setNearbyRecommendations(null);

        logEvent('Nearby Recommendations Requested', { trip_name: selectedTrip.name, activity_count: dayViewActivities.length, date: currentDateStr });
        try {
            const parsed = await generateNearbyRecommendations({
                trip: effectiveTrip ?? selectedTrip,
                currentDateStr,
                activities: dayViewActivities,
            });
            if (!Array.isArray(parsed.recommendations)) throw new Error('Invalid response format');
            setNearbyRecommendations(parsed.recommendations);
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Recommendations generation failed';
            setRecommendationsError(/429|quota|rate/i.test(msg) ? 'API rate limit reached — please wait a minute and try again.' : msg);
        } finally {
            setRecommendationsLoading(false);
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
            if (!parsed.recommendation || !Array.isArray(parsed.optimizedOrder) || parsed.optimizedOrder.length !== dayViewActivities.length) {
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

    return (
        <div className="page-container animate-fade-in">
            <header className="page-header">
                <div>
                    <h1>Calendar</h1>
                    <p>Visualize your travel plans at a glance.</p>
                </div>
            </header>

            {/* Controls */}
            <div className={styles['calendar-controls']}>
                <div className={styles['view-tabs']}>
                    {(['trip', 'day'] as ViewMode[]).map(mode => (
                        <button
                            key={mode}
                            className={`${styles['view-tab']} ${viewMode === mode ? styles['active'] : ''}`}
                            onClick={() => { setViewMode(mode); logEvent('Calendar View Changed', { view_mode: mode }); }}
                        >
                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </button>
                    ))}
                </div>

                <select
                    className={`input-field ${styles['trip-select']}`}
                    value={selectedTripId || ''}
                    onChange={e => handleSelectTrip(e.target.value || null)}
                >
                    <option value="">Select a trip...</option>
                    {trips.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>

                {selectedTrip && calendarDays.length > 0 && (
                    <div className={styles['day-nav-wrapper']}>
                        {tripDays.length > 0 && (<>
                            <div className={styles['day-pills']}>
                                {tripDays.map((day, idx) => (
                                    (() => {
                                        const dateStr = format(day, 'yyyy-MM-dd');
                                        const count = conflictCountsByDate[dateStr] || 0;
                                        return (
                                            <button
                                                key={idx}
                                                className={`${styles['day-pill']} ${isSameDay(day, currentDate) ? styles['active'] : ''} ${isSameDay(day, new Date()) ? styles['today'] : ''}`}
                                                onClick={() => {
                                                    setCurrentDate(day);
                                                    if (count > 0) {
                                                        setConflictsExpandedDate(prev => prev === dateStr ? null : dateStr);
                                                    } else {
                                                        setConflictsExpandedDate(null);
                                                    }
                                                }}
                                                title={format(day, 'EEEE, MMM d')}
                                            >
                                                <span className={styles['day-pill-num']}>{format(day, 'd')}</span>
                                                <span className={styles['day-pill-dow']}>{format(day, 'EEE')}</span>
                                                {appSettings.showPlanningChecks && count > 0 && <span className={styles['issue-badge']}>{count}</span>}
                                            </button>
                                        );
                                    })()
                                ))}
                            </div>
                            {appSettings.showPlanningChecks && conflictsExpandedDate && (() => {
                                const expanded = planningConflicts.filter(c => c.date === conflictsExpandedDate);
                                if (expanded.length === 0) return null;
                                return (
                                    <div className={styles['inline-conflicts']}>
                                        {expanded.map(c => (
                                            <div key={c.id} className={styles['inline-conflict-item']}>
                                                <span className={`${styles['inline-conflict-icon']} ${c.severity === 'info' ? styles['info'] : ''}`}>
                                                    {c.severity === 'warning' ? <AlertTriangle size={13} /> : <Info size={13} />}
                                                </span>
                                                <span><span className={styles['inline-conflict-title']}>{c.title}</span>{c.message}</span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </>)}
                    </div>
                )}
            </div>

            {/* Trip Grid View */}
            {viewMode === 'trip' && (
                <div className={`${styles['calendar-grid']} ${styles.trip}`}>
                    <div className={`${styles['days-grid']} ${styles.trip}`}>
                        {tripDays.map((day, idx) => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const dayActs = getActivitiesForDate(day);
                            const isToday = isSameDay(day, new Date());
                            const dayData = effectiveTrip?.itinerary?.[dateStr];
                            const dayLocation = dayData?.location || effectiveTrip?.dayLocations?.[dateStr];

                            return (
                                <div
                                    key={idx}
                                    className={`${styles['calendar-day']} ${isToday ? styles['today'] : ''}`}
                                    onClick={() => { setCurrentDate(day); setViewMode('day'); logEvent('Calendar View Changed', { view_mode: 'day', source: 'trip_card_click' }); }}
                                >
                                    <div className={styles['trip-card-header']}>
                                        <span className={styles['cal-day-number']}>{format(day, 'd')}</span>
                                        <div className={styles['cal-day-info']}>
                                            <span className={styles['cal-day-label']}>{format(day, 'EEE')}</span>
                                            {dayLocation && <span className={styles['cal-day-location']}>📍 {dayLocation}</span>}
                                            {appSettings.showPlanningChecks && (conflictCountsByDate[dateStr] || 0) > 0 && (
                                                <span className={styles['issue-badge-inline']}>{conflictCountsByDate[dateStr]}</span>
                                            )}
                                        </div>
                                    </div>
                                    {appSettings.showAccommodationOnTripCards && (dayData?.accommodation ? (
                                        <div className={styles['cal-day-accommodation']} title={`${dayData.accommodation.name}${dayData.accommodation.checkInTime ? ` • Check-in: ${dayData.accommodation.checkInTime}` : ''}`}>
                                            <span className={styles['cal-acc-icon']}>🏠</span>
                                            <span className={styles['cal-acc-name']}>{dayData.accommodation.name}</span>
                                            {dayData.accommodation.checkInTime && <span className={styles['cal-acc-time']}>{dayData.accommodation.checkInTime}</span>}
                                        </div>
                                    ) : (
                                        <div className={`${styles['cal-day-accommodation']} ${styles['empty']}`}>
                                            <span className={styles['cal-acc-icon']}>🏠</span>
                                            <span className={styles['cal-acc-name']}>Add stay...</span>
                                        </div>
                                    ))}
                                    {dayActs.length > 0 ? (
                                        <div className={styles['cal-day-activities']}>
                                            {dayActs.map(act => (
                                                <div key={act.id} className={styles['cal-activity-chip']} style={{ borderLeftColor: getActivityColor(act) }}>
                                                    <span>{CATEGORY_EMOJIS[act.category || 'other']}</span>
                                                    <span className={styles['cal-activity-title']}>{act.title}</span>
                                                    {act.time && <span className={styles['cal-activity-time']}>{act.time}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className={styles['trip-card-empty']}>No activities</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Day Detail View */}
            {viewMode === 'day' && (
                <div className={styles['day-detail-view']}>
                    {selectedTrip && (
                        <>
                            <ScenarioSwitcher trip={selectedTrip} activities={effectiveActivities} routes={effectiveRoutes} />
                            {selectedTripId && addingActivityForDate !== currentDateStr && (
                                <button
                                    type="button"
                                    className={`${styles['action-btn']} ${styles['action-btn-sky']} ${styles['add-activity-top']}`}
                                    onClick={() => setAddingActivityForDate(currentDateStr)}
                                >
                                    <Plus size={18} /> Add activity
                                </button>
                            )}
                        </>
                    )}
                    <div className={styles['planning-action-row']}>
                        <button
                            type="button"
                            className={`${styles['action-btn']} ${styles['action-btn-sky']} ${styles['planner-action-btn']} ${!showAccommodationPanel ? styles['planner-toggle-inactive'] : ''}`}
                            onClick={() => setShowAccommodationPanel((prev) => !prev)}
                        >
                            <span className={styles['action-btn-icon']}>🏠</span>
                            Accommodation
                        </button>
                        <button
                            type="button"
                            className={`${styles['action-btn']} ${styles['action-btn-violet']}`}
                            onClick={handleGenerateDescriptions}
                            disabled={descriptionLoading || dayViewActivities.length === 0}
                        >
                            <span className={styles['action-btn-icon']}>✨</span>
                            {descriptionLoading ? <><Loader2 size={14} className="spin" /> Describing…</> : 'Describe Day'}
                        </button>
                        <button
                            type="button"
                            className={`${styles['action-btn']} ${styles['action-btn-amber']}`}
                            onClick={handleGenerateRecommendations}
                            disabled={recommendationsLoading || dayViewActivities.length === 0}
                        >
                            <span className={styles['action-btn-icon']}>📍</span>
                            {recommendationsLoading ? <><Loader2 size={14} className="spin" /> Generating…</> : 'Nearby Recommendations'}
                        </button>
                        <button
                            type="button"
                            className={`${styles['action-btn']} ${styles['action-btn-mint']}`}
                            onClick={handleOptimizeRoute}
                            disabled={optimizationLoading || dayViewActivities.length <= 1}
                        >
                            <span className={styles['action-btn-icon']}>🗺️</span>
                            {optimizationLoading ? <><Loader2 size={14} className="spin" /> Optimizing…</> : 'Optimize Route'}
                        </button>
                    </div>

                    {showAccommodationPanel && (
                        <div className={`${styles['day-accommodation-card']} card`}>
                            <div className={styles['acc-card-header']}>
                                <div className={styles['acc-card-icon']}>🏠</div>
                                <div className={styles['acc-card-info']}>
                                    <label className={styles['acc-label']}>Accommodation</label>
                                    <input
                                        type="text"
                                        className={`${styles['acc-name-input']} ${styles['input-transparent']}`}
                                        placeholder="Add accommodation..."
                                        defaultValue={effectiveTrip?.itinerary?.[currentDateStr]?.accommodation?.name ?? ''}
                                        key={`acc-name-${selectedTripId}-${activeScenario?.id ?? 'live'}-${currentDateStr}`}
                                        onBlur={e => {
                                            const val = e.target.value.trim();
                                            const current = effectiveTrip?.itinerary?.[currentDateStr]?.accommodation;
                                            if (val !== (current?.name ?? '')) {
                                                if (selectedTripId && activeScenario) {
                                                    updateScenarioTripSnapshot(selectedTripId, activeScenario.id, (trip) => ({
                                                        ...trip,
                                                        itinerary: {
                                                            ...(trip.itinerary || {}),
                                                            [currentDateStr]: {
                                                                ...(trip.itinerary?.[currentDateStr] || {}),
                                                                accommodation: { ...current, name: val },
                                                            },
                                                        },
                                                    }));
                                                } else {
                                                    updateItineraryDay(selectedTripId!, currentDateStr, {
                                                        accommodation: { ...current, name: val }
                                                    });
                                                }
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                            <div className={styles['acc-card-meta']}>
                                <div className={styles['acc-meta-item']}>
                                    <span className={styles['acc-meta-label']}>Check-In</span>
                                    <input
                                        type="time"
                                        className={`${styles['acc-time-input']} ${styles['input-transparent']}`}
                                        defaultValue={effectiveTrip?.itinerary?.[currentDateStr]?.accommodation?.checkInTime ?? ''}
                                        key={`acc-time-${selectedTripId}-${activeScenario?.id ?? 'live'}-${currentDateStr}`}
                                        onBlur={e => {
                                            const val = e.target.value;
                                            const current = effectiveTrip?.itinerary?.[currentDateStr]?.accommodation;
                                            if (val !== (current?.checkInTime ?? '')) {
                                                if (selectedTripId && activeScenario) {
                                                    updateScenarioTripSnapshot(selectedTripId, activeScenario.id, (trip) => ({
                                                        ...trip,
                                                        itinerary: {
                                                            ...(trip.itinerary || {}),
                                                            [currentDateStr]: {
                                                                ...(trip.itinerary?.[currentDateStr] || {}),
                                                                accommodation: { ...current, name: current?.name || '', checkInTime: val },
                                                            },
                                                        },
                                                    }));
                                                } else {
                                                    updateItineraryDay(selectedTripId!, currentDateStr, {
                                                        accommodation: { ...current, name: current?.name || '', checkInTime: val }
                                                    });
                                                }
                                            }
                                        }}
                                    />
                                </div>
                                <div className={styles['acc-meta-item']}>
                                    <span className={styles['acc-meta-label']}>Cost ({selectedTrip?.defaultCurrency || '$'})</span>
                                    <input
                                        type="number"
                                        className={`${styles['acc-cost-input']} ${styles['input-transparent']}`}
                                        placeholder="0"
                                        defaultValue={effectiveTrip?.itinerary?.[currentDateStr]?.accommodation?.cost ?? ''}
                                        key={`acc-cost-${selectedTripId}-${activeScenario?.id ?? 'live'}-${currentDateStr}`}
                                        onBlur={e => {
                                            const val = parseFloat(e.target.value);
                                            const current = effectiveTrip?.itinerary?.[currentDateStr]?.accommodation;
                                            if (val !== (current?.cost ?? 0)) {
                                                const nextAccommodation = {
                                                    ...current,
                                                    name: current?.name || '',
                                                    cost: isNaN(val) ? undefined : val,
                                                    currency: current?.currency || effectiveTrip?.defaultCurrency || 'USD'
                                                };
                                                if (selectedTripId && activeScenario) {
                                                    updateScenarioTripSnapshot(selectedTripId, activeScenario.id, (trip) => ({
                                                        ...trip,
                                                        itinerary: {
                                                            ...(trip.itinerary || {}),
                                                            [currentDateStr]: {
                                                                ...(trip.itinerary?.[currentDateStr] || {}),
                                                                accommodation: nextAccommodation,
                                                            },
                                                        },
                                                    }));
                                                } else {
                                                    updateItineraryDay(selectedTripId!, currentDateStr, {
                                                        accommodation: nextAccommodation
                                                    });
                                                }
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    {selectedTripId && dayViewActivities.length > 0 && (
                        <div className={styles['day-summary-section']}>
                            {descriptionError && <p className="text-red-500 text-sm mt-2">{descriptionError}</p>}
                            {recommendationsError && <p className="text-red-500 text-sm mt-2">{recommendationsError}</p>}
                            {optimizationError && <p className="text-red-500 text-sm mt-2">{optimizationError}</p>}

                            {pendingDescriptions && (
                                <div className={`${styles['description-suggestion-card']} card`}>
                                    <div className={styles['description-suggestion-header']}>
                                        <div>
                                            <h4 className={styles['trip-summary-header']}>Suggested Activity Descriptions</h4>
                                            <p className={styles['trip-summary-text']}>
                                                Gemini drafted every activity in one request with a short description plus local tips and recommendations.
                                            </p>
                                        </div>
                                        <div className={styles['description-suggestion-actions']}>
                                            <button type="button" className="btn btn-primary btn-sm" onClick={() => void handleAcceptAllDescriptions()}>
                                                Accept all
                                            </button>
                                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPendingDescriptions(null)}>
                                                Dismiss all
                                            </button>
                                        </div>
                                    </div>

                                    <div className={styles['description-suggestion-list']}>
                                        {pendingDescriptions.map((item) => (
                                            <div key={item.activityId} className={styles['description-suggestion-item']}>
                                                <div className={styles['description-suggestion-copy']}>
                                                    <p className={styles['description-suggestion-title']}>{item.title}</p>
                                                    <p className={styles['description-suggestion-summary']}>{item.summary}</p>
                                                    <ul className={styles['description-suggestion-tips']}>
                                                        {item.tips.map((tip, index) => (
                                                            <li key={`${item.activityId}-${index}`}>{tip}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <div className={styles['description-suggestion-actions']}>
                                                    <button
                                                        type="button"
                                                        className="btn btn-primary btn-sm"
                                                        onClick={() => void applyPendingDescription(item.activityId, item.summary, item.tips)}
                                                    >
                                                        Accept
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => dismissPendingDescription(item.activityId)}
                                                    >
                                                        Decline
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {nearbyRecommendations && nearbyRecommendations.length > 0 && (
                                <div className="trip-summary-card card" style={{ padding: '1rem', marginTop: '0.75rem' }}>
                                    <h4 className={styles['trip-summary-header']}>Nearby Recommendations</h4>
                                    <p className={styles['trip-summary-text']}>Weighted by your preferences: UNESCO sites, craft workshops, shopping streets; deprioritizing crowded areas.</p>
                                    <ul className={styles['trip-summary-highlights']} style={{ listStyle: 'none', paddingLeft: 0 }}>
                                        {nearbyRecommendations.map((rec, i) => (
                                            <li key={i} style={{ marginBottom: '0.5rem' }}>
                                                <strong>{rec.name}</strong> <span style={{ opacity: 0.8 }}>({rec.location})</span> · weight {rec.weight.toFixed(1)}
                                                {rec.crowded && <span style={{ color: 'var(--muted)' }}> · crowded</span>}
                                                <br /><span style={{ fontSize: '0.9em' }}>{rec.reason}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: '0.5rem' }} onClick={() => setNearbyRecommendations(null)}>Dismiss</button>
                                </div>
                            )}

                            {optimizedRoute && (
                                <div className="trip-summary-card card" style={{ padding: '1rem', marginTop: '0.75rem', borderLeft: '3px solid var(--primary-color)' }}>
                                    <h4 className={styles['trip-summary-header']}>AI Route Suggestion</h4>
                                    <p className={styles['trip-summary-text']}>{optimizedRoute.recommendation}</p>
                                    <ul className={styles['trip-summary-highlights']} style={{ marginTop: '0.5rem' }}>
                                        {optimizedRoute.optimizedOrder.map(id => {
                                            const act = activities.find(a => a.id === id);
                                            return act ? <li key={id}>{act.title} {act.time ? `(${act.time})` : ''}</li> : null;
                                        })}
                                    </ul>
                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                        <button
                                            type="button"
                                            className="btn btn-primary btn-sm"
                                            onClick={() => {
                                                const reorderedActivities = optimizedRoute.optimizedOrder
                                                    .map((id) => dayViewActivities.find((activity) => activity.id === id))
                                                    .filter((activity): activity is typeof dayViewActivities[number] => Boolean(activity));
                                                if (selectedTripId && activeScenario) {
                                                    reorderScenarioActivities(selectedTripId, activeScenario.id, reorderedActivities);
                                                } else {
                                                    const updates = optimizedRoute.optimizedOrder.map((id, idx) => ({ id, order: idx }));
                                                    reorderActivities(updates);
                                                }
                                                setOptimizedRoute(null);
                                                logEvent('Route Optimized List Applied');
                                            }}
                                        >
                                            Apply Order
                                        </button>
                                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOptimizedRoute(null)}>Dismiss</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {selectedTripId && (
                        addingActivityForDate === currentDateStr && (
                            <ActivityForm
                                tripId={selectedTripId}
                                date={currentDateStr}
                                nextOrder={dayViewActivities.length}
                                defaultCurrency={selectedTrip?.defaultCurrency}
                                onSave={(data) => handleSaveActivity(data, currentDateStr)}
                                onCancel={() => setAddingActivityForDate(null)}
                            />
                        )
                    )}
                    {dayViewActivities.length === 0 && !addingActivityForDate && (
                        <p className={styles['no-activities-cal']}>No activities planned for this day.</p>
                    )}
                    <DraggableList
                        items={dayViewActivities}
                        keyFn={a => a.id}
                        onReorder={handleReorderActivities}
                        disabled={editingActivityId !== null}
                        renderItem={(act, _idx, dragHandleProps) =>
                            editingActivityId === act.id ? (
                                <ActivityForm
                                    tripId={act.tripId}
                                    date={act.date}
                                    existingActivity={act}
                                    nextOrder={act.order}
                                    defaultCurrency={effectiveTrip?.defaultCurrency}
                                    onSave={handleSaveActivity}
                                    onCancel={() => setEditingActivityId(null)}
                                    onDelete={() => {
                                        if (selectedTripId && activeScenario) {
                                            removeScenarioActivity(selectedTripId, activeScenario.id, act.id);
                                        } else {
                                            deleteActivity(act.id);
                                        }
                                        setEditingActivityId(null);
                                        logEvent('Activity Deleted', { activity_title: act.title, category: act.category, source: 'calendar_day' });
                                        if (!activeScenario) {
                                            showToast(`"${act.title}" deleted`, () => {
                                                restoreActivity(act);
                                                logEvent('Activity Delete Undone', { activity_title: act.title });
                                            });
                                        }
                                    }}
                                />
                            ) : (
                                <div className={`${styles['day-detail-activity']} card`} style={{ borderLeftColor: getActivityColor(act) }}>
                                    <div className={styles['detail-header']}>
                                        <span className="drag-handle" {...dragHandleProps}>
                                            <GripVertical size={16} />
                                        </span>
                                        <span className={styles['detail-emoji']}>{CATEGORY_EMOJIS[act.category || 'other']}</span>
                                        <div>
                                            <h4>{act.title}</h4>
                                            {act.time && <span className={styles['detail-time']}>{act.time}</span>}
                                        </div>
                                        <div className={styles['detail-actions']}>
                                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingActivityId(act.id)} aria-label="Edit"><Pencil size={16} /></button>
                                        </div>
                                    </div>
                                    {act.details && <Markdown className={styles['detail-desc']}>{act.details}</Markdown>}
                                    {act.location && <p className={styles['detail-location']}>📍 {act.location}</p>}
                                    {act.cost != null && <p className={styles['detail-cost']}>💰 {act.currency || '$'}{act.cost.toFixed(2)}</p>}
                                    {act.notes && <Markdown className={styles['detail-notes']}>{act.notes}</Markdown>}
                                </div>
                            )
                        }
                    />
                </div>
            )}

            {selectedTrip && viewMode === 'trip' && (
                <ScenarioSwitcher trip={selectedTrip} activities={effectiveActivities} routes={effectiveRoutes} />
            )}
        </div>
    );
};

export default CalendarView;
