import React, { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { useTrips, useActivities } from '../lib/store';
import type { Activity } from '../lib/types';
import { CATEGORY_EMOJIS, CATEGORY_COLORS } from '../lib/types';
import { useLocalStorageState } from '../lib/persist';
import ActivityForm from '../components/ActivityForm';
import { logEvent } from '../lib/amplitude';
import './SpreadsheetView.css';

type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'unscheduled';

const TIME_SLOTS: { key: TimeSlot; label: string; default: string }[] = [
    { key: 'morning', label: 'Morning', default: '09:00' },
    { key: 'afternoon', label: 'Afternoon', default: '13:00' },
    { key: 'evening', label: 'Evening', default: '18:00' },
    { key: 'unscheduled', label: 'Unscheduled', default: '' },
];

function getTimeSlot(time?: string): TimeSlot {
    if (!time) return 'unscheduled';
    const [h] = time.split(':').map(Number);
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
}

const SpreadsheetView: React.FC = () => {
    const { trips } = useTrips();
    const { activities, addActivity, updateActivity, deleteActivity } = useActivities();

    const [selectedTripId, setSelectedTripId] = useLocalStorageState<string | null>(
        'travelplanner_spreadsheet_selectedTripId',
        null,
    );

    const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
    const [addingCell, setAddingCell] = useState<{ date: string; slot: TimeSlot } | null>(null);
    const [dragOverCell, setDragOverCell] = useState<string | null>(null);

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

    const handleSaveActivity = (data: Omit<Activity, 'id'> | ({ id: string } & Partial<Activity>)) => {
        if ('id' in data) {
            updateActivity(data.id, data);
            logEvent('Activity Updated', { activity_title: data.title, source: 'spreadsheet' });
        } else {
            addActivity(data);
            logEvent('Activity Created', { activity_title: data.title, date: data.date, source: 'spreadsheet' });
        }
        setEditingActivity(null);
        setAddingCell(null);
    };

    const handleDeleteFromModal = (id: string) => {
        const act = tripActivities.find(a => a.id === id);
        deleteActivity(id);
        logEvent('Activity Deleted', { activity_title: act?.title, source: 'spreadsheet' });
        setEditingActivity(null);
    };

    const cellKey = (dateStr: string, slot: TimeSlot) => `${dateStr}__${slot}`;

    if (trips.length === 0) {
        return (
            <div className="page-container animate-fade-in">
                <div className="empty-state">
                    <div className="empty-icon">📊</div>
                    <h2>No trips yet</h2>
                    <p>Create a trip from the Itinerary page to use the spreadsheet view.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container animate-fade-in spreadsheet-page">
            <header className="page-header">
                <div>
                    <h1>Spreadsheet</h1>
                    <p>Plan your days at a glance.</p>
                </div>
            </header>

            <div className="spreadsheet-controls">
                <select
                    className="input-field"
                    value={selectedTripId || ''}
                    onChange={e => setSelectedTripId(e.target.value || null)}
                >
                    <option value="">Select a trip...</option>
                    {trips.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>
            </div>

            {selectedTrip && tripDays.length > 0 && (
                <div className="spreadsheet-wrapper">
                    <div
                        className="spreadsheet-grid"
                        style={{ gridTemplateColumns: `100px repeat(${tripDays.length}, minmax(140px, 1fr))` }}
                    >
                        {/* Header row */}
                        <div className="sheet-header-cell sheet-corner" />
                        {tripDays.map((day, idx) => (
                            <div key={idx} className="sheet-header-cell">
                                <span className="sheet-day-label">Day {idx + 1}</span>
                                <span className="sheet-day-date">{format(day, 'EEE, MMM d')}</span>
                            </div>
                        ))}

                        {/* Time slot rows */}
                        {TIME_SLOTS.map(slot => (
                            <React.Fragment key={slot.key}>
                                <div className={`sheet-row-label slot-${slot.key}`}>
                                    {slot.label}
                                </div>
                                {tripDays.map((day) => {
                                    const dateStr = format(day, 'yyyy-MM-dd');
                                    const ck = cellKey(dateStr, slot.key);
                                    const cellActivities = getCell(dateStr, slot.key);
                                    const isDragOver = dragOverCell === ck;

                                    return (
                                        <div
                                            key={ck}
                                            className={`sheet-cell ${isDragOver ? 'drag-over' : ''}`}
                                            onDragOver={e => handleDragOver(e, ck)}
                                            onDragLeave={handleDragLeave}
                                            onDrop={e => handleDrop(e, dateStr, slot.key)}
                                            onClick={(e) => {
                                                if ((e.target as HTMLElement).closest('.sheet-activity')) return;
                                                setAddingCell({ date: dateStr, slot: slot.key });
                                            }}
                                        >
                                            {cellActivities.map(act => (
                                                <div
                                                    key={act.id}
                                                    className="sheet-activity"
                                                    draggable
                                                    onDragStart={e => handleDragStart(e, act)}
                                                    onClick={(e) => { e.stopPropagation(); setEditingActivity(act); }}
                                                    style={{ borderLeftColor: act.color ?? CATEGORY_COLORS[act.category || 'other'] }}
                                                >
                                                    <span className="sheet-act-emoji">{CATEGORY_EMOJIS[act.category || 'other']}</span>
                                                    <div className="sheet-act-info">
                                                        <span className="sheet-act-title">{act.title}</span>
                                                        {act.time && <span className="sheet-act-time">{act.time}</span>}
                                                    </div>
                                                </div>
                                            ))}
                                            <span className={`sheet-cell-placeholder ${cellActivities.length > 0 ? 'has-items' : ''}`}>+</span>
                                        </div>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            )}

            {!selectedTrip && (
                <div className="empty-state">
                    <div className="empty-icon">📊</div>
                    <h2>Select a trip</h2>
                    <p>Choose a trip above to see your itinerary in spreadsheet format.</p>
                </div>
            )}

            {/* Modal for editing an existing activity */}
            {editingActivity && selectedTripId && createPortal(
                <div className="sheet-modal-overlay" onClick={() => setEditingActivity(null)}>
                    <div className="sheet-modal" onClick={e => e.stopPropagation()}>
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
                <div className="sheet-modal-overlay" onClick={() => setAddingCell(null)}>
                    <div className="sheet-modal" onClick={e => e.stopPropagation()}>
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
        </div>
    );
};

export default SpreadsheetView;
