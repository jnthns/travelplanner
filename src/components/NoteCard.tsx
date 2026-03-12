import React from 'react';
import type { Note } from '../lib/types';
import Markdown from './Markdown';

function renderContent(content: string, fmt: Note['format']): React.ReactNode {
    if (!content.trim()) return <span className="text-tertiary italic">Empty note</span>;
    const lines = content.split('\n');
    if (fmt === 'bullet') {
        return (
            <ul className="pl-6 m-0 list-disc">
                {lines.map((line, i) => (line.trim() ? <li key={i} className="mb-1">{line}</li> : null))}
            </ul>
        );
    }
    if (fmt === 'numbered') {
        return (
            <ol className="pl-6 m-0 list-decimal">
                {lines.map((line, i) => (line.trim() ? <li key={i} className="mb-1">{line}</li> : null))}
            </ol>
        );
    }
    return <Markdown>{content}</Markdown>;
}

export type NoteCardVariant = 'full' | 'compact';

export default function NoteCard({
    note,
    variant = 'full',
    hideImages = false,
    onClick,
    actions,
    dragHandle,
}: {
    note: Note;
    variant?: NoteCardVariant;
    hideImages?: boolean;
    onClick?: () => void;
    actions?: React.ReactNode;
    dragHandle?: React.ReactNode;
}) {
    const content = renderContent(note.content, note.format);
    const isCompact = variant === 'compact';

    return (
        <div
            className="card p-md flex flex-col h-full hover:shadow-md transition-shadow"
            style={{ borderTop: note.color ? `3px solid ${note.color}` : '3px solid var(--border-light)', cursor: onClick ? 'pointer' : undefined }}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
        >
            {(actions || dragHandle) && (
                <div className="flex items-center gap-xs mb-sm">
                    {dragHandle}
                    <div className="flex-1" />
                    <div className="flex gap-xs shrink-0" onClick={(e) => e.stopPropagation()}>
                        {actions}
                    </div>
                </div>
            )}

            <div
                className="text-sm text-secondary flex-1"
                style={{
                    lineHeight: 1.55,
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                    display: isCompact ? '-webkit-box' : undefined,
                    WebkitLineClamp: isCompact ? 4 : undefined,
                    WebkitBoxOrient: isCompact ? 'vertical' : undefined,
                    overflow: isCompact ? 'hidden' : undefined,
                }}
            >
                {content}
            </div>

            {!hideImages && note.images && note.images.length > 0 && (
                <div className="flex flex-wrap gap-xs mt-sm">
                    {note.images.map((url, i) => (
                        <img
                            key={i}
                            src={url}
                            alt=""
                            className="rounded-sm object-cover cursor-pointer transition-opacity hover:opacity-85"
                            style={{ maxWidth: '100%', maxHeight: '200px' }}
                            loading="lazy"
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

