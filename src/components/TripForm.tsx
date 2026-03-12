import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { Trip } from '../lib/types';
import { TRIP_COLORS } from '../lib/types';
import { logEvent } from '../lib/amplitude';
import Markdown from './Markdown';
import { generateTripAutofillSuggestion } from '../lib/ai/actions/forms';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'] as const;

interface TripFormProps {
    existing?: Trip;
    onSave: (trip: Omit<Trip, 'id' | 'userId' | 'members' | 'sharedWithEmails'> | (Pick<Trip, 'id'> & Partial<Omit<Trip, 'id' | 'userId'>>)) => void;
    onCancel: () => void;
}

const TripForm: React.FC<TripFormProps> = ({ existing, onSave, onCancel }) => {
    const [name, setName] = useState(existing?.name || '');
    const [startDate, setStartDate] = useState(existing?.startDate || '');
    const [endDate, setEndDate] = useState(existing?.endDate || '');
    const [description, setDescription] = useState(existing?.description || '');
    const [defaultCurrency, setDefaultCurrency] = useState(existing?.defaultCurrency || 'USD');
    const [color, setColor] = useState(existing?.color || TRIP_COLORS[0]);
    const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    const handleAiAutofill = async () => {
        if (!name.trim()) return;
        setAiLoading(true);
        setAiError(null);
        setAiSuggestion(null);
        logEvent('AI Trip Autofill Requested', { trip_name: name.trim() });
        try {
            const text = await generateTripAutofillSuggestion({
                name,
                startDate,
                endDate,
            });
            setAiSuggestion(text);
        } catch (e) {
            setAiError(e instanceof Error ? e.message : 'AI suggestion failed');
        } finally {
            setAiLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !startDate || !endDate) return;
        onSave({
            ...(existing ? { id: existing.id } : {}),
            name: name.trim(),
            startDate,
            endDate,
            description: description.trim() || undefined,
            defaultCurrency: defaultCurrency || undefined,
            color: color || undefined,
        });
    };

    return (
        <form className="activity-form animate-fade-in" onSubmit={handleSubmit} noValidate>
            <div className="input-group">
                <label className="input-label">Trip Name *</label>
                <input className="input-field" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Summer in Italy" required autoFocus />
            </div>
            <div className="form-row">
                <div className="input-group" style={{ flex: 1 }}>
                    <label className="input-label">Start Date *</label>
                    <input className="input-field" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                    <label className="input-label">End Date *</label>
                    <input className="input-field" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required min={startDate} />
                </div>
            </div>
            <div className="form-row">
                <div className="input-group" style={{ flex: 1 }}>
                    <label className="input-label">Default currency</label>
                    <select className="input-field" value={defaultCurrency} onChange={e => setDefaultCurrency(e.target.value)}>
                        {CURRENCIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                    <label className="input-label">Trip color</label>
                    <div className="trip-color-picker">
                        {TRIP_COLORS.map((c) => (
                            <button
                                key={c}
                                type="button"
                                className={`trip-color-swatch ${color === c ? 'active' : ''}`}
                                style={{ backgroundColor: c }}
                                onClick={() => setColor(c)}
                                aria-label={`Color ${c}`}
                            />
                        ))}
                    </div>
                </div>
            </div>
            <div className="input-group">
                <label className="input-label">Description</label>
                <textarea className="input-field textarea" value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description..." rows={2} />
                {name.trim() && (
                    <div className="ai-suggestion-block">
                        <button
                            type="button"
                            className="btn btn-sm ai-suggest-btn"
                            onClick={handleAiAutofill}
                            disabled={aiLoading}
                        >
                            {aiLoading ? <><Loader2 size={14} className="spin" /> Generating ideas…</> : 'Suggest activities for destination'}
                        </button>
                        {aiError && <p className="ai-error">{aiError}</p>}
                        {aiSuggestion && (
                            <div className="ai-suggestion-card card" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                <Markdown className="ai-suggestion-text">{aiSuggestion}</Markdown>
                                <div className="ai-suggestion-actions">
                                    <button type="button" className="btn btn-primary btn-sm" onClick={() => { setDescription(aiSuggestion); setAiSuggestion(null); logEvent('AI Trip Autofill Accepted', { trip_name: name.trim() }); }}>Use as description</button>
                                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setAiSuggestion(null); logEvent('AI Trip Autofill Declined', { trip_name: name.trim() }); }}>Dismiss</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!name.trim() || !startDate || !endDate}>
                    {existing ? 'Save Changes' : 'Create Trip'}
                </button>
            </div>
        </form>
    );
};

export default TripForm;
