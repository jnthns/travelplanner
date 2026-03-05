import React, { useState, useMemo } from 'react';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, MapPin, Clock, GripVertical } from 'lucide-react';
import { useTrips, useActivities } from '../lib/store';
import type { Activity, Trip } from '../lib/types';
import { CATEGORY_EMOJIS, CATEGORY_COLORS, TRIP_COLORS } from '../lib/types';
import { useLocalStorageState } from '../lib/persist';
import ActivityForm from '../components/ActivityForm';
import TripForm from '../components/TripForm';
import Markdown from '../components/Markdown';
import DraggableList from '../components/DraggableList';
import { logEvent } from '../lib/amplitude';
import './ItineraryList.css';

const safeFormatDate = (dateStr: string | undefined, fmt: string, fallback = '—'): string => {
    if (!dateStr) return fallback;
    try {
        const d = parseISO(dateStr);
        if (isNaN(d.getTime())) return fallback;
        return format(d, fmt);
    } catch {
        return fallback;
    }
};

const ItineraryList: React.FC = () => {
    const { trips, addTrip, updateTrip, deleteTrip } = useTrips();
    const { addActivity, updateActivity, deleteActivity, reorderActivities, getActivitiesByTrip } = useActivities();

    const [showTripForm, setShowTripForm] = useState(false);
    const [editingTrip, setEditingTrip] = useState<string | null>(null);
    const [selectedTripId, setSelectedTripId] = useLocalStorageState<string | null>(
        'travelplanner_itinerary_selectedTripId',
        null,
    );
    const [expandedDayList, setExpandedDayList] = useLocalStorageState<string[]>(
        'travelplanner_itinerary_expandedDays',
        [],
    );
    const [addingActivityDate, setAddingActivityDate] = useState<string | null>(null);
    const [editingActivity, setEditingActivity] = useState<string | null>(null);
    const [tripFormError, setTripFormError] = useState<string | null>(null);

    const selectedTrip = trips.find(t => t.id === selectedTripId);
    const expandedDays = useMemo(() => new Set(expandedDayList), [expandedDayList]);

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

    const tripActivities = useMemo(() => {
        if (!selectedTripId) return [];
        return getActivitiesByTrip(selectedTripId);
    }, [selectedTripId, getActivitiesByTrip]);

    const toggleDay = (dateStr: string) => {
        setExpandedDayList(prev => {
            const next = new Set(prev);
            if (next.has(dateStr)) next.delete(dateStr);
            else next.add(dateStr);
            return Array.from(next);
        });
    };

    const handleSaveTrip = async (tripData: Trip | Omit<Trip, 'id'>) => {
        setTripFormError(null);
        try {
            if ('id' in tripData) {
                await updateTrip(tripData.id, tripData);
                logEvent('Trip Updated', { trip_name: tripData.name, start_date: tripData.startDate, end_date: tripData.endDate });
            } else {
                const newTrip = await addTrip(tripData);
                setSelectedTripId(newTrip.id);
                logEvent('Trip Created', { trip_name: tripData.name, start_date: tripData.startDate, end_date: tripData.endDate, default_currency: tripData.defaultCurrency });
            }
            setShowTripForm(false);
            setEditingTrip(null);
        } catch (err) {
            console.error('Failed to save trip:', err);
            setTripFormError(err instanceof Error ? err.message : 'Failed to save trip. Check your connection and try again.');
        }
    };

    const handleSaveActivity = (
        activityData: Omit<Activity, 'id'> | ({ id: string } & Partial<Activity>),
    ) => {
        if ('id' in activityData) {
            updateActivity(activityData.id, activityData);
            logEvent('Activity Updated', { activity_title: activityData.title, category: activityData.category });
        } else {
            addActivity(activityData);
            logEvent('Activity Created', { activity_title: activityData.title, category: activityData.category, date: activityData.date, trip_id: activityData.tripId });
        }
        setAddingActivityDate(null);
        setEditingActivity(null);
    };

    const handleDeleteTrip = (id: string) => {
        if (confirm('Delete this trip and all its activities?')) {
            const trip = trips.find(t => t.id === id);
            deleteTrip(id);
            logEvent('Trip Deleted', { trip_name: trip?.name });
            if (selectedTripId === id) setSelectedTripId(null);
        }
    };

    const activitiesForDate = (dateStr: string): Activity[] => {
        return tripActivities.filter(a => a.date === dateStr);
    };

    const handleReorderActivities = (reordered: Activity[]) => {
        const updates = reordered
            .map((act, idx) => ({ id: act.id, order: idx }))
            .filter((u, idx) => reordered[idx].order !== u.order);
        if (updates.length > 0) {
            reorderActivities(updates);
            logEvent('Activities Reordered', { count: updates.length });
        }
    };

    // No trips yet - show welcome
    if (trips.length === 0 && !showTripForm) {
        return (
            <div className="page-container animate-fade-in">
                <div className="empty-state">
                    <div className="empty-icon">🌴</div>
                    <h2>Plan your next adventure</h2>
                    <p>Create your first trip to get started tracking your itinerary.</p>
                    <button className="btn btn-primary" onClick={() => setShowTripForm(true)}>
                        <Plus size={18} /> Create Trip
                    </button>
                </div>
                {showTripForm && (
                    <TripForm onSave={handleSaveTrip} onCancel={() => setShowTripForm(false)} />
                )}
            </div>
        );
    }

    return (
        <div className="page-container animate-fade-in">
            <header className="page-header">
                <div>
                    <h1>Your Trips</h1>
                    <p>{trips.length} trip{trips.length !== 1 ? 's' : ''} planned</p>
                </div>
                <button className="btn btn-primary" onClick={() => { setShowTripForm(true); setEditingTrip(null); }}>
                    <Plus size={18} /> New Trip
                </button>
            </header>

            {showTripForm && (
                <>
                    {tripFormError && <p className="form-error-msg">{tripFormError}</p>}
                    <TripForm
                        existing={editingTrip ? trips.find(t => t.id === editingTrip) : undefined}
                        onSave={handleSaveTrip}
                        onCancel={() => { setShowTripForm(false); setEditingTrip(null); setTripFormError(null); }}
                    />
                </>
            )}

            {/* Trip Selector */}
            <div className="trip-selector">
                {trips.map((trip, idx) => (
                    <div
                        key={trip.id}
                        role="button"
                        tabIndex={0}
                        className={`trip-card ${selectedTripId === trip.id ? 'selected' : ''}`}
                        style={{
                            backgroundColor: `color-mix(in srgb, ${trip.color ?? TRIP_COLORS[idx % TRIP_COLORS.length]} 12%, var(--surface-color))`,
                            borderColor: trip.color ?? TRIP_COLORS[idx % TRIP_COLORS.length],
                        }}
                        onClick={() => setSelectedTripId(selectedTripId === trip.id ? null : trip.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedTripId(selectedTripId === trip.id ? null : trip.id); }}
                    >
                        <div className="trip-card-header">
                            <h3>{trip.name}</h3>
                            <div className="trip-card-actions" onClick={e => e.stopPropagation()}>
                                <button className="btn btn-ghost btn-sm" onClick={() => { setEditingTrip(trip.id); setShowTripForm(true); }}>
                                    <Pencil size={14} />
                                </button>
                                <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteTrip(trip.id)}>
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                        <p className="trip-dates">
                            {safeFormatDate(trip.startDate, 'MMM d')} – {safeFormatDate(trip.endDate, 'MMM d, yyyy')}
                        </p>
                        {trip.description && <Markdown className="trip-desc">{trip.description}</Markdown>}
                    </div>
                ))}
            </div>

            {/* Day-by-day itinerary */}
            {selectedTrip && (
                <div className="day-list">
                    <h2 className="section-title">{selectedTrip.name} — Daily Itinerary</h2>
                    {tripDays.map((day, idx) => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const dayLabel = format(day, 'EEEE, MMM d');
                        const dayActivities = activitiesForDate(dateStr);
                        const isExpanded = expandedDays.has(dateStr);

                        return (
                            <div key={dateStr} className="day-card card">
                                <button className="day-card-header" onClick={() => toggleDay(dateStr)}>
                                    <div className="day-header-left">
                                        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                        <div>
                                            <span className="day-number">Day {idx + 1}</span>
                                            <span className="day-label">{dayLabel}</span>
                                        </div>
                                    </div>
                                    <span className="activity-count">
                                        {dayActivities.length} {dayActivities.length === 1 ? 'activity' : 'activities'}
                                    </span>
                                </button>

                                {isExpanded && (
                                    <div className="day-card-body animate-fade-in">
                                        {dayActivities.length === 0 && addingActivityDate !== dateStr && (
                                            <p className="no-activities">No activities yet for this day.</p>
                                        )}

                                        <DraggableList
                                            items={dayActivities}
                                            keyFn={a => a.id}
                                            onReorder={handleReorderActivities}
                                            disabled={editingActivity !== null}
                                            renderItem={(activity, _idx, dragHandleProps) => {
                                                const actColor = activity.color ?? CATEGORY_COLORS[activity.category || 'other'];
                                                return (
                                                    <div
                                                        className="activity-item"
                                                        style={{ backgroundColor: `color-mix(in srgb, ${actColor} 10%, transparent)`, borderLeft: `3px solid ${actColor}`, borderRadius: 'var(--radius-sm)', paddingLeft: '0.75rem' }}
                                                    >
                                                        {editingActivity === activity.id ? (
                                                            <ActivityForm
                                                                tripId={selectedTripId!}
                                                                date={dateStr}
                                                                existingActivity={activity}
                                                                nextOrder={activity.order}
                                                                defaultCurrency={selectedTrip?.defaultCurrency}
                                                                onSave={handleSaveActivity}
                                                                onCancel={() => setEditingActivity(null)}
                                                                onDelete={() => { if (confirm('Delete this activity?')) { deleteActivity(activity.id); setEditingActivity(null); logEvent('Activity Deleted', { activity_title: activity.title, category: activity.category }); } }}
                                                            />
                                                        ) : (
                                                            <div className="activity-content">
                                                                <span className="drag-handle" {...dragHandleProps}>
                                                                    <GripVertical size={16} />
                                                                </span>
                                                                <div className="activity-left">
                                                                    <span
                                                                        className="activity-category-dot"
                                                                        style={{ backgroundColor: activity.color ?? CATEGORY_COLORS[activity.category || 'other'] }}
                                                                    >
                                                                        {CATEGORY_EMOJIS[activity.category || 'other']}
                                                                    </span>
                                                                    <div>
                                                                        <h4 className="activity-title">{activity.title}</h4>
                                                                        {activity.details && <Markdown className="activity-details">{activity.details}</Markdown>}
                                                                        <div className="activity-meta">
                                                                            {activity.time && (
                                                                                <span className="meta-item"><Clock size={13} /> {activity.time}</span>
                                                                            )}
                                                                            {activity.location && (
                                                                                <span className="meta-item"><MapPin size={13} /> {activity.location}</span>
                                                                            )}
                                                                            {activity.cost != null && (
                                                                                <span className="meta-item cost-tag">
                                                                                    {activity.currency || '$'}{activity.cost.toFixed(2)}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="activity-actions">
                                                                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingActivity(activity.id)}>
                                                                        <Pencil size={14} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }}
                                        />

                                        {addingActivityDate === dateStr ? (
                                            <ActivityForm
                                                tripId={selectedTripId!}
                                                date={dateStr}
                                                nextOrder={dayActivities.length}
                                                defaultCurrency={selectedTrip?.defaultCurrency}
                                                onSave={handleSaveActivity}
                                                onCancel={() => setAddingActivityDate(null)}
                                            />
                                        ) : (
                                            <button
                                                className="btn btn-outline add-activity-btn"
                                                onClick={() => setAddingActivityDate(dateStr)}
                                            >
                                                <Plus size={16} /> Add Activity
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ItineraryList;
