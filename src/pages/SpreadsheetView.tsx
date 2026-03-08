import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { format, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { Plus, Users, Pencil, Trash2, ChevronLeft, ChevronRight, Sunrise, Sun, Sunset, Clock, MapPin } from 'lucide-react';
import { useTrips, useActivities } from '../lib/store';
import { useAuth } from '../lib/AuthContext';
import type { Activity, Trip } from '../lib/types';
import { CATEGORY_EMOJIS, CATEGORY_COLORS, TRIP_COLORS } from '../lib/types';
import { useLocalStorageState } from '../lib/persist';
import ActivityForm from '../components/ActivityForm';
import TripForm from '../components/TripForm';
import ShareModal from '../components/ShareModal';
import Markdown from '../components/Markdown';
import { useToast } from '../components/Toast';
import { logEvent } from '../lib/amplitude';
import styles from './SpreadsheetView.module.css';

type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'unscheduled';

const TIME_SLOTS: { key: TimeSlot; label: string; icon: React.ReactNode; default: string }[] = [
    { key: 'morning', label: 'Morning', icon: <Sunrise size={16} />, default: '09:00' },
    { key: 'afternoon', label: 'Afternoon', icon: <Sun size={16} />, default: '13:00' },
    { key: 'evening', label: 'Evening', icon: <Sunset size={16} />, default: '18:00' },
    { key: 'unscheduled', label: 'Unscheduled', icon: <Clock size={16} />, default: '' },
];

function getTimeSlot(time?: string): TimeSlot {
    if (!time) return 'unscheduled';
    const [h] = time.split(':').map(Number);
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
}

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

const SpreadsheetView: React.FC = () => {
    const { trips, loading: tripsLoading, addTrip, updateTrip, deleteTrip, restoreTrip } = useTrips();
    const { activities, addActivity, updateActivity, deleteActivity, restoreActivity, getActivitiesByTrip } = useActivities();
    const { showToast } = useToast();
    const { user } = useAuth();

    const [selectedTripId, setSelectedTripId] = useLocalStorageState<string | null>(
        'travelplanner_spreadsheet_selectedTripId',
        null,
    );

    const [showTripForm, setShowTripForm] = useState(false);
    const [editingTrip, setEditingTrip] = useState<string | null>(null);
    const [sharingTrip, setSharingTrip] = useState<import('../lib/types').Trip | null>(null);
    const [tripFormError, setTripFormError] = useState<string | null>(null);
    const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
    const [addingCell, setAddingCell] = useState<{ date: string; slot: TimeSlot } | null>(null);
    const [dragOverCell, setDragOverCell] = useState<string | null>(null);
    const [focusedDate, setFocusedDate] = useState<Date>(() => new Date());
    const spreadsheetWrapperRef = useRef<HTMLDivElement>(null);

    const selectedTrip = trips.find(t => t.id === selectedTripId);

    const tripDays = useMemo(() => {
        if (!selectedTrip) return [];
        try {
            return eachDayOfInterval({
                start: parseISO(selectedTrip.startDate),
                end: parseISO(selectedTrip.endDate),
            });
        } catch { return []; }
    }, [selectedTrip]);

    useEffect(() => {
        if (tripDays.length === 0) return;
        const today = new Date();
        const inRange = tripDays.some(d => isSameDay(d, today));
        setFocusedDate(inRange ? today : tripDays[0]);
    }, [selectedTripId, tripDays]);

    const navigateDay = useCallback((direction: number) => {
        setFocusedDate(prev => {
            const next = new Date(prev.getTime() + direction * 24 * 60 * 60 * 1000);
            if (tripDays.length === 0) return next;
            const first = tripDays[0];
            const last = tripDays[tripDays.length - 1];
            if (next < first) return first;
            if (next > last) return last;
            return next;
        });
    }, [tripDays]);

    useEffect(() => {
        const wrapper = spreadsheetWrapperRef.current;
        if (!wrapper || tripDays.length === 0) return;
        const dayIndex = tripDays.findIndex(d => isSameDay(d, focusedDate));
        if (dayIndex < 0) return;
        const headerCells = wrapper.querySelectorAll('[class*="sheet-header-cell"]:not([class*="sheet-corner"])');
        const target = headerCells[dayIndex] as HTMLElement | undefined;
        if (!target) return;
        const targetLeft = target.offsetLeft;
        const targetWidth = target.offsetWidth;
        wrapper.scrollTo({
            left: targetLeft - wrapper.clientWidth / 2 + targetWidth / 2,
            behavior: 'smooth',
        });
    }, [focusedDate, tripDays]);

    const tripActivities = useMemo(() => {
        if (!selectedTripId) return [];
        return activities.filter(a => a.tripId === selectedTripId);
    }, [selectedTripId, activities]);

    const getCell = useCallback((dateStr: string, slot: TimeSlot): Activity[] => {
        return tripActivities
            .filter(a => a.date === dateStr && getTimeSlot(a.time) === slot)
            .sort((a, b) => a.order - b.order);
    }, [tripActivities]);

    const handleDragStart = (e: React.DragEvent, activity: Activity) => {
        e.dataTransfer.setData('text/plain', activity.id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, cellKey: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverCell(cellKey);
    };

    const handleDragLeave = () => {
        setDragOverCell(null);
    };

    const handleDrop = (e: React.DragEvent, dateStr: string, slot: TimeSlot) => {
        e.preventDefault();
        setDragOverCell(null);
        const activityId = e.dataTransfer.getData('text/plain');
        if (!activityId) return;

        const activity = tripActivities.find(a => a.id === activityId);
        if (!activity) return;

        const slotMeta = TIME_SLOTS.find(s => s.key === slot);
        const newTime = slot === 'unscheduled' ? undefined : slotMeta?.default;
        const changed = activity.date !== dateStr || getTimeSlot(activity.time) !== slot;
        if (!changed) return;

        updateActivity(activityId, { date: dateStr, time: newTime });
        logEvent('Activity Moved in Spreadsheet', {
            activity_title: activity.title,
            from_date: activity.date,
            to_date: dateStr,
            to_slot: slot,
        });
    };

    const handleSaveActivity = (data: Omit<Activity, 'id' | 'userId' | 'tripMembers'> | ({ id: string } & Partial<Omit<Activity, 'userId'>>)) => {
        if ('id' in data) {
            updateActivity(data.id, data);
            logEvent('Activity Updated', { activity_title: data.title, source: 'spreadsheet' });
        } else {
            const trip = trips.find(t => t.id === selectedTripId);
            addActivity(data as Omit<import('../lib/types').Activity, 'id' | 'userId' | 'tripMembers'>, trip?.members || []);
            logEvent('Activity Created', { activity_title: data.title, date: data.date, source: 'spreadsheet' });
        }
        setEditingActivity(null);
        setAddingCell(null);
    };

    const handleDeleteFromModal = (id: string) => {
        const act = tripActivities.find(a => a.id === id);
        if (!act) return;
        deleteActivity(id);
        logEvent('Activity Deleted', { activity_title: act.title, source: 'spreadsheet' });
        setEditingActivity(null);
        showToast(`"${act.title}" deleted`, () => {
            restoreActivity(act);
            logEvent('Activity Delete Undone', { activity_title: act.title });
        });
    };

    const cellKey = (dateStr: string, slot: TimeSlot) => `${dateStr}__${slot}`;

    const handleSaveTrip = async (tripData: Omit<Trip, 'id' | 'userId' | 'members' | 'sharedWithEmails'> | (Pick<Trip, 'id'> & Partial<Omit<Trip, 'id' | 'userId'>>)) => {
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

    const handleDeleteTrip = (id: string) => {
        const trip = trips.find(t => t.id === id);
        if (!trip) return;
        const deletedActivities = getActivitiesByTrip(id);
        deleteTrip(id);
        deletedActivities.forEach(a => deleteActivity(a.id));
        logEvent('Trip Deleted', { trip_name: trip.name });
        if (selectedTripId === id) setSelectedTripId(null);
        showToast(`"${trip.name}" deleted`, () => {
            restoreTrip(trip);
            deletedActivities.forEach(a => restoreActivity(a));
            logEvent('Trip Delete Undone', { trip_name: trip.name });
        });
    };

    const handleUpdateDayLocation = useCallback((dateStr: string, location: string) => {
        if (!selectedTrip) return;
        const dayLocations = { ...selectedTrip.dayLocations, [dateStr]: location };
        if (!location.trim()) delete dayLocations[dateStr];
        updateTrip(selectedTrip.id, { dayLocations });
    }, [selectedTrip, updateTrip]);

    if (tripsLoading) {
        return <div className={`page-container animate-fade-in ${styles['spreadsheet-page']}`} />;
    }

    if (trips.length === 0 && !showTripForm) {
        return (
            <div className={`page-container animate-fade-in ${styles['spreadsheet-page']}`}>
                <div className={styles['empty-state']}>
                    <div className={styles['empty-icon']}>🌴</div>
                    <h2>Plan your next adventure</h2>
                    <p>Create your first trip to get started.</p>
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
        <div className={`page-container animate-fade-in ${styles['spreadsheet-page']}`}>
            <header className="page-header" style={{ alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <h1 style={{ lineHeight: 1, margin: 0 }}>Your Trips</h1>
                    <p style={{ margin: 0 }}>{trips.length} trip{trips.length !== 1 ? 's' : ''} planned</p>
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

            {/* Desktop: card grid */}
            <div className={`${styles['trip-selector']} ${styles['trip-selector-desktop'] || ''}`}>
                {trips.map((trip, idx) => (
                    <div
                        key={trip.id}
                        role="button"
                        tabIndex={0}
                        className={`${styles['trip-card']} ${selectedTripId === trip.id ? styles['selected'] : ''}`}
                        style={{
                            backgroundColor: `color-mix(in srgb, ${trip.color ?? TRIP_COLORS[idx % TRIP_COLORS.length]} 12%, var(--surface-color))`,
                            borderColor: trip.color ?? TRIP_COLORS[idx % TRIP_COLORS.length],
                        }}
                        onClick={() => setSelectedTripId(selectedTripId === trip.id ? null : trip.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedTripId(selectedTripId === trip.id ? null : trip.id); }}
                    >
                        <div className={styles['trip-card-header']}>
                            <h3>{trip.name}</h3>
                            <div className={styles['trip-card-actions']} onClick={e => e.stopPropagation()}>
                                {!user?.isAnonymous && trip.userId === user?.uid && (
                                    <button className="btn btn-ghost btn-sm" onClick={() => setSharingTrip(trip)} title="Share Trip">
                                        <Users size={14} />
                                    </button>
                                )}
                                <button className="btn btn-ghost btn-sm" onClick={() => { setEditingTrip(trip.id); setShowTripForm(true); }}>
                                    <Pencil size={14} />
                                </button>
                                <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteTrip(trip.id)}>
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                        <p className={styles['trip-dates']}>
                            {safeFormatDate(trip.startDate, 'MMM d')} – {safeFormatDate(trip.endDate, 'MMM d, yyyy')}
                        </p>
                        {trip.description && <Markdown className={styles['trip-desc']}>{trip.description}</Markdown>}
                    </div>
                ))}
            </div>

            {/* Mobile: compact dropdown */}
            <div className={styles['trip-selector-mobile']}>
                <select
                    className="input-field"
                    value={selectedTripId || ''}
                    onChange={e => setSelectedTripId(e.target.value || null)}
                >
                    <option value="">Select a trip...</option>
                    {trips.map(t => (
                        <option key={t.id} value={t.id}>
                            {t.name} ({safeFormatDate(t.startDate, 'MMM d')} – {safeFormatDate(t.endDate, 'MMM d')})
                        </option>
                    ))}
                </select>
                {selectedTripId && (
                    <div className={styles['trip-mobile-actions']}>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setEditingTrip(selectedTripId); setShowTripForm(true); }}>
                            <Pencil size={14} />
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteTrip(selectedTripId)}>
                            <Trash2 size={14} />
                        </button>
                    </div>
                )}
            </div>

            {selectedTrip && tripDays.length > 0 && (
                <>
                    <div className={styles['day-nav-wrapper']}>
                        <div className={styles['nav-controls-modern']}>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigateDay(-1)} aria-label="Previous day">
                                <ChevronLeft size={18} />
                            </button>
                            <span className={styles['current-label']}>
                                {format(focusedDate, 'EEEE, MMM d, yyyy')}
                            </span>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigateDay(1)} aria-label="Next day">
                                <ChevronRight size={18} />
                            </button>
                        </div>
                        <div className={styles['day-pills']}>
                            {tripDays.map((day, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    className={`${styles['day-pill']} ${isSameDay(day, focusedDate) ? styles['active'] : ''} ${isSameDay(day, new Date()) ? styles['today'] : ''}`}
                                    onClick={() => setFocusedDate(day)}
                                    title={format(day, 'EEEE, MMM d')}
                                >
                                    <span className={styles['day-pill-num']}>{format(day, 'd')}</span>
                                    <span className={styles['day-pill-dow']}>{format(day, 'EEE')}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className={styles['spreadsheet-wrapper']} ref={spreadsheetWrapperRef}>
                        <div
                            className={styles['spreadsheet-grid']}
                            style={{ gridTemplateColumns: `var(--sheet-label-width) repeat(${tripDays.length}, minmax(140px, 1fr))` }}
                        >
                            {/* Header row */}
                            <div className={`${styles['sheet-header-cell']} ${styles['sheet-corner']}`} />
                            {tripDays.map((day, idx) => {
                                const isFocused = isSameDay(day, focusedDate);
                                const dateStr = format(day, 'yyyy-MM-dd');
                                const dayLocation = selectedTrip?.dayLocations?.[dateStr] ?? '';
                                return (
                                    <div key={idx} className={`${styles['sheet-header-cell']} ${isFocused ? styles['focused'] : ''}`}>
                                        <span className={styles['sheet-day-label']}>Day {idx + 1}</span>
                                        <span className={styles['sheet-day-date']}>{format(day, 'EEE, MMM d')}</span>
                                        <div className={styles['sheet-day-location']}>
                                            <MapPin size={10} />
                                            <input
                                                type="text"
                                                className={styles['day-location-input']}
                                                placeholder="Location..."
                                                defaultValue={dayLocation}
                                                key={`${selectedTripId}-${dateStr}`}
                                                onBlur={e => {
                                                    const val = e.target.value.trim();
                                                    if (val !== dayLocation) handleUpdateDayLocation(dateStr, val);
                                                }}
                                                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Time slot rows */}
                            {TIME_SLOTS.map(slot => (
                                <React.Fragment key={slot.key}>
                                    <div className={`${styles['sheet-row-label']} ${styles[`slot-${slot.key}`]}`} title={slot.label}>
                                        <span className={styles['slot-icon']}>{slot.icon}</span>
                                        <span className={styles['slot-text']}>{slot.label}</span>
                                    </div>
                                    {tripDays.map((day) => {
                                        const dateStr = format(day, 'yyyy-MM-dd');
                                        const ck = cellKey(dateStr, slot.key);
                                        const cellActivities = getCell(dateStr, slot.key);
                                        const isDragOver = dragOverCell === ck;
                                        const isFocused = isSameDay(day, focusedDate);

                                        return (
                                            <div
                                                key={ck}
                                                className={`${styles['sheet-cell']} ${isDragOver ? styles['drag-over'] : ''} ${isFocused ? styles['focused'] : ''}`}
                                                onDragOver={e => handleDragOver(e, ck)}
                                                onDragLeave={handleDragLeave}
                                                onDrop={e => handleDrop(e, dateStr, slot.key)}
                                                onClick={(e) => {
                                                    if ((e.target as HTMLElement).closest('[class*="sheet-activity"]')) return;
                                                    setAddingCell({ date: dateStr, slot: slot.key });
                                                }}
                                            >
                                                {cellActivities.map(act => (
                                                    <div
                                                        key={act.id}
                                                        className={styles['sheet-activity']}
                                                        draggable
                                                        onDragStart={e => handleDragStart(e, act)}
                                                        onClick={(e) => { e.stopPropagation(); setEditingActivity(act); }}
                                                        style={{ borderLeftColor: act.color ?? CATEGORY_COLORS[act.category || 'other'] }}
                                                    >
                                                        <span className={styles['sheet-act-emoji']}>{CATEGORY_EMOJIS[act.category || 'other']}</span>
                                                        <div className={styles['sheet-act-info']}>
                                                            <span className={styles['sheet-act-title']}>{act.title}</span>
                                                            {act.time && <span className={styles['sheet-act-time']}>{act.time}</span>}
                                                        </div>
                                                    </div>
                                                ))}
                                                <span className={`${styles['sheet-cell-placeholder']} ${cellActivities.length > 0 ? styles['has-items'] : ''}`}>+</span>
                                            </div>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {!selectedTrip && (
                <div className={styles['empty-state']}>
                    <div className={styles['empty-icon']}>📊</div>
                    <h2>Select a trip</h2>
                    <p>Click a trip card above to view its schedule.</p>
                </div>
            )}

            {/* Modal for editing an existing activity */}
            {editingActivity && selectedTripId && createPortal(
                <div className={styles['sheet-modal-overlay']} onClick={() => setEditingActivity(null)}>
                    <div className={styles['sheet-modal']} onClick={e => e.stopPropagation()}>
                        <ActivityForm
                            tripId={selectedTripId}
                            date={editingActivity.date}
                            existingActivity={editingActivity}
                            nextOrder={editingActivity.order}
                            defaultCurrency={selectedTrip?.defaultCurrency}
                            onSave={handleSaveActivity}
                            onCancel={() => setEditingActivity(null)}
                            onDelete={() => handleDeleteFromModal(editingActivity.id)}
                        />
                    </div>
                </div>,
                document.body,
            )}

            {/* Modal for adding a new activity from a cell */}
            {addingCell && selectedTripId && createPortal(
                <div className={styles['sheet-modal-overlay']} onClick={() => setAddingCell(null)}>
                    <div className={styles['sheet-modal']} onClick={e => e.stopPropagation()}>
                        <ActivityForm
                            tripId={selectedTripId}
                            date={addingCell.date}
                            nextOrder={getCell(addingCell.date, addingCell.slot).length}
                            defaultCurrency={selectedTrip?.defaultCurrency}
                            onSave={handleSaveActivity}
                            onCancel={() => setAddingCell(null)}
                        />
                    </div>
                </div>,
                document.body,
            )}

            {sharingTrip && (
                <ShareModal
                    trip={sharingTrip}
                    onClose={() => setSharingTrip(null)}
                />
            )}
        </div>
    );
};

export default SpreadsheetView;
