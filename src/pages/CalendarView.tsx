import React, { useState, useMemo, useEffect } from 'react';
import {
    format,
    eachDayOfInterval,
    isSameDay,
    parseISO,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Pencil } from 'lucide-react';
import { useTrips, useActivities } from '../lib/store';
import { CATEGORY_EMOJIS, CATEGORY_COLORS } from '../lib/types';
import ActivityForm from '../components/ActivityForm';
import Markdown from '../components/Markdown';
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
    const { activities, addActivity, updateActivity, deleteActivity } = useActivities();

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
                    {dayViewActivities.map(act =>
                        editingActivityId === act.id ? (
                            <ActivityForm
                                key={act.id}
                                tripId={act.tripId}
                                date={act.date}
                                existingActivity={act}
                                nextOrder={act.order}
                                defaultCurrency={selectedTrip?.defaultCurrency}
                                onSave={handleSaveActivity}
                                onCancel={() => setEditingActivityId(null)}
                                onDelete={() => { if (confirm('Delete this activity?')) { deleteActivity(act.id); setEditingActivityId(null); logEvent('Activity Deleted', { activity_title: act.title, category: act.category, source: 'calendar_day' }); } }}
                            />
                        ) : (
                            <div key={act.id} className="day-detail-activity card" style={{ borderLeftColor: getActivityColor(act) }}>
                                <div className="detail-header">
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
                    )}
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
                                onDelete={() => { if (confirm('Delete this activity?')) { deleteActivity(act.id); setEditingActivityId(null); logEvent('Activity Deleted', { activity_title: act.title, category: act.category, source: 'calendar' }); } }}
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
