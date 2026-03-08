import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Plus, Pencil, Trash2, GripVertical, List, ListOrdered, AlignLeft, ImagePlus, X, Loader2, Copy, Check } from 'lucide-react';
import { useTrips, useNotes } from '../lib/store';
import type { Note } from '../lib/types';
import { NOTE_COLORS } from '../lib/types';
import { uploadNoteImage } from '../lib/upload';
import { useLocalStorageState } from '../lib/persist';
import DraggableList from '../components/DraggableList';
import Markdown from '../components/Markdown';
import { useToast } from '../components/Toast';
import { logEvent } from '../lib/amplitude';

const FORMAT_OPTIONS: { value: Note['format']; label: string; icon: React.ReactNode }[] = [
    { value: 'freeform', label: 'Freeform', icon: <AlignLeft size={14} /> },
    { value: 'bullet', label: 'Bullets', icon: <List size={14} /> },
    { value: 'numbered', label: 'Numbered', icon: <ListOrdered size={14} /> },
];

function renderContent(content: string, fmt: Note['format']): React.ReactNode {
    if (!content.trim()) return <span className="text-tertiary italic">Empty note</span>;
    const lines = content.split('\n');
    if (fmt === 'bullet') {
        return (
            <ul className="pl-6 m-0 list-disc">
                {lines.map((line, i) => line.trim() ? <li key={i} className="mb-1">{line}</li> : null)}
            </ul>
        );
    }
    if (fmt === 'numbered') {
        return (
            <ol className="pl-6 m-0 list-decimal">
                {lines.map((line, i) => line.trim() ? <li key={i} className="mb-1">{line}</li> : null)}
            </ol>
        );
    }
    return <Markdown>{content}</Markdown>;
}

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

    const selectedTrip = trips.find(t => t.id === selectedTripId);
    const tripNotes = useMemo(() => {
        if (!selectedTripId) return [];
        return getNotesByTrip(selectedTripId);
    }, [selectedTripId, getNotesByTrip]);

    const handleAddNote = useCallback(async (data: { title: string; content: string; format: Note['format']; color?: string; images?: string[] }) => {
        if (!selectedTripId) return;
        setError(null);
        try {
            const now = new Date().toISOString();
            await addNote({
                tripId: selectedTripId,
                title: data.title.trim() || 'Untitled',
                content: data.content,
                format: data.format,
                order: tripNotes.length,
                color: data.color,
                images: data.images && data.images.length > 0 ? data.images : undefined,
                createdAt: now,
                updatedAt: now,
            });
            setShowNewForm(false);
            logEvent('Note Created', { trip_id: selectedTripId, format: data.format, image_count: data.images?.length ?? 0 });
        } catch (err) {
            console.error('Failed to add note:', err);
            setError(err instanceof Error ? err.message : 'Failed to save note. Check your connection and try again.');
        }
    }, [selectedTripId, tripNotes.length, addNote]);

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
                    onChange={e => setSelectedTripId(e.target.value || null)}
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

            {selectedTrip && tripNotes.length === 0 && !showNewForm && (
                <div className="text-center p-xl mx-auto" style={{ maxWidth: '400px' }}>
                    <div className="text-xl mb-md" style={{ fontSize: '3rem', lineHeight: 1 }}>📝</div>
                    <h2 className="mb-sm">No notes yet</h2>
                    <p>Add your first note to start organizing your trip thoughts.</p>
                </div>
            )}

            {selectedTrip && tripNotes.length > 0 && (
                <DraggableList
                    items={tripNotes}
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
                            <div className="card p-md flex flex-col h-full hover:shadow-md transition-shadow" style={{ borderTop: note.color ? `3px solid ${note.color}` : '3px solid var(--border-light)' }}>
                                <div className="flex items-center gap-xs mb-sm">
                                    <span className="cursor-grab text-tertiary shrink-0 p-xs" {...dragHandleProps}>
                                        <GripVertical size={16} />
                                    </span>
                                    <h3 className="flex-1 text-base font-bold text-primary truncate">{note.title || 'Untitled'}</h3>
                                    <div className="flex gap-xs shrink-0">
                                        <button className="btn btn-ghost btn-sm" onClick={() => handleCopyNote(note.content, note.id)} title="Copy content">
                                            {copiedId === note.id ? <Check size={14} className="text-secondary" /> : <Copy size={14} />}
                                        </button>
                                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingNoteId(note.id)}>
                                            <Pencil size={14} />
                                        </button>
                                        <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteNote(note)}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div className="text-sm text-secondary flex-1" style={{ lineHeight: 1.55, wordWrap: 'break-word', overflowWrap: 'break-word' }}>
                                    {renderContent(note.content, note.format)}
                                </div>
                                {note.images && note.images.length > 0 && (
                                    <div className="flex flex-wrap gap-xs mt-sm">
                                        {note.images.map((url, i) => (
                                            <img key={i} src={url} alt="" className="rounded-sm object-cover cursor-pointer transition-opacity hover:opacity-85" style={{ maxWidth: '100%', maxHeight: '200px' }} loading="lazy" />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    )}
                />
            )}
        </div>
    );
};

// --- Note Editor ---
interface NoteEditorProps {
    existingNote?: Note;
    tripId?: string;
    onSave: (data: { title: string; content: string; format: Note['format']; color?: string; images?: string[] }) => void;
    onCancel: () => void;
    onDelete?: () => void;
}

const NoteEditor: React.FC<NoteEditorProps> = ({ existingNote, tripId, onSave, onCancel, onDelete }) => {
    const [title, setTitle] = useState(existingNote?.title || '');
    const [content, setContent] = useState(existingNote?.content || '');
    const [fmt, setFmt] = useState<Note['format']>(existingNote?.format || 'freeform');
    const [color, setColor] = useState(existingNote?.color || '');
    const [images, setImages] = useState<string[]>(existingNote?.images || []);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const effectiveTripId = existingNote?.tripId || tripId || '';
    const effectiveNoteId = existingNote?.id || 'new';

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ title: title.trim(), content, format: fmt, color: color || undefined, images: images.length > 0 ? images : undefined });
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setUploadError(null);
        setUploading(true);

        try {
            const newUrls: string[] = [];
            for (const file of Array.from(files)) {
                const url = await uploadNoteImage(effectiveTripId, effectiveNoteId, file);
                newUrls.push(url);
            }
            setImages(prev => [...prev, ...newUrls]);
            logEvent('Note Image Uploaded', { count: newUrls.length });
        } catch (err) {
            console.error('Image upload failed:', err);
            setUploadError(err instanceof Error ? err.message : 'Image upload failed.');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key !== 'Enter' || e.shiftKey) return;
        if (fmt === 'freeform') return;

        e.preventDefault();
        const ta = textareaRef.current;
        if (!ta) return;
        const { selectionStart, selectionEnd } = ta;
        const before = content.slice(0, selectionStart);
        const after = content.slice(selectionEnd);
        const newContent = before + '\n' + after;
        setContent(newContent);
        requestAnimationFrame(() => {
            ta.selectionStart = ta.selectionEnd = selectionStart + 1;
        });
    };

    return (
        <form className="note-editor card animate-fade-in" onSubmit={handleSubmit}>
            <input
                className="input-field note-title-input"
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Note title..."
                autoFocus
            />

            <div className="note-format-picker">
                {FORMAT_OPTIONS.map(opt => (
                    <button
                        key={opt.value}
                        type="button"
                        className={`format-chip ${fmt === opt.value ? 'active' : ''}`}
                        onClick={() => setFmt(opt.value)}
                    >
                        {opt.icon} {opt.label}
                    </button>
                ))}
            </div>

            <textarea
                ref={textareaRef}
                className="input-field note-content-input"
                value={content}
                onChange={e => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={fmt === 'bullet' ? 'Enter each item on a new line...' : fmt === 'numbered' ? 'Enter each step on a new line...' : 'Start typing...'}
                rows={6}
            />

            {/* Image upload */}
            <div className="note-image-section">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    multiple
                    hidden
                    onChange={handleFileSelect}
                />
                <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                >
                    {uploading ? <><Loader2 size={14} className="spin" /> Uploading...</> : <><ImagePlus size={14} /> Add images</>}
                </button>
                {uploadError && <span className="note-upload-error">{uploadError}</span>}
            </div>

            {images.length > 0 && (
                <div className="note-image-previews">
                    {images.map((url, i) => (
                        <div key={i} className="note-image-thumb">
                            <img src={url} alt="" />
                            <button type="button" className="note-image-remove" onClick={() => removeImage(i)} aria-label="Remove image">
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="note-color-picker">
                <button
                    type="button"
                    className={`note-color-swatch no-color ${!color ? 'active' : ''}`}
                    onClick={() => setColor('')}
                    aria-label="No color"
                />
                {NOTE_COLORS.map(c => (
                    <button
                        key={c}
                        type="button"
                        className={`note-color-swatch ${color === c ? 'active' : ''}`}
                        style={{ backgroundColor: c }}
                        onClick={() => setColor(c)}
                        aria-label={`Color ${c}`}
                    />
                ))}
            </div>

            <div className="form-actions">
                {onDelete && (
                    <button type="button" className="btn btn-danger btn-sm" onClick={onDelete}>
                        <Trash2 size={14} /> Delete
                    </button>
                )}
                <div className="form-actions-right">
                    <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={uploading}>
                        {existingNote ? 'Save' : 'Add Note'}
                    </button>
                </div>
            </div>
        </form>
    );
};

export default Notes;
