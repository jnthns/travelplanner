import React, { useState, useMemo, useEffect } from 'react';
import {
    format,
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameDay,
    parseISO,
    addMonths,
    subMonths,
    isWithinInterval,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react';
import { useTrips, useActivities } from '../lib/store';
import { CATEGORY_EMOJIS, CATEGORY_COLORS, TRIP_COLORS } from '../lib/types';
import type { Trip } from '../lib/types';
import ActivityForm from '../components/ActivityForm';
import './CalendarView.css';

const CALENDAR_VIEW_KEY = 'travelplanner_calendar_view';

type ViewMode = 'month' | 'week' | 'day' | 'trip';

function loadCalendarPrefs(): { viewMode: ViewMode; selectedTripId: string | null } {
    try {
        const raw = localStorage.getItem(CALENDAR_VIEW_KEY);
        if (!raw) return { viewMode: 'trip', selectedTripId: null };
        const p = JSON.parse(raw) as { viewMode?: string; selectedTripId?: string | null };
        const viewMode = ['day', 'week', 'month', 'trip'].includes(p.viewMode ?? '') ? p.viewMode as ViewMode : 'trip';
        return { viewMode, selectedTripId: p.selectedTripId ?? null };
    } catch {
        return { viewMode: 'trip', selectedTripId: null };
    }
}

function saveCalendarPrefs(viewMode: ViewMode, selectedTripId: string | null) {
    try {
        localStorage.setItem(CALENDAR_VIEW_KEY, JSON.stringify({ viewMode, selectedTripId }));
    } catch { /* ignore */ }
}

const CalendarView: React.FC = () => {
    const { trips } = useTrips();
    const { activities, addActivity, updateActivity, deleteActivity } = useActivities();

    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<ViewMode>(() => loadCalendarPrefs().viewMode);
    const [selectedTripId, setSelectedTripId] = useState<string | null>(() => loadCalendarPrefs().selectedTripId);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [addingActivityForDate, setAddingActivityForDate] = useState<string | null>(null);
    const [editingActivityId, setEditingActivityId] = useState<string | null>(null);

    const selectedTrip = trips.find(t => t.id === selectedTripId);

    useEffect(() => {
        saveCalendarPrefs(viewMode, selectedTripId);
    }, [viewMode, selectedTripId]);

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
        if (viewMode === 'week') {
            return eachDayOfInterval({
                start: startOfWeek(currentDate),
                end: endOfWeek(currentDate),
            });
        }
        // month
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const calStart = startOfWeek(monthStart);
        const calEnd = endOfWeek(monthEnd);
        return eachDayOfInterval({ start: calStart, end: calEnd });
    }, [currentDate, viewMode, selectedTrip]);

    const getActivitiesForDate = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return activities.filter(a => a.date === dateStr);
    };

    const navigate = (direction: number) => {
        if (viewMode === 'month') {
            setCurrentDate(direction > 0 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
        } else if (viewMode === 'week') {
            setCurrentDate(new Date(currentDate.getTime() + direction * 7 * 24 * 60 * 60 * 1000));
        } else if (viewMode === 'day') {
            setCurrentDate(new Date(currentDate.getTime() + direction * 24 * 60 * 60 * 1000));
        }
    };

    const isInTrip = (date: Date) => {
        return trips.some(t => {
            try {
                return isWithinInterval(date, { start: parseISO(t.startDate), end: parseISO(t.endDate) });
            } catch {
                return false;
            }
        });
    };

    const dayDetails = selectedDate
        ? activities.filter(a => a.date === selectedDate).sort((a, b) => a.order - b.order)
        : [];

    // Trip overlay bars for month view (Google Calendar–style multi-day events)
    const monthTripOverlay = useMemo(() => {
        if (viewMode !== 'month' || calendarDays.length === 0) return [];
        const bars: { trip: Trip; weekIndex: number; colStart: number; colEnd: number }[] = [];
        const numWeeks = Math.ceil(calendarDays.length / 7);
        for (let w = 0; w < numWeeks; w++) {
            const weekStart = calendarDays[w * 7];
            const weekEnd = calendarDays[w * 7 + 6];
            if (!weekStart || !weekEnd) continue;
            const weekStartT = weekStart.getTime();
            const weekEndT = weekEnd.getTime();
            const dayMs = 24 * 60 * 60 * 1000;
            trips.forEach((trip) => {
                try {
                    const tripStart = parseISO(trip.startDate).getTime();
                    const tripEnd = parseISO(trip.endDate).getTime();
                    const oStart = Math.max(tripStart, weekStartT);
                    const oEnd = Math.min(tripEnd, weekEndT);
                    if (oStart > oEnd) return;
                    const colStart = Math.round((oStart - weekStartT) / dayMs);
                    const colEnd = Math.round((oEnd - weekStartT) / dayMs);
                    bars.push({ trip, weekIndex: w, colStart: Math.max(0, colStart), colEnd: Math.min(6, colEnd) });
                } catch { /* skip invalid trip */ }
            });
        }
        return bars;
    }, [viewMode, calendarDays, trips]);

    const getActivityColor = (activity: { category?: string; color?: string }) =>
        activity.color ?? CATEGORY_COLORS[activity.category ?? 'other'];

    const handleSaveActivity = (
        activityData: Omit<import('../lib/types').Activity, 'id'> | ({ id: string } & Partial<import('../lib/types').Activity>)
    ) => {
        if ('id' in activityData && activityData.id) {
            updateActivity(activityData.id, activityData);
        } else if (selectedTripId && selectedDate) {
            addActivity({
                ...activityData,
                tripId: selectedTripId,
                date: selectedDate,
                order: ('order' in activityData ? activityData.order : dayDetails.length) ?? dayDetails.length,
                title: ('title' in activityData ? activityData.title : '') || 'Activity',
            } as Omit<import('../lib/types').Activity, 'id'>);
        }
        setAddingActivityForDate(null);
        setEditingActivityId(null);
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
                    {(['day', 'week', 'month', 'trip'] as ViewMode[]).map(mode => (
                        <button
                            key={mode}
                            className={`view-tab ${viewMode === mode ? 'active' : ''}`}
                            onClick={() => setViewMode(mode)}
                        >
                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </button>
                    ))}
                </div>

                {viewMode === 'trip' ? (
                    <select
                        className="input-field trip-select"
                        value={selectedTripId || ''}
                        onChange={e => setSelectedTripId(e.target.value || null)}
                    >
                        <option value="">Select a trip...</option>
                        {trips.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                ) : (
                    <div className="nav-controls">
                        <button className="btn btn-ghost" onClick={() => navigate(-1)}>
                            <ChevronLeft size={20} />
                        </button>
                        <span className="current-label">
                            {viewMode === 'month' && format(currentDate, 'MMMM yyyy')}
                            {viewMode === 'week' && `${format(startOfWeek(currentDate), 'MMM d')} - ${format(endOfWeek(currentDate), 'MMM d, yyyy')}`}
                            {viewMode === 'day' && format(currentDate, 'EEEE, MMM d, yyyy')}
                        </span>
                        <button className="btn btn-ghost" onClick={() => navigate(1)}>
                            <ChevronRight size={20} />
                        </button>
                    </div>
                )}
            </div>

            {/* Calendar Grid */}
            {(viewMode === 'month' || viewMode === 'week' || viewMode === 'trip') && (
                <div className={`calendar-grid ${viewMode}`}>
                    {viewMode !== 'trip' && (
                        <div className="weekday-headers">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                <div key={d} className="weekday-header">{d}</div>
                            ))}
                        </div>
                    )}
                    {/* Month view: trip overlay bars (Google Calendar–style) */}
                    {viewMode === 'month' && monthTripOverlay.length > 0 && (
                        <div
                            className="calendar-trip-overlay"
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(7, 1fr)',
                                gridTemplateRows: `repeat(${Math.ceil(calendarDays.length / 7)}, 20px)`,
                                gap: '2px',
                                marginBottom: '4px',
                            }}
                        >
                            {monthTripOverlay.map(({ trip, weekIndex, colStart, colEnd }) => (
                                <div
                                    key={`${trip.id}-${weekIndex}`}
                                    className="trip-overlay-bar"
                                    style={{
                                        gridColumn: `${colStart + 1} / ${colEnd + 2}`,
                                        gridRow: weekIndex + 1,
                                        backgroundColor: trip.color ?? TRIP_COLORS[trips.indexOf(trip) % TRIP_COLORS.length],
                                        borderRadius: '4px',
                                        minHeight: '18px',
                                    }}
                                    title={trip.name}
                                />
                            ))}
                        </div>
                    )}
                    <div className={`days-grid ${viewMode}`}>
                        {calendarDays.map((day, idx) => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const dayActs = getActivitiesForDate(day);
                            const inTrip = isInTrip(day);
                            const isToday = isSameDay(day, new Date());
                            const isSelected = selectedDate === dateStr;

                            return (
                                <div
                                    key={idx}
                                    className={`calendar-day ${isToday ? 'today' : ''} ${inTrip ? 'in-trip' : ''} ${isSelected ? 'selected' : ''}`}
                                    onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                                >
                                    <span className="cal-day-number">{format(day, 'd')}</span>
                                    {viewMode === 'trip' && (
                                        <span className="cal-day-label">{format(day, 'EEE')}</span>
                                    )}
                                    <div className="cal-day-dots">
                                        {dayActs.slice(0, 3).map((act) => (
                                            <span
                                                key={act.id}
                                                className="cal-dot"
                                                style={{ backgroundColor: getActivityColor(act) }}
                                                title={act.title}
                                            />
                                        ))}
                                        {dayActs.length > 3 && <span className="cal-dot-more">+{dayActs.length - 3}</span>}
                                    </div>
                                    {(viewMode === 'week' || viewMode === 'trip') && dayActs.length > 0 && (
                                        <div className="cal-day-activities">
                                            {dayActs.slice(0, 4).map(act => (
                                                <div key={act.id} className="cal-activity-chip" style={{ borderLeftColor: getActivityColor(act) }}>
                                                    <span>{CATEGORY_EMOJIS[act.category || 'other']}</span>
                                                    <span className="cal-activity-title">{act.title}</span>
                                                </div>
                                            ))}
                                        </div>
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
                    {(() => {
                        const dayActs = getActivitiesForDate(currentDate);
                        if (dayActs.length === 0) {
                            return <p className="no-activities-cal">No activities planned for this day.</p>;
                        }
                        return dayActs.map(act => (
                            <div key={act.id} className="day-detail-activity card" style={{ borderLeftColor: getActivityColor(act) }}>
                                <div className="detail-header">
                                    <span className="detail-emoji">{CATEGORY_EMOJIS[act.category || 'other']}</span>
                                    <div>
                                        <h4>{act.title}</h4>
                                        {act.time && <span className="detail-time">{act.time}</span>}
                                    </div>
                                </div>
                                {act.details && <p className="detail-desc">{act.details}</p>}
                                {act.location && <p className="detail-location">📍 {act.location}</p>}
                                {act.cost != null && <p className="detail-cost">💰 {act.currency || '$'}{act.cost.toFixed(2)}</p>}
                                {act.notes && <p className="detail-notes">{act.notes}</p>}
                            </div>
                        ));
                    })()}
                </div>
            )}

            {/* Selected Date Panel (with CRUD in trip view) */}
            {selectedDate && viewMode !== 'day' && (
                <div className="selected-date-panel card animate-fade-in">
                    <h3>{(() => { try { return format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy'); } catch { return selectedDate; } })()}</h3>
                    {viewMode === 'trip' && selectedTripId && (
                        <>
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
                                    />
                                ) : (
                                    <div key={act.id} className="panel-activity panel-activity-with-actions" style={{ borderLeftColor: getActivityColor(act) }}>
                                        <span>{CATEGORY_EMOJIS[act.category || 'other']}</span>
                                        <div className="panel-activity-content">
                                            <strong>{act.title}</strong>
                                            {act.time && <span className="panel-time"> at {act.time}</span>}
                                            {act.details && <p className="panel-details">{act.details}</p>}
                                        </div>
                                        <div className="panel-activity-actions">
                                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingActivityId(act.id)} aria-label="Edit"><Pencil size={14} /></button>
                                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { if (confirm('Delete this activity?')) deleteActivity(act.id); }} aria-label="Delete"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                )
                            )}
                        </>
                    )}
                    {!(viewMode === 'trip' && selectedTripId) && (
                        dayDetails.length === 0 ? (
                            <p className="no-activities-cal">No activities planned.</p>
                        ) : (
                            dayDetails.map(act => (
                                <div key={act.id} className="panel-activity" style={{ borderLeftColor: getActivityColor(act) }}>
                                    <span>{CATEGORY_EMOJIS[act.category || 'other']}</span>
                                    <div>
                                        <strong>{act.title}</strong>
                                        {act.time && <span className="panel-time"> at {act.time}</span>}
                                        {act.details && <p className="panel-details">{act.details}</p>}
                                    </div>
                                </div>
                            ))
                        )
                    )}
                </div>
            )}
        </div>
    );
};

export default CalendarView;
