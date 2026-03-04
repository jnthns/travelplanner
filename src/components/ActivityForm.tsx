import React, { useState } from 'react';
import type { Activity } from '../lib/types';
import { CATEGORY_EMOJIS, ACTIVITY_COLORS } from '../lib/types';
import { generateWithGemini } from '../lib/gemini';
import './ActivityForm.css';

interface ActivityFormProps {
    tripId: string;
    date: string;
    existingActivity?: Activity;
    nextOrder: number;
    defaultCurrency?: string;
    onSave: (activity: Omit<Activity, 'id'> | { id: string } & Partial<Activity>) => void;
    onCancel: () => void;
}

const categories = ['sightseeing', 'food', 'accommodation', 'transport', 'shopping', 'other'] as const;

const ActivityForm: React.FC<ActivityFormProps> = ({ tripId, date, existingActivity, nextOrder, defaultCurrency, onSave, onCancel }) => {
    const [title, setTitle] = useState(existingActivity?.title || '');
    const [details, setDetails] = useState(existingActivity?.details || '');
    const [time, setTime] = useState(existingActivity?.time || '');
    const [location, setLocation] = useState(existingActivity?.location || '');
    const [category, setCategory] = useState<Activity['category']>(existingActivity?.category || 'other');
    const [cost, setCost] = useState(existingActivity?.cost?.toString() || '');
    const [currency, setCurrency] = useState(existingActivity?.currency || defaultCurrency || 'USD');
    const [notes, setNotes] = useState(existingActivity?.notes || '');
    const [color, setColor] = useState(existingActivity?.color || '');
    const [showOptional, setShowOptional] = useState(!!existingActivity);
    const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    const handleAiSuggest = async () => {
        if (!title.trim()) return;
        setAiLoading(true);
        setAiError(null);
        setAiSuggestion(null);
        const prompt = `You are a travel assistant. For this activity: "${title.trim()}".

Write a single paragraph (max 200 words) that:
1. Describes the activity clearly with factual, useful context.
2. Includes brief travel tips to optimize and get the most out of the experience.

Use only factual language. No superlatives (avoid "best", "amazing", "must-see"). Be direct and informative. Output only the paragraph, no headings or labels.`;
        try {
            const text = await generateWithGemini(prompt, 400);
            setAiSuggestion(text);
        } catch (e) {
            setAiError(e instanceof Error ? e.message : 'AI suggestion failed');
        } finally {
            setAiLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        const activityData = {
            ...(existingActivity ? { id: existingActivity.id } : {}),
            tripId,
            date,
            title: title.trim(),
            details: details.trim() || undefined,
            time: time || undefined,
            location: location.trim() || undefined,
            category,
            cost: cost ? parseFloat(cost) : undefined,
            currency: cost ? currency : undefined,
            notes: notes.trim() || undefined,
            order: existingActivity?.order ?? nextOrder,
            color: color || undefined,
        };

        onSave(activityData);
    };

    return (
        <form className="activity-form animate-fade-in" onSubmit={handleSubmit}>
            <div className="form-row">
                <div className="input-group" style={{ flex: 2 }}>
                    <label className="input-label">Title *</label>
                    <input
                        className="input-field"
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="e.g. Visit the Colosseum"
                        autoFocus
                        required
                    />
                </div>
                <div className="input-group" style={{ flex: 0, minWidth: '120px' }}>
                    <label className="input-label">Time</label>
                    <input
                        className="input-field"
                        type="time"
                        value={time}
                        onChange={e => setTime(e.target.value)}
                    />
                </div>
            </div>

            <div className="input-group">
                <label className="input-label">Details</label>
                <textarea
                    className="input-field textarea"
                    value={details}
                    onChange={e => setDetails(e.target.value)}
                    placeholder="What's happening?"
                    rows={2}
                />
                {title.trim() && (
                    <div className="ai-suggestion-block">
                        <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={handleAiSuggest}
                            disabled={aiLoading}
                        >
                            {aiLoading ? 'Getting suggestion…' : 'Suggest with AI'}
                        </button>
                        {aiError && <p className="ai-error">{aiError}</p>}
                        {aiSuggestion && (
                            <div className="ai-suggestion-card card">
                                <p className="ai-suggestion-text">{aiSuggestion}</p>
                                <div className="ai-suggestion-actions">
                                    <button type="button" className="btn btn-primary btn-sm" onClick={() => { setDetails(aiSuggestion!); setAiSuggestion(null); }}>Accept</button>
                                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAiSuggestion(null)}>Decline</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="category-picker">
                {categories.map(cat => (
                    <button
                        type="button"
                        key={cat}
                        className={`category-chip ${category === cat ? 'active' : ''}`}
                        onClick={() => setCategory(cat)}
                    >
                        {CATEGORY_EMOJIS[cat]} {cat}
                    </button>
                ))}
            </div>

            {!showOptional && (
                <button type="button" className="btn btn-ghost toggle-optional" onClick={() => setShowOptional(true)}>
                    + More details
                </button>
            )}

            {showOptional && (
                <div className="optional-fields animate-fade-in">
                    <div className="input-group">
                        <label className="input-label">Activity color</label>
                        <div className="trip-color-picker">
                            {ACTIVITY_COLORS.map((c) => (
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
                    <div className="input-group">
                        <label className="input-label">Location</label>
                        <input
                            className="input-field"
                            type="text"
                            value={location}
                            onChange={e => setLocation(e.target.value)}
                            placeholder="e.g. Piazza del Colosseo"
                        />
                    </div>
                    <div className="form-row">
                        <div className="input-group" style={{ flex: 1 }}>
                            <label className="input-label">Cost</label>
                            <input
                                className="input-field"
                                type="number"
                                value={cost}
                                onChange={e => setCost(e.target.value)}
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                            />
                        </div>
                        <div className="input-group" style={{ flex: 0, minWidth: '100px' }}>
                            <label className="input-label">Currency</label>
                            <select className="input-field" value={currency} onChange={e => setCurrency(e.target.value)}>
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                                <option value="GBP">GBP</option>
                                <option value="JPY">JPY</option>
                                <option value="CAD">CAD</option>
                                <option value="AUD">AUD</option>
                            </select>
                        </div>
                    </div>
                    <div className="input-group">
                        <label className="input-label">Notes</label>
                        <textarea
                            className="input-field textarea"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Any extra notes..."
                            rows={2}
                        />
                    </div>
                </div>
            )}

            <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
                    {existingActivity ? 'Save Changes' : 'Add Activity'}
                </button>
            </div>
        </form>
    );
};

export default ActivityForm;
