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
import ActivityForm from '../components/ActivityForm';
import DraggableList from '../components/DraggableList';
import Markdown from '../components/Markdown';
import { useToast } from '../components/Toast';
import { logEvent } from '../lib/amplitude';
import './CalendarView.css';

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
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [addingActivityForDate, setAddingActivityForDate] = useState<string | null>(null);
    const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
    const [tripSummary, setTripSummary] = useState<{ summary: string; highlights: string[] } | null>(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [summaryError, setSummaryError] = useState<string | null>(null);

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

    const dayDetails = selectedDate
        ? activities.filter(a => a.date === selectedDate).sort((a, b) => a.order - b.order)
        : [];

    const getActivityColor = (activity: { category?: string; color?: string }) =>
        activity.color ?? CATEGORY_COLORS[activity.category ?? 'other'];

    const currentDateStr = format(currentDate, 'yyyy-MM-dd');
    const dayViewActivities = activities
        .filter(a => a.date === currentDateStr)
        .sort((a, b) => a.order - b.order);

    const handleSaveActivity = (
        activityData: Omit<import('../lib/types').Activity, 'id'> | ({ id: string } & Partial<import('../lib/types').Activity>),
        forDate?: string,
    ) => {
        const targetDate = forDate ?? selectedDate;
        if ('id' in activityData && activityData.id) {
            updateActivity(activityData.id, activityData);
            logEvent('Activity Updated', { activity_title: activityData.title, category: activityData.category, source: 'calendar' });
        } else if (selectedTripId && targetDate) {
            const orderFallback = viewMode === 'day' ? dayViewActivities.length : dayDetails.length;
            addActivity({
                ...activityData,
                tripId: selectedTripId,
                date: targetDate,
                order: ('order' in activityData ? activityData.order : orderFallback) ?? orderFallback,
                title: ('title' in activityData ? activityData.title : '') || 'Activity',
            } as Omit<import('../lib/types').Activity, 'id'>);
            logEvent('Activity Created', { activity_title: activityData.title, category: activityData.category, date: targetDate, source: 'calendar' });
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

Respond with ONLY a JSON object (no markdown fences, no preamble) matching this exact schema:
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
            const raw = await generateWithGemini(prompt, 2048);
            const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
            let parsed: { summary: string; highlights: string[] };
            try {
                parsed = JSON.parse(cleaned);
            } catch {
                // Truncated JSON — attempt to salvage by closing open strings/arrays/objects
                const patched = cleaned
                    .replace(/,\s*$/, '')           // trailing comma
                    .replace(/"[^"]*$/, '"')         // close an unterminated string
                    + (cleaned.includes('[') && !cleaned.includes(']') ? ']' : '')
                    + (cleaned.includes('{') && !cleaned.includes('}') ? '}' : '');
                parsed = JSON.parse(patched);
            }
            if (!parsed.summary || !Array.isArray(parsed.highlights)) throw new Error('Invalid response format');
            setTripSummary(parsed);
        } catch (e) {
            setSummaryError(e instanceof Error ? e.message : 'Summary generation failed');
        } finally {
            setSummaryLoading(false);
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
            <div className="calendar-controls">
                <div className="view-tabs">
                    {(['trip', 'day'] as ViewMode[]).map(mode => (
                        <button
                            key={mode}
                            className={`view-tab ${viewMode === mode ? 'active' : ''}`}
                            onClick={() => { setViewMode(mode); logEvent('Calendar View Changed', { view_mode: mode }); }}
                        >
                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </button>
                    ))}
                </div>

                <select
                    className="input-field trip-select"
                    value={selectedTripId || ''}
                    onChange={e => handleSelectTrip(e.target.value || null)}
                >
                    <option value="">Select a trip...</option>
                    {trips.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>

                {viewMode === 'day' && (
                    <div className="day-nav-wrapper">
                        <div className="nav-controls">
                            <button className="btn btn-ghost" onClick={() => navigate(-1)}>
                                <ChevronLeft size={20} />
                            </button>
                            <span className="current-label">
                                {format(currentDate, 'EEEE, MMM d, yyyy')}
                            </span>
                            <button className="btn btn-ghost" onClick={() => navigate(1)}>
                                <ChevronRight size={20} />
                            </button>
                        </div>
                        {tripDays.length > 0 && (
                            <div className="day-pills">
                                {tripDays.map((day, idx) => (
                                    <button
                                        key={idx}
                                        className={`day-pill ${isSameDay(day, currentDate) ? 'active' : ''} ${isSameDay(day, new Date()) ? 'today' : ''}`}
                                        onClick={() => setCurrentDate(day)}
                                        title={format(day, 'EEEE, MMM d')}
                                    >
                                        <span className="day-pill-num">{format(day, 'd')}</span>
                                        <span className="day-pill-dow">{format(day, 'EEE')}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Trip Grid View */}
            {viewMode === 'trip' && (
                <div className="calendar-grid trip">
                    <div className="days-grid trip">
                        {calendarDays.map((day, idx) => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const dayActs = getActivitiesForDate(day);
                            const isToday = isSameDay(day, new Date());
                            const isSelected = selectedDate === dateStr;

                            return (
                                <div
                                    key={idx}
                                    className={`calendar-day trip-card ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                                    onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                                    onDoubleClick={() => { setCurrentDate(day); setViewMode('day'); logEvent('Calendar View Changed', { view_mode: 'day', source: 'trip_card_drill_down' }); }}
                                >
                                    <div className="trip-card-header">
                                        <span className="cal-day-number">{format(day, 'd')}</span>
                                        <span className="cal-day-label">{format(day, 'EEE')}</span>
                                    </div>
                                    {dayActs.length > 0 ? (
                                        <div className="cal-day-activities">
                                            {dayActs.map(act => (
                                                <div key={act.id} className="cal-activity-chip" style={{ borderLeftColor: getActivityColor(act) }}>
                                                    <span>{CATEGORY_EMOJIS[act.category || 'other']}</span>
                                                    <span className="cal-activity-title">{act.title}</span>
                                                    {act.time && <span className="cal-activity-time">{act.time}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="trip-card-empty">No activities</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Day Detail View */}
            {viewMode === 'day' && (
                <div className="day-detail-view">
                    {selectedTripId && tripActivitiesForSummary.length > 0 && (
                        <div className="day-summary-section">
                            <button
                                type="button"
                                className="btn btn-sm ai-suggest-btn"
                                onClick={handleGenerateSummary}
                                disabled={summaryLoading}
                            >
                                {summaryLoading ? <><Loader2 size={14} className="spin" /> Generating…</> : 'AI Trip Summary'}
                            </button>
                            {summaryError && <p className="ai-error">{summaryError}</p>}
                            {tripSummary && (
                                <div className="trip-summary-card card" style={{ padding: '1rem', marginTop: '0.75rem' }}>
                                    <h4 className="trip-summary-header">AI Trip Summary</h4>
                                    <p className="trip-summary-text">{tripSummary.summary}</p>
                                    {tripSummary.highlights.length > 0 && (
                                        <ul className="trip-summary-highlights">
                                            {tripSummary.highlights.map((h, i) => <li key={i}>{h}</li>)}
                                        </ul>
                                    )}
                                    <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: '0.5rem' }} onClick={() => setTripSummary(null)}>Dismiss</button>
                                </div>
                            )}
                        </div>
                    )}
                    {selectedTripId && (
                        addingActivityForDate === currentDateStr ? (
                            <ActivityForm
                                tripId={selectedTripId}
                                date={currentDateStr}
                                nextOrder={dayViewActivities.length}
                                defaultCurrency={selectedTrip?.defaultCurrency}
                                onSave={(data) => handleSaveActivity(data, currentDateStr)}
                                onCancel={() => setAddingActivityForDate(null)}
                            />
                        ) : (
                            <button
                                type="button"
                                className="btn btn-outline add-activity-btn"
                                onClick={() => setAddingActivityForDate(currentDateStr)}
                            >
                                <Plus size={16} /> Add activity
                            </button>
                        )
                    )}
                    {dayViewActivities.length === 0 && !addingActivityForDate && (
                        <p className="no-activities-cal">No activities planned for this day.</p>
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
                                <div className="day-detail-activity card" style={{ borderLeftColor: getActivityColor(act) }}>
                                    <div className="detail-header">
                                        <span className="drag-handle" {...dragHandleProps}>
                                            <GripVertical size={16} />
                                        </span>
                                        <span className="detail-emoji">{CATEGORY_EMOJIS[act.category || 'other']}</span>
                                        <div>
                                            <h4>{act.title}</h4>
                                            {act.time && <span className="detail-time">{act.time}</span>}
                                        </div>
                                        <div className="detail-actions">
                                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingActivityId(act.id)} aria-label="Edit"><Pencil size={16} /></button>
                                        </div>
                                    </div>
                                    {act.details && <Markdown className="detail-desc">{act.details}</Markdown>}
                                    {act.location && <p className="detail-location">📍 {act.location}</p>}
                                    {act.cost != null && <p className="detail-cost">💰 {act.currency || '$'}{act.cost.toFixed(2)}</p>}
                                    {act.notes && <Markdown className="detail-notes">{act.notes}</Markdown>}
                                </div>
                            )
                        }
                    />
                </div>
            )}

            {/* Selected Date Panel (trip view CRUD) */}
            {selectedDate && viewMode === 'trip' && selectedTripId && (
                <div className="selected-date-panel card animate-fade-in">
                    <h3>{(() => { try { return format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy'); } catch { return selectedDate; } })()}</h3>
                    {addingActivityForDate === selectedDate ? (
                        <ActivityForm
                            tripId={selectedTripId}
                            date={selectedDate}
                            nextOrder={dayDetails.length}
                            defaultCurrency={selectedTrip?.defaultCurrency}
                            onSave={handleSaveActivity}
                            onCancel={() => setAddingActivityForDate(null)}
                        />
                    ) : (
                        <button
                            type="button"
                            className="btn btn-outline add-activity-btn"
                            onClick={() => setAddingActivityForDate(selectedDate)}
                        >
                            <Plus size={16} /> Add activity
                        </button>
                    )}
                    {dayDetails.length === 0 && !addingActivityForDate && (
                        <p className="no-activities-cal">No activities planned for this day.</p>
                    )}
                    {dayDetails.map((act) =>
                        editingActivityId === act.id ? (
                            <ActivityForm
                                key={act.id}
                                tripId={selectedTripId}
                                date={selectedDate}
                                existingActivity={act}
                                nextOrder={act.order}
                                defaultCurrency={selectedTrip?.defaultCurrency}
                                onSave={handleSaveActivity}
                                onCancel={() => setEditingActivityId(null)}
                                onDelete={() => {
                                    deleteActivity(act.id);
                                    setEditingActivityId(null);
                                    logEvent('Activity Deleted', { activity_title: act.title, category: act.category, source: 'calendar' });
                                    showToast(`"${act.title}" deleted`, () => {
                                        restoreActivity(act);
                                        logEvent('Activity Delete Undone', { activity_title: act.title });
                                    });
                                }}
                            />
                        ) : (
                            <div key={act.id} className="panel-activity panel-activity-with-actions" style={{ borderLeftColor: getActivityColor(act) }}>
                                <div className="panel-activity-top">
                                    <span>{CATEGORY_EMOJIS[act.category || 'other']}</span>
                                    <div className="panel-activity-content">
                                        <strong>{act.title}</strong>
                                        {act.time && <span className="panel-time"> at {act.time}</span>}
                                        {act.details && <Markdown className="panel-details">{act.details}</Markdown>}
                                    </div>
                                    <div className="panel-activity-actions">
                                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingActivityId(act.id)} aria-label="Edit"><Pencil size={14} /></button>
                                    </div>
                                </div>
                            </div>
                        )
                    )}
                </div>
            )}
        </div>
    );
};

export default CalendarView;
