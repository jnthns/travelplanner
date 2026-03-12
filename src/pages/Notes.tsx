import React, { useState, useMemo, useCallback } from 'react';
import { Plus, Pencil, Trash2, GripVertical, Copy, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { eachDayOfInterval, format, isSameDay, parseISO } from 'date-fns';
import { useTrips, useNotes } from '../lib/store';
import type { Note } from '../lib/types';
import { useLocalStorageState } from '../lib/persist';
import DraggableList from '../components/DraggableList';
import NoteEditor from '../components/NoteEditor';
import NoteCard from '../components/NoteCard';
import { useToast } from '../components/Toast';
import { logEvent } from '../lib/amplitude';

type NotesFilterMode = 'all' | 'general' | 'day';

const Notes: React.FC = () => {
    const { trips } = useTrips();
    const { addNote, updateNote, deleteNote, restoreNote, reorderNotes, getNotesByTrip } = useNotes();
    const { showToast } = useToast();

    const [selectedTripId, setSelectedTripId] = useLocalStorageState<string | null>(
        'travelplanner_notes_selectedTripId', null,
    );
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [showNewForm, setShowNewForm] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [filterMode, setFilterMode] = useState<NotesFilterMode>('all');
    const [focusedDay, setFocusedDay] = useState<Date>(() => new Date());

    const selectedTrip = trips.find(t => t.id === selectedTripId);
    const tripNotes = useMemo(() => {
        if (!selectedTripId) return [];
        return getNotesByTrip(selectedTripId);
    }, [selectedTripId, getNotesByTrip]);

    const tripDays = useMemo(() => {
        if (!selectedTrip?.startDate || !selectedTrip?.endDate) return [];
        try {
            return eachDayOfInterval({ start: parseISO(selectedTrip.startDate), end: parseISO(selectedTrip.endDate) });
        } catch {
            return [];
        }
    }, [selectedTrip?.startDate, selectedTrip?.endDate]);

    const dayFilterDateStr = useMemo(() => format(focusedDay, 'yyyy-MM-dd'), [focusedDay]);

    const filteredNotes = useMemo(() => {
        if (filterMode === 'general') return tripNotes.filter(n => !n.date);
        if (filterMode === 'day') return tripNotes.filter(n => n.date === dayFilterDateStr);
        return tripNotes;
    }, [tripNotes, filterMode, dayFilterDateStr]);

    const handleAddNote = useCallback(async (data: { content: string; format: Note['format']; color?: string; images?: string[] }) => {
        if (!selectedTripId) return;
        setError(null);
        try {
            const now = new Date().toISOString();
            await addNote({
                tripId: selectedTripId,
                date: filterMode === 'day' ? dayFilterDateStr : undefined,
                content: data.content,
                format: data.format,
                order: tripNotes.length,
                color: data.color,
                images: data.images && data.images.length > 0 ? data.images : undefined,
                createdAt: now,
                updatedAt: now,
            } as Omit<import('../lib/types').Note, 'id' | 'userId' | 'tripMembers'>, selectedTrip?.members || []);
            setShowNewForm(false);
            logEvent('Note Created', { trip_id: selectedTripId, format: data.format, image_count: data.images?.length ?? 0 });
        } catch (err) {
            console.error('Failed to add note:', err);
            setError(err instanceof Error ? err.message : 'Failed to save note. Check your connection and try again.');
        }
    }, [selectedTripId, tripNotes.length, addNote, selectedTrip, filterMode, dayFilterDateStr]);

    const handleUpdateNote = useCallback(async (id: string, data: Partial<Note>) => {
        setError(null);
        try {
            await updateNote(id, { ...data, updatedAt: new Date().toISOString() });
            setEditingNoteId(null);
            logEvent('Note Updated', { note_id: id });
        } catch (err) {
            console.error('Failed to update note:', err);
            setError(err instanceof Error ? err.message : 'Failed to update note. Check your connection and try again.');
        }
    }, [updateNote]);

    const handleDeleteNote = useCallback(async (note: Note) => {
        setError(null);
        try {
            await deleteNote(note.id);
            logEvent('Note Deleted', { note_id: note.id });
            showToast(`"${note.title}" deleted`, () => {
                restoreNote(note);
                logEvent('Note Delete Undone', { note_id: note.id });
            });
            if (editingNoteId === note.id) setEditingNoteId(null);
        } catch (err) {
            console.error('Failed to delete note:', err);
            setError(err instanceof Error ? err.message : 'Failed to delete note.');
        }
    }, [deleteNote, restoreNote, showToast, editingNoteId]);

    const handleReorder = useCallback((reordered: Note[]) => {
        const updates = reordered
            .map((n, idx) => ({ id: n.id, order: idx }))
            .filter((u, idx) => reordered[idx].order !== u.order);
        if (updates.length > 0) {
            reorderNotes(updates);
            logEvent('Notes Reordered', { count: updates.length });
        }
    }, [reorderNotes]);

    const handleCopyNote = useCallback((content: string, id: string) => {
        navigator.clipboard.writeText(content).then(() => {
            setCopiedId(id);
            showToast('Note copied to clipboard');
            logEvent('Note Copied');
            setTimeout(() => setCopiedId(null), 2000);
        });
    }, [showToast]);

    return (
        <div className="page-container animate-fade-in">
            <header className="page-header">
                <div>
                    <h1>Notes</h1>
                    <p>Jot down travel plans, packing lists, or anything else.</p>
                </div>
            </header>

            <div className="flex flex-wrap items-center gap-md mb-xl">
                <select
                    className="input-field"
                    style={{ flex: '1 1 120px', maxWidth: '250px' }}
                    value={selectedTripId || ''}
                    onChange={e => {
                        setSelectedTripId(e.target.value || null);
                        setShowNewForm(false);
                        setEditingNoteId(null);
                        setFilterMode('all');
                    }}
                >
                    <option value="">Select a trip...</option>
                    {trips.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {selectedTrip && (
                    <button className="btn btn-primary" onClick={() => { setShowNewForm(true); setEditingNoteId(null); }}>
                        <Plus size={18} /> New Note
                    </button>
                )}
            </div>

            {selectedTrip && (
                <div className="flex flex-wrap items-center gap-sm mb-lg">
                    <div className="flex items-center gap-xs">
                        <button
                            type="button"
                            className={`btn btn-sm ${filterMode === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setFilterMode('all')}
                        >
                            All
                        </button>
                        <button
                            type="button"
                            className={`btn btn-sm ${filterMode === 'general' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setFilterMode('general')}
                        >
                            General
                        </button>
                        <button
                            type="button"
                            className={`btn btn-sm ${filterMode === 'day' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setFilterMode('day')}
                        >
                            Day
                        </button>
                    </div>

                    {filterMode === 'day' && tripDays.length > 0 && (
                        <div className="flex items-center gap-xs">
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => {
                                    const idx = tripDays.findIndex(d => isSameDay(d, focusedDay));
                                    const next = idx <= 0 ? tripDays[0] : tripDays[idx - 1];
                                    setFocusedDay(next);
                                }}
                                aria-label="Previous day"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="text-sm font-medium" style={{ minWidth: 160, textAlign: 'center' }}>
                                {format(focusedDay, 'EEE, MMM d')}
                            </span>
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => {
                                    const idx = tripDays.findIndex(d => isSameDay(d, focusedDay));
                                    const next = idx < 0 || idx >= tripDays.length - 1 ? tripDays[tripDays.length - 1] : tripDays[idx + 1];
                                    setFocusedDay(next);
                                }}
                                aria-label="Next day"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {error && (
                <div className="flex items-center justify-between gap-md p-md mb-md rounded-md font-medium text-sm text-danger" style={{ backgroundColor: 'color-mix(in srgb, var(--error-color) 10%, var(--surface-color))', border: '1px solid color-mix(in srgb, var(--error-color) 30%, transparent)' }}>
                    <span>{error}</span>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setError(null)}>Dismiss</button>
                </div>
            )}

            {!selectedTrip && (
                <div className="text-center p-xl mx-auto" style={{ maxWidth: '400px' }}>
                    <div className="text-xl mb-md" style={{ fontSize: '3rem', lineHeight: 1 }}>📝</div>
                    <h2 className="mb-sm">Select a trip</h2>
                    <p>Choose a trip above to view or create notes.</p>
                </div>
            )}

            {selectedTrip && showNewForm && (
                <NoteEditor
                    tripId={selectedTripId!}
                    onSave={handleAddNote}
                    onCancel={() => setShowNewForm(false)}
                />
            )}

            {selectedTrip && filteredNotes.length === 0 && !showNewForm && (
                <div className="text-center p-xl mx-auto" style={{ maxWidth: '400px' }}>
                    <div className="text-xl mb-md" style={{ fontSize: '3rem', lineHeight: 1 }}>📝</div>
                    <h2 className="mb-sm">No notes yet</h2>
                    <p>Add your first note to start organizing your trip thoughts.</p>
                </div>
            )}

            {selectedTrip && filteredNotes.length > 0 && (
                <DraggableList
                    items={filteredNotes}
                    keyFn={n => n.id}
                    onReorder={handleReorder}
                    disabled={editingNoteId !== null}
                    className="grid grid-cols-auto-280 gap-md"
                    renderItem={(note, _idx, dragHandleProps) => (
                        editingNoteId === note.id ? (
                            <div className="note-editor-wrap">
                                <NoteEditor
                                    existingNote={note}
                                    onSave={(data) => handleUpdateNote(note.id, data)}
                                    onCancel={() => setEditingNoteId(null)}
                                    onDelete={() => handleDeleteNote(note)}
                                />
                            </div>
                        ) : (
                            <NoteCard
                                note={note}
                                actions={
                                    <>
                                        <button className="btn btn-ghost btn-sm" onClick={() => handleCopyNote(note.content, note.id)} title="Copy content">
                                            {copiedId === note.id ? <Check size={14} className="text-secondary" /> : <Copy size={14} />}
                                        </button>
                                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingNoteId(note.id)} aria-label="Edit note">
                                            <Pencil size={14} />
                                        </button>
                                        <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteNote(note)} aria-label="Delete note">
                                            <Trash2 size={14} />
                                        </button>
                                    </>
                                }
                                dragHandle={
                                    <span className="cursor-grab text-tertiary shrink-0 p-xs" {...dragHandleProps}>
                                        <GripVertical size={16} />
                                    </span>
                                }
                            />
                        )
                    )}
                />
            )}
        </div>
    );
};

export default Notes;
