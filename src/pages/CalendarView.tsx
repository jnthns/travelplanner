import React, { useState, useMemo, useEffect } from 'react';
import {
    format,
    eachDayOfInterval,
    isSameDay,
    parseISO,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Pencil, GripVertical, Loader2 } from 'lucide-react';
import { generateWithGemini } from '../lib/gemini';
import { useTrips, useActivities } from '../lib/store';
import { CATEGORY_EMOJIS, CATEGORY_COLORS } from '../lib/types';
import type { Activity } from '../lib/types';
import ActivityForm from '../components/ActivityForm';
import DraggableList from '../components/DraggableList';
import Markdown from '../components/Markdown';
import SwipeableItem from '../components/SwipeableItem';
import { useToast } from '../components/Toast';
import { logEvent } from '../lib/amplitude';
import styles from './CalendarView.module.css';

const CALENDAR_VIEW_KEY = 'travelplanner_calendar_view';

type ViewMode = 'day' | 'trip';

interface CalendarPrefs {
    viewMode: ViewMode;
    selectedTripId: string | null;
    currentDateStr: string | null;
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
    const { trips } = useTrips();
    const { activities, addActivity, updateActivity, deleteActivity, restoreActivity, reorderActivities } = useActivities();
    const { showToast } = useToast();

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
    const [tripSummary, setTripSummary] = useState<{ summary: string; highlights: string[] } | null>(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [summaryError, setSummaryError] = useState<string | null>(null);
    const [optimizationLoading, setOptimizationLoading] = useState(false);
    const [optimizationError, setOptimizationError] = useState<string | null>(null);
    const [optimizedRoute, setOptimizedRoute] = useState<{ recommendation: string; optimizedOrder: string[] } | null>(null);

    const selectedTrip = trips.find(t => t.id === selectedTripId);

    useEffect(() => {
        saveCalendarPrefs(viewMode, selectedTripId, format(currentDate, 'yyyy-MM-dd'));
    }, [viewMode, selectedTripId, currentDate]);

    useEffect(() => {
        if (!selectedTrip) return;
        try {
            const tripStart = parseISO(selectedTrip.startDate);
            const tripEnd = parseISO(selectedTrip.endDate);
            if (currentDate < tripStart || currentDate > tripEnd) {
                setCurrentDate(tripStart);
            }
        } catch { /* ignore */ }
    }, [selectedTrip?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
                    start: parseISO(selectedTrip.startDate),
                    end: parseISO(selectedTrip.endDate),
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
        return activities.filter(a => a.date === dateStr);
    };

    const navigate = (direction: number) => {
        if (viewMode === 'day') {
            setCurrentDate(new Date(currentDate.getTime() + direction * 24 * 60 * 60 * 1000));
        }
    };

    const tripDays = useMemo(() => {
        if (!selectedTrip) return [];
        try {
            return eachDayOfInterval({
                start: parseISO(selectedTrip.startDate),
                end: parseISO(selectedTrip.endDate),
            });
        } catch {
            return [];
        }
    }, [selectedTrip]);

    const handleReorderActivities = (reordered: import('../lib/types').Activity[]) => {
        const updates = reordered
            .map((act, idx) => ({ id: act.id, order: idx }))
            .filter((u, idx) => reordered[idx].order !== u.order);
        if (updates.length > 0) {
            reorderActivities(updates);
            logEvent('Activities Reordered', { count: updates.length, source: 'calendar_day' });
        }
    };

    const getActivityColor = (activity: { category?: string; color?: string }) =>
        activity.color ?? CATEGORY_COLORS[activity.category ?? 'other'];

    const tripActivities = useMemo(() => {
        if (!selectedTripId) return [];
        return activities.filter(a => a.tripId === selectedTripId);
    }, [selectedTripId, activities]);

    const accommodationsByDate = useMemo(() => {
        if (!selectedTrip || !tripActivities.length) return {};
        const activeLodging: Record<string, Activity> = {};

        tripActivities.forEach(a => {
            if (a.category === 'lodging') {
                activeLodging[a.date] = a;
            }
        });

        return activeLodging;
    }, [tripActivities, selectedTrip]);

    const currentDateStr = format(currentDate, 'yyyy-MM-dd');
    const dayViewActivities = activities
        .filter(a => a.date === currentDateStr && a.category !== 'lodging' && a.tripId === selectedTripId)
        .sort((a, b) => a.order - b.order);

    const handleSaveActivity = (
        activityData: Omit<import('../lib/types').Activity, 'id' | 'userId' | 'tripMembers'> | ({ id: string } & Partial<Omit<import('../lib/types').Activity, 'userId'>>),
        forDate?: string,
    ) => {
        const targetDate = forDate ?? currentDateStr;
        if ('id' in activityData && activityData.id) {
            updateActivity(activityData.id, activityData);
        } else if (selectedTripId && targetDate) {
            const orderFallback = dayViewActivities.length;
            addActivity({
                ...activityData,
                tripId: selectedTripId,
                date: targetDate,
                order: ('order' in activityData ? activityData.order : orderFallback) ?? orderFallback,
                title: ('title' in activityData ? activityData.title : '') || 'Activity',
            } as Omit<import('../lib/types').Activity, 'id' | 'userId' | 'tripMembers'>, selectedTrip?.members || []);
        }
        setAddingActivityForDate(null);
        setEditingActivityId(null);
    };

    const tripActivitiesForSummary = useMemo(() => {
        if (!selectedTripId) return [];
        return activities.filter(a => a.tripId === selectedTripId);
    }, [selectedTripId, activities]);

    const handleGenerateSummary = async () => {
        if (!selectedTrip || tripActivitiesForSummary.length === 0) return;
        setSummaryLoading(true);
        setSummaryError(null);
        setTripSummary(null);

        const itinerary = tripDays.map((day, idx) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayActs = tripActivitiesForSummary
                .filter(a => a.date === dateStr)
                .sort((a, b) => a.order - b.order)
                .map(a => `${a.time || 'TBD'} - ${a.title}${a.location ? ` (${a.location})` : ''}`)
                .join('; ');
            return `Day ${idx + 1} (${format(day, 'EEE, MMM d')}): ${dayActs || 'No activities'}`;
        }).join('\n');

        const prompt = `Here is the itinerary for a given day of a trip to "${selectedTrip.name}":

${itinerary}

Respond with a JSON object matching this exact schema:
{
  "summary": "A 2-3 sentence overview covering route optimization, expected travel/wait times between activities, and suggested improvements to the day's plan. 80 words max.",
  "highlights": [
    "First highlight: an attraction, culinary, cultural, or historical point along the route",
    "Second highlight: a seasonal or current event for the given day, or a hidden gem near the itinerary",
    "Third highlight: a practical tip about timing, crowds, or money-saving for this route"
  ]
}

Be specific to the actual destinations and activities. Each highlight should be one concise sentence. Do not include activities already in the itinerary in the highlights.`;

        logEvent('Trip Summary Requested', { trip_name: selectedTrip.name, activity_count: tripActivitiesForSummary.length });
        try {
            const raw = await generateWithGemini(prompt, {
                responseMimeType: 'application/json'
            });
            const parsed = JSON.parse(raw) as { summary: string; highlights: string[] };
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

        const currentDayActs = dayViewActivities
            .map(a => `ID: ${a.id} | Title: ${a.title} | Time: ${a.time || 'flexible'} | Location: ${a.location || 'none'} | Details: ${a.details || 'none'}`)
            .join('\n');

        const prompt = `Here are the activities planned for ${format(currentDate, 'yyyy-MM-dd')} on a trip to "${selectedTrip.name}":

${currentDayActs}

Respond with a JSON object matching this exact schema:
{
  "recommendation": "A 2-3 sentence explanation of why this new order is better (e.g. groups nearby locations, fixes awkward timing).",
  "optimizedOrder": ["ID_1", "ID_2", "..."] // An array containing the exact IDs of all provided activities, but reordered for the most optimal route.
}

Ensure all provided activity IDs are included in the optimizedOrder array.`;

        logEvent('Route Optimization Requested', { date: currentDateStr, activity_count: dayViewActivities.length });
        try {
            const raw = await generateWithGemini(prompt, {
                responseMimeType: 'application/json',
                systemInstruction: "You are an expert travel logistician. Your goal is to minimize transit time and provide smooth chronological schedules."
            });
            const parsed = JSON.parse(raw) as { recommendation: string; optimizedOrder: string[] };
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
                        <div className={styles['nav-controls-modern']}>
                            <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
                                <ChevronLeft size={18} />
                            </button>
                            <span className={styles['current-label']}>
                                {format(currentDate, 'EEEE, MMM d, yyyy')}
                                {selectedTrip.dayLocations?.[currentDateStr] && (
                                    <span className={styles['current-label-location']}>📍 {selectedTrip.dayLocations[currentDateStr]}</span>
                                )}
                            </span>
                            <button className="btn btn-ghost btn-sm" onClick={() => navigate(1)}>
                                <ChevronRight size={18} />
                            </button>
                        </div>
                        {tripDays.length > 0 && (
                            <div className={styles['day-pills']}>
                                {tripDays.map((day, idx) => (
                                    <button
                                        key={idx}
                                        className={`${styles['day-pill']} ${isSameDay(day, currentDate) ? styles['active'] : ''} ${isSameDay(day, new Date()) ? styles['today'] : ''}`}
                                        onClick={() => setCurrentDate(day)}
                                        title={format(day, 'EEEE, MMM d')}
                                    >
                                        <span className={styles['day-pill-num']}>{format(day, 'd')}</span>
                                        <span className={styles['day-pill-dow']}>{format(day, 'EEE')}</span>
                                    </button>
                                ))}
                            </div>
                        )}
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
                            const dayLocation = selectedTrip?.dayLocations?.[dateStr];

                            return (
                                <div
                                    key={idx}
                                    className={`calendar-day trip-card ${isToday ? 'today' : ''}`}
                                    onClick={() => { setCurrentDate(day); setViewMode('day'); logEvent('Calendar View Changed', { view_mode: 'day', source: 'trip_card_click' }); }}
                                >
                                    <div className={styles['trip-card-header']}>
                                        <div className={styles['trip-card-header-date-row']}>
                                            <span className={styles['cal-day-number']}>{format(day, 'd')}</span>
                                            <span className={styles['cal-day-label']}>{format(day, 'EEE')}</span>
                                        </div>
                                        {dayLocation && <span className={styles['cal-day-location']}>📍 {dayLocation}</span>}
                                    </div>
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
                    {selectedTripId && (
                        <div className={styles['pinned-accommodation']}>
                            <h4 className={styles['pinned-accommodation-title']}>🏨 Lodging</h4>
                            {accommodationsByDate[currentDateStr] ? (
                                <div
                                    className={`${styles['day-detail-activity']} card`}
                                    style={{ borderLeftColor: accommodationsByDate[currentDateStr]?.color ?? CATEGORY_COLORS['lodging'] }}
                                    onClick={() => setEditingActivityId(accommodationsByDate[currentDateStr]!.id)}
                                >
                                    <div className={styles['detail-header']}>
                                        <span className={styles['detail-emoji']}>{CATEGORY_EMOJIS['lodging']}</span>
                                        <div>
                                            <h4>{accommodationsByDate[currentDateStr]?.title}</h4>
                                        </div>
                                        <div className={styles['detail-actions']}>
                                            <button type="button" className="btn btn-ghost btn-sm" aria-label="Edit"><Pencil size={16} /></button>
                                        </div>
                                    </div>
                                    {accommodationsByDate[currentDateStr]?.location && <p className={styles['detail-location']}>📍 {accommodationsByDate[currentDateStr]?.location}</p>}
                                </div>
                            ) : (
                                <div
                                    className={`${styles['day-detail-activity']} card ${styles['empty-placeholder']}`}
                                    onClick={() => setAddingActivityForDate('lodging')}
                                    style={{ cursor: 'pointer', borderLeftColor: 'var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
                                >
                                    <span className="text-subtle italic">No lodging set for this date (tap to add)</span>
                                </div>
                            )}
                        </div>
                    )}
                    {selectedTripId && tripActivitiesForSummary.length > 0 && (
                        <div className={styles['day-summary-section']}>
                            <div className="ai-buttons-row" style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    type="button"
                                    className="btn btn-sm ai-suggest-btn"
                                    onClick={handleGenerateSummary}
                                    disabled={summaryLoading}
                                >
                                    {summaryLoading ? <><Loader2 size={14} className="spin" /> Generating…</> : 'AI Trip Summary'}
                                </button>
                                {dayViewActivities.length > 1 && (
                                    <button
                                        type="button"
                                        className="btn btn-sm ai-suggest-btn"
                                        onClick={handleOptimizeRoute}
                                        disabled={optimizationLoading}
                                    >
                                        {optimizationLoading ? <><Loader2 size={14} className="spin" /> Optimizing…</> : 'Optimize Route'}
                                    </button>
                                )}
                            </div>
                            {summaryError && <p className="text-red-500 text-sm mt-2">{summaryError}</p>}
                            {optimizationError && <p className="text-red-500 text-sm mt-2">{optimizationError}</p>}

                            {tripSummary && (
                                <div className="trip-summary-card card" style={{ padding: '1rem', marginTop: '0.75rem' }}>
                                    <h4 className={styles['trip-summary-header']}>AI Trip Summary</h4>
                                    <p className={styles['trip-summary-text']}>{tripSummary.summary}</p>
                                    {tripSummary.highlights.length > 0 && (
                                        <ul className={styles['trip-summary-highlights']}>
                                            {tripSummary.highlights.map((h, i) => <li key={i}>{h}</li>)}
                                        </ul>
                                    )}
                                    <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: '0.5rem' }} onClick={() => setTripSummary(null)}>Dismiss</button>
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
                                                const updates = optimizedRoute.optimizedOrder.map((id, idx) => ({ id, order: idx }));
                                                reorderActivities(updates);
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
                        addingActivityForDate ? (
                            <ActivityForm
                                tripId={selectedTripId}
                                date={currentDateStr}
                                isLodging={addingActivityForDate === 'lodging'}
                                nextOrder={dayViewActivities.length}
                                defaultCurrency={selectedTrip?.defaultCurrency}
                                onSave={(data) => handleSaveActivity(data, currentDateStr)}
                                onCancel={() => setAddingActivityForDate(null)}
                            />
                        ) : (
                            <button
                                type="button"
                                className={`btn btn-outline ${styles['add-activity-btn']}`}
                                onClick={() => setAddingActivityForDate(currentDateStr)}
                            >
                                <Plus size={16} /> Add activity
                            </button>
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
                                    isLodging={act.category === 'lodging'}
                                    nextOrder={act.order}
                                    defaultCurrency={selectedTrip?.defaultCurrency}
                                    onSave={handleSaveActivity}
                                    onCancel={() => setEditingActivityId(null)}
                                    onDelete={() => {
                                        deleteActivity(act.id);
                                        setEditingActivityId(null);
                                        logEvent('Activity Deleted', { activity_title: act.title, category: act.category, source: 'calendar_day' });
                                        showToast(`"${act.title}" deleted`, () => {
                                            restoreActivity(act);
                                            logEvent('Activity Delete Undone', { activity_title: act.title });
                                        });
                                    }}
                                />
                            ) : (
                                <SwipeableItem
                                    onSwipeRight={() => setEditingActivityId(act.id)}
                                    onSwipeLeft={() => {
                                        deleteActivity(act.id);
                                        logEvent('Activity Deleted', { activity_title: act.title, category: act.category, source: 'calendar_swipe' });
                                        showToast(`"${act.title}" deleted`, () => {
                                            restoreActivity(act);
                                            logEvent('Activity Delete Undone', { activity_title: act.title });
                                        });
                                    }}
                                >
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
                                </SwipeableItem>
                            )
                        }
                    />
                </div>
            )}

        </div>
    );
};

export default CalendarView;
