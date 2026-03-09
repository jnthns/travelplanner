import React from 'react';
import { X, Loader2, Sparkles, MapPin, Clock, CalendarDays, AlertTriangle, Check } from 'lucide-react';
import type { Activity } from '../lib/types';
import { CATEGORY_COLORS, CATEGORY_EMOJIS } from '../lib/types';

interface DraftReviewModalProps {
    isOpen: boolean;
    loading: boolean;
    error: string | null;
    originalActivities: Activity[];
    proposedActivities: Partial<Activity>[];
    onClose: () => void;
    onAccept: () => void;
    hasConcurrencyConflict: boolean;
}

export const DraftReviewModal: React.FC<DraftReviewModalProps> = ({
    isOpen,
    loading,
    error,
    proposedActivities,
    onClose,
    onAccept,
    hasConcurrencyConflict,
}) => {
    // Basic formatting helper
    const formatTime = (time?: string) => {
        if (!time) return '';
        const [h, m] = time.split(':');
        const hour = parseInt(h, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const formattedHour = hour % 12 || 12;
        return `${formattedHour}:${m} ${ampm}`;
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                <button className="modal-close" onClick={onClose} aria-label="Close">
                    <X size={20} />
                </button>

                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <Sparkles className="text-primary" size={24} />
                    AI Proposed Itinerary
                </h2>

                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', minHeight: '300px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
                            <Loader2 size={40} className="spin text-primary" style={{ marginBottom: '1rem' }} />
                            <p>Analyzing note and drafting itinerary changes...</p>
                            <p style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.5rem' }}>This usually takes about 10-15 seconds.</p>
                        </div>
                    ) : error ? (
                        <div className="empty-state" style={{ color: 'var(--danger-color)' }}>
                            <AlertTriangle size={48} style={{ marginBottom: '1rem' }} />
                            <p>We ran into an issue drafting your itinerary.</p>
                            <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>{error}</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="alert-box" style={{ padding: '0.75rem', backgroundColor: 'color-mix(in srgb, var(--primary-color) 15%, transparent)', borderRadius: 'var(--radius-md)', border: '1px solid var(--primary-color)' }}>
                                <strong>Review changes carefully.</strong> Accepting this draft will permanently replace the current activities for this trip.
                            </div>

                            {hasConcurrencyConflict && (
                                <div className="alert-box" style={{ padding: '0.75rem', backgroundColor: 'color-mix(in srgb, var(--danger-color) 15%, transparent)', borderRadius: 'var(--radius-md)', border: '1px solid var(--danger-color)', color: 'var(--danger-color)' }}>
                                    <AlertTriangle size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '0.5rem' }} />
                                    <strong>Conflict Detected:</strong> Your trip was modified in the background while this draft was generated. Please cancel and regenerate to prevent overwriting new data.
                                </div>
                            )}

                            {(() => {
                                if (proposedActivities.length === 0) return <p className="text-tertiary">No activities proposed.</p>;

                                // Group activities by date
                                const grouped = proposedActivities.reduce((acc, act) => {
                                    const d = act.date || 'Unscheduled';
                                    if (!acc[d]) acc[d] = [];
                                    acc[d].push(act);
                                    return acc;
                                }, {} as Record<string, Partial<Activity>[]>);

                                // Sort the dates (Unscheduled goes last)
                                const sortedDates = Object.keys(grouped).sort((a, b) => {
                                    if (a === 'Unscheduled') return 1;
                                    if (b === 'Unscheduled') return -1;
                                    return a.localeCompare(b);
                                });

                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                        {sortedDates.map(dateStr => (
                                            <div key={dateStr} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                <h3 style={{
                                                    margin: '0 0 -0.5rem 0',
                                                    paddingBottom: '0.5rem',
                                                    borderBottom: '2px solid var(--border-color)',
                                                    color: 'var(--text-primary)',
                                                    fontSize: '1.1rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem'
                                                }}>
                                                    <CalendarDays size={18} className="text-primary" />
                                                    {dateStr === 'Unscheduled' ? 'Dates TBD' : new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })}
                                                </h3>
                                                {grouped[dateStr].sort((a, b) => (a.time || '23:59').localeCompare(b.time || '23:59')).map((act, i) => (
                                                    <div key={i} className="card" style={{ borderLeft: `4px solid ${CATEGORY_COLORS[act.category || 'other'] || 'var(--border-color)'}`, display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem', boxShadow: 'var(--shadow-sm)' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                            <h4 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                                                                {CATEGORY_EMOJIS[act.category || 'other'] || '📌'} {act.title}
                                                            </h4>
                                                        </div>

                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                            {act.time && (
                                                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                                                                    <Clock size={14} /> {formatTime(act.time)}
                                                                </span>
                                                            )}
                                                            {act.location && (
                                                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                                    <MapPin size={14} /> {act.location}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {act.notes && (
                                                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.25rem', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                                                                {act.notes}
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>

                <div className="form-actions" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
                    <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading && !error}>
                        Cancel
                    </button>
                    {!loading && !error && (
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={onAccept}
                            disabled={hasConcurrencyConflict}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            <Check size={16} /> Accept Changes
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
