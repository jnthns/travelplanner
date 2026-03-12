import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { format, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { Plus, Users, Pencil, Trash2, ChevronLeft, ChevronRight, Sunrise, Sun, Sunset, StickyNote, Clock, MapPin } from 'lucide-react';
import { useTrips, useActivities, useNotes } from '../lib/store';
import { useAuth } from '../lib/AuthContext';
import type { Activity, Note, Trip } from '../lib/types';
import { CATEGORY_EMOJIS, CATEGORY_COLORS, TRIP_COLORS } from '../lib/types';
import { useLocalStorageState } from '../lib/persist';
import ActivityForm from '../components/ActivityForm';
import TripForm from '../components/TripForm';
import ShareModal from '../components/ShareModal';
import Markdown from '../components/Markdown';
import NoteCard from '../components/NoteCard';
import NoteEditor from '../components/NoteEditor';
import { useToast } from '../components/Toast';
import { logEvent } from '../lib/amplitude';
import styles from './SpreadsheetView.module.css';

type ActivitySlot = 'morning' | 'afternoon' | 'evening' | 'unscheduled';
type GridRow = 'morning' | 'afternoon' | 'evening' | 'notes';

const TIME_SLOTS: { key: Exclude<ActivitySlot, 'unscheduled'>; label: string; icon: React.ReactNode; default: string }[] = [
    { key: 'morning', label: 'Morning', icon: <Sunrise size={16} />, default: '09:00' },
    { key: 'afternoon', label: 'Afternoon', icon: <Sun size={16} />, default: '13:00' },
    { key: 'evening', label: 'Evening', icon: <Sunset size={16} />, default: '18:00' },
];

const GRID_ROWS: { key: GridRow; label: string; icon: React.ReactNode }[] = [
    { key: 'morning', label: 'Morning', icon: <Sunrise size={16} /> },
    { key: 'afternoon', label: 'Afternoon', icon: <Sun size={16} /> },
    { key: 'evening', label: 'Evening', icon: <Sunset size={16} /> },
    { key: 'notes', label: 'Notes', icon: <StickyNote size={16} /> },
];

function getTimeSlot(time?: string): ActivitySlot {
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
    const { trips, loading: tripsLoading, addTrip, updateTrip, deleteTrip, restoreTrip, updateItineraryDay } = useTrips();
    const { activities, addActivity, updateActivity, deleteActivity, restoreActivity, getActivitiesByTrip } = useActivities();
    const { addNote, updateNote, deleteNote, restoreNote, getNotesByTrip } = useNotes();
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
    const [addingCell, setAddingCell] = useState<{ date: string; slot: Exclude<ActivitySlot, 'unscheduled'> } | null>(null);
    const [dragOverCell, setDragOverCell] = useState<string | null>(null);
    const [focusedDate, setFocusedDate] = useState<Date>(() => new Date());
    const spreadsheetWrapperRef = useRef<HTMLDivElement>(null);
    const [unscheduledOpen, setUnscheduledOpen] = useState(true);

    const [quickNoteForDate, setQuickNoteForDate] = useState<string | null>(null);
    const [quickNoteContent, setQuickNoteContent] = useState('');
    const [editingNote, setEditingNote] = useState<Note | null>(null);

    const selectedTrip = trips.find(t => t.id === selectedTripId);

    const tripStartDate = selectedTrip?.startDate;
    const tripEndDate = selectedTrip?.endDate;
    const tripDays = useMemo(() => {
        if (!tripStartDate || !tripEndDate) return [];
        try {
            return eachDayOfInterval({
                start: parseISO(tripStartDate),
                end: parseISO(tripEndDate),
            });
        } catch { return []; }
    }, [tripStartDate, tripEndDate]);

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

    const getCell = useCallback((dateStr: string, slot: Exclude<ActivitySlot, 'unscheduled'>): Activity[] => {
        return tripActivities
            .filter(a => a.date === dateStr && getTimeSlot(a.time) === slot)
            .sort((a, b) => a.order - b.order);
    }, [tripActivities]);

    const tripNotes = useMemo(() => {
        if (!selectedTripId) return [];
        return getNotesByTrip(selectedTripId);
    }, [selectedTripId, getNotesByTrip]);

    const getNotesForDay = useCallback((dateStr: string): Note[] => {
        return tripNotes
            .filter(n => n.date === dateStr)
            .slice()
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }, [tripNotes]);

    const unscheduledActivitiesForFocusedDay = useMemo(() => {
        const dateStr = format(focusedDate, 'yyyy-MM-dd');
        return tripActivities
            .filter(a => a.date === dateStr && getTimeSlot(a.time) === 'unscheduled')
            .sort((a, b) => a.order - b.order);
    }, [tripActivities, focusedDate]);

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

    const handleDrop = (e: React.DragEvent, dateStr: string, slot: Exclude<ActivitySlot, 'unscheduled'>) => {
        e.preventDefault();
        setDragOverCell(null);
        const activityId = e.dataTransfer.getData('text/plain');
        if (!activityId) return;

        const activity = tripActivities.find(a => a.id === activityId);
        if (!activity) return;

        const slotMeta = TIME_SLOTS.find(s => s.key === slot);
        const newTime = slotMeta?.default;
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

    const cellKey = (dateStr: string, slot: Exclude<ActivitySlot, 'unscheduled'>) => `${dateStr}__${slot}`;

    const handleCreateQuickNote = useCallback(async (dateStr: string) => {
        if (!selectedTripId) return;
        const content = quickNoteContent.trim();
        if (!content) return;

        const now = new Date().toISOString();
        const trip = trips.find(t => t.id === selectedTripId);
        await addNote({
            tripId: selectedTripId,
            date: dateStr,
            content,
            format: 'freeform',
            order: tripNotes.length,
            createdAt: now,
            updatedAt: now,
        } as Omit<import('../lib/types').Note, 'id' | 'userId' | 'tripMembers'>, trip?.members || []);

        logEvent('Note Created', { trip_id: selectedTripId, source: 'spreadsheet', date: dateStr });
        setQuickNoteContent('');
        setQuickNoteForDate(null);
    }, [addNote, quickNoteContent, selectedTripId, trips, tripNotes.length]);

    const handleDeleteNoteFromModal = useCallback((note: Note) => {
        deleteNote(note.id);
        setEditingNote(null);
        logEvent('Note Deleted', { note_id: note.id, source: 'spreadsheet' });
        showToast('Note deleted', () => {
            restoreNote(note);
            logEvent('Note Delete Undone', { note_id: note.id });
        });
    }, [deleteNote, restoreNote, showToast]);

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

    const handleUpdateItineraryDay = useCallback((dateStr: string, updates: Partial<import('../lib/types').ItineraryDay>) => {
        if (!selectedTrip) return;
        updateItineraryDay(selectedTrip.id, dateStr, updates);
    }, [selectedTrip, updateItineraryDay]);

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
                                const dayData = selectedTrip?.itinerary?.[dateStr];
                                const dayLocation = dayData?.location ?? selectedTrip?.dayLocations?.[dateStr] ?? '';
                                const dayAccommodation = dayData?.accommodation;

                                return (
                                    <div key={idx} className={`${styles['sheet-header-cell']} ${isFocused ? styles['focused'] : ''}`}>
                                        <span className={styles['sheet-day-label']}>Day {idx + 1}</span>
                                        <span className={styles['sheet-day-date']}>{format(day, 'EEE, MMM d')}</span>

                                        <div className={styles['sheet-header-inputs']}>
                                            <div className={styles['sheet-day-location']}>
                                                <MapPin size={10} />
                                                <input
                                                    type="text"
                                                    className={styles['day-location-input']}
                                                    placeholder="Accommodation"
                                                    defaultValue={dayAccommodation?.name ?? ''}
                                                    key={`acc-name-${selectedTripId}-${dateStr}`}
                                                    onBlur={e => {
                                                        const val = e.target.value.trim();
                                                        if (val !== (dayAccommodation?.name ?? '')) {
                                                            handleUpdateItineraryDay(dateStr, { accommodation: { ...dayAccommodation, name: val } });
                                                        }
                                                    }}
                                                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                                />
                                            </div>

                                            <div className={styles['sheet-day-accommodation']}>
                                                <input
                                                    type="text"
                                                    className={styles['day-accommodation-input']}
                                                    placeholder="City"
                                                    defaultValue={dayLocation}
                                                    key={`loc-${selectedTripId}-${dateStr}`}
                                                    onBlur={e => {
                                                        const val = e.target.value.trim();
                                                        if (val !== dayLocation) handleUpdateItineraryDay(dateStr, { location: val });
                                                    }}
                                                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Time slot rows */}
                            {GRID_ROWS.map(row => (
                                <React.Fragment key={row.key}>
                                    <div className={`${styles['sheet-row-label']} ${styles[`slot-${row.key}`]}`} title={row.label}>
                                        <span className={styles['slot-icon']}>{row.icon}</span>
                                        <span className={styles['slot-text']}>{row.label}</span>
                                    </div>
                                    {tripDays.map((day) => {
                                        const dateStr = format(day, 'yyyy-MM-dd');
                                        const isFocused = isSameDay(day, focusedDate);

                                        if (row.key === 'notes') {
                                            const dayNotes = getNotesForDay(dateStr);
                                            const isQuickAddOpen = quickNoteForDate === dateStr;
                                            return (
                                                <div
                                                    key={`${dateStr}__notes`}
                                                    className={`${styles['sheet-cell']} ${isFocused ? styles['focused'] : ''}`}
                                                    onClick={(e) => {
                                                        if ((e.target as HTMLElement).closest('[data-note-card]')) return;
                                                        if ((e.target as HTMLElement).closest('textarea')) return;
                                                        setQuickNoteForDate(dateStr);
                                                    }}
                                                >
                                                    {dayNotes.map(n => (
                                                        <div
                                                            key={n.id}
                                                            className={styles['sheet-note']}
                                                            data-note-card
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditingNote(n);
                                                            }}
                                                        >
                                                            <NoteCard note={n} variant="compact" hideImages />
                                                        </div>
                                                    ))}

                                                    {isQuickAddOpen && (
                                                        <div className={styles['quick-note-wrap']} onClick={(e) => e.stopPropagation()}>
                                                            <textarea
                                                                className={styles['quick-note-textarea']}
                                                                value={quickNoteContent}
                                                                onChange={(e) => setQuickNoteContent(e.target.value)}
                                                                placeholder="Add a note for this day…"
                                                            />
                                                            <div className={styles['quick-note-actions']}>
                                                                <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setQuickNoteForDate(null); setQuickNoteContent(''); }}>
                                                                    Cancel
                                                                </button>
                                                                <button className="btn btn-primary btn-sm" type="button" onClick={() => handleCreateQuickNote(dateStr)} disabled={!quickNoteContent.trim()}>
                                                                    Add
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <span className={`${styles['sheet-cell-placeholder']} ${dayNotes.length > 0 ? styles['has-items'] : ''}`}>+</span>
                                                </div>
                                            );
                                        }

                                        const slotKey = row.key as Exclude<ActivitySlot, 'unscheduled'>;
                                        const ck = cellKey(dateStr, slotKey);
                                        const cellActivities = getCell(dateStr, slotKey);
                                        const isDragOver = dragOverCell === ck;

                                        return (
                                            <div
                                                key={ck}
                                                className={`${styles['sheet-cell']} ${isDragOver ? styles['drag-over'] : ''} ${isFocused ? styles['focused'] : ''}`}
                                                onDragOver={e => handleDragOver(e, ck)}
                                                onDragLeave={handleDragLeave}
                                                onDrop={e => handleDrop(e, dateStr, slotKey)}
                                                onClick={(e) => {
                                                    if ((e.target as HTMLElement).closest('[class*="sheet-activity"]')) return;
                                                    setAddingCell({ date: dateStr, slot: slotKey });
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

                    {/* Unscheduled activities (focused day) */}
                    <div className={styles['unscheduled-wrap']}>
                        <div
                            className={styles['unscheduled-header']}
                            role="button"
                            tabIndex={0}
                            onClick={() => setUnscheduledOpen(v => !v)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setUnscheduledOpen(v => !v); }}
                        >
                            <div className={styles['unscheduled-title']}>
                                <Clock size={16} />
                                Unscheduled activities ({unscheduledActivitiesForFocusedDay.length})
                            </div>
                            <button type="button" className="btn btn-ghost btn-sm">
                                {unscheduledOpen ? 'Hide' : 'Show'}
                            </button>
                        </div>
                        {unscheduledOpen && (
                            <div className={styles['unscheduled-list']}>
                                {unscheduledActivitiesForFocusedDay.length === 0 ? (
                                    <div className="text-secondary text-sm" style={{ padding: '0.25rem' }}>
                                        Nothing unscheduled for this day.
                                    </div>
                                ) : (
                                    unscheduledActivitiesForFocusedDay.map(act => (
                                        <div
                                            key={act.id}
                                            className={styles['sheet-activity']}
                                            draggable
                                            onDragStart={e => handleDragStart(e, act)}
                                            onClick={() => setEditingActivity(act)}
                                            style={{ borderLeftColor: act.color ?? CATEGORY_COLORS[act.category || 'other'] }}
                                        >
                                            <span className={styles['sheet-act-emoji']}>{CATEGORY_EMOJIS[act.category || 'other']}</span>
                                            <div className={styles['sheet-act-info']}>
                                                <span className={styles['sheet-act-title']}>{act.title}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
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

            {/* Modal for editing a note */}
            {editingNote && selectedTripId && createPortal(
                <div className={styles['sheet-modal-overlay']} onClick={() => setEditingNote(null)}>
                    <div className={styles['sheet-modal']} onClick={e => e.stopPropagation()}>
                        <NoteEditor
                            existingNote={editingNote}
                            onSave={(data) => {
                                updateNote(editingNote.id, { ...data, updatedAt: new Date().toISOString() });
                                setEditingNote(null);
                                logEvent('Note Updated', { note_id: editingNote.id, source: 'spreadsheet' });
                            }}
                            onCancel={() => setEditingNote(null)}
                            onDelete={() => handleDeleteNoteFromModal(editingNote)}
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
