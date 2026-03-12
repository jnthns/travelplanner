import React, { useRef, useState } from 'react';
import { AlignLeft, ImagePlus, List, ListOrdered, Loader2, Trash2, X } from 'lucide-react';
import type { Note } from '../lib/types';
import { NOTE_COLORS } from '../lib/types';
import { uploadNoteImage } from '../lib/upload';
import { logEvent } from '../lib/amplitude';

const FORMAT_OPTIONS: { value: Note['format']; label: string; icon: React.ReactNode }[] = [
    { value: 'freeform', label: 'Freeform', icon: <AlignLeft size={14} /> },
    { value: 'bullet', label: 'Bullets', icon: <List size={14} /> },
    { value: 'numbered', label: 'Numbered', icon: <ListOrdered size={14} /> },
];

export interface NoteEditorProps {
    existingNote?: Note;
    tripId?: string;
    onSave: (data: { content: string; format: Note['format']; color?: string; images?: string[] }) => void;
    onCancel: () => void;
    onDelete?: () => void;
}

const NoteEditor: React.FC<NoteEditorProps> = ({ existingNote, tripId, onSave, onCancel, onDelete }) => {
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
        onSave({
            content,
            format: fmt,
            color: color || undefined,
            images: images.length > 0 ? images : undefined,
        });
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
                autoFocus
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

export default NoteEditor;

