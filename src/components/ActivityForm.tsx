import React, { useState } from 'react';
import type { Activity } from '../lib/types';
import { CATEGORY_EMOJIS, ACTIVITY_COLORS } from '../lib/types';
import { Loader2, Trash2 } from 'lucide-react';
import { generateWithGemini } from '../lib/gemini';
import { logEvent } from '../lib/amplitude';
import Markdown from './Markdown';
import AutoTextarea from './AutoTextarea';
import './ActivityForm.css';

interface ActivityFormProps {
    tripId: string;
    date: string;
    existingActivity?: Activity;
    nextOrder: number;
    defaultCurrency?: string;
    onSave: (activity: Omit<Activity, 'id'> | { id: string } & Partial<Activity>) => void;
    onCancel: () => void;
    onDelete?: () => void;
}

const categories = ['sightseeing', 'food', 'accommodation', 'transport', 'shopping', 'other'] as const;

const TIME_OPTIONS: { value: string; label: string }[] = (() => {
    const opts: { value: string; label: string }[] = [{ value: '', label: 'No time' }];
    for (let h = 0; h < 24; h++) {
        for (const m of [0, 30]) {
            const hh = String(h).padStart(2, '0');
            const mm = String(m).padStart(2, '0');
            const value = `${hh}:${mm}`;
            const period = h < 12 ? 'AM' : 'PM';
            const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
            const label = `${displayH}:${mm} ${period}`;
            opts.push({ value, label });
        }
    }
    return opts;
})();

function snapTo30(time: string): string {
    if (!time) return '';
    const [hStr, mStr] = time.split(':');
    const minutes = parseInt(mStr ?? '0', 10);
    const snapped = minutes < 15 ? '00' : minutes < 45 ? '30' : '00';
    let hours = parseInt(hStr ?? '0', 10);
    if (minutes >= 45) hours = (hours + 1) % 24;
    return `${String(hours).padStart(2, '0')}:${snapped}`;
}

const ActivityForm: React.FC<ActivityFormProps> = ({ tripId, date, existingActivity, nextOrder, defaultCurrency, onSave, onCancel, onDelete }) => {
    const [title, setTitle] = useState(existingActivity?.title || '');
    const [details, setDetails] = useState(existingActivity?.details || '');
    const [time, setTime] = useState(() => snapTo30(existingActivity?.time || ''));
    const [location, setLocation] = useState(existingActivity?.location || '');
    const [category, setCategory] = useState<Activity['category']>(existingActivity?.category || 'other');
    const [cost, setCost] = useState(existingActivity?.cost?.toString() || '');
    const [currency, setCurrency] = useState(existingActivity?.currency || defaultCurrency || 'USD');
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
        const prompt = `You are an expert travel assistant. For this activity: "${title.trim()}".

Write a highly detailed and useful guide (maximum 100 words) in bullet point format with newlines for formatting, structured in this order:
1. Start with specific, practical travel tips to optimize the experience — best time of the week/time of day to visit, how to avoid crowds, money-saving strategies, local etiquette, and efficiency tips for getting the most out of the visit.
2. Include any culinary recommendations for the area.
3. Then include lesser-known tips or details that a typical tourist might miss (nearby gems worth combining into the visit).
4. End with a brief but rich historical, cultural, or geographical description of the location/activity.

Prioritize actionable advice over general description. Use engaging but factual language. Output only the guide paragraphs, no headings or labels or ad recommendations. Use emojis for each point. Start with a newline and an underline line divider in your response. Apply markdown formatting to the response.`;
        logEvent('AI Suggestion Requested', { activity_title: title.trim() });
        try {
            const text = await generateWithGemini(prompt, 1500);
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
            order: existingActivity?.order ?? nextOrder,
            color: color || undefined,
        };

        onSave(activityData);

        const hasCost = !!activityData.cost;
        if (existingActivity) {
            logEvent('Activity Updated', {
                activity_title: activityData.title,
                category: activityData.category,
                has_cost: hasCost,
                has_time: !!activityData.time,
                has_location: !!activityData.location,
            });
        } else {
            logEvent('Activity Created', {
                activity_title: activityData.title,
                category: activityData.category,
                has_cost: hasCost,
                has_time: !!activityData.time,
                has_location: !!activityData.location,
                trip_id: activityData.tripId,
                date: activityData.date,
            });
        }
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
                <div className="input-group" style={{ flex: 0, minWidth: '130px' }}>
                    <label className="input-label">Time</label>
                    <select
                        className="input-field"
                        value={time}
                        onChange={e => setTime(e.target.value)}
                    >
                        {TIME_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="input-group">
                <label className="input-label">Details</label>
                <AutoTextarea
                    className="input-field textarea"
                    value={details}
                    onChange={e => setDetails(e.target.value)}
                    placeholder="What's happening?"
                    minRows={6}
                />
                {title.trim() && (
                    <div className="ai-suggestion-block">
                        <button
                            type="button"
                            className="btn btn-sm ai-suggest-btn"
                            onClick={handleAiSuggest}
                            disabled={aiLoading}
                        >
                            {aiLoading ? <><Loader2 size={14} className="spin" /> Getting suggestion…</> : 'Suggest with AI'}
                        </button>
                        {aiError && <p className="ai-error">{aiError}</p>}
                        {aiSuggestion && (
                            <div className="ai-suggestion-card card">
                                <Markdown className="ai-suggestion-text">{aiSuggestion}</Markdown>
                                <div className="ai-suggestion-actions">
                                    <button type="button" className="btn btn-primary btn-sm" onClick={() => { setDetails(aiSuggestion!); setAiSuggestion(null); logEvent('AI Suggestion Accepted', { activity_title: title.trim() }); }}>Accept</button>
                                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setAiSuggestion(null); logEvent('AI Suggestion Declined', { activity_title: title.trim() }); }}>Decline</button>
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
                    <div className="form-row">
                        <div className="input-group" style={{ flex: 2 }}>
                            <label className="input-label">Location</label>
                            <input
                                className="input-field"
                                type="text"
                                value={location}
                                onChange={e => setLocation(e.target.value)}
                                placeholder="e.g. Piazza del Colosseo"
                            />
                        </div>
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
                </div>
            )}

            <div className="form-actions">
                {onDelete && (
                    <button type="button" className="btn btn-danger btn-sm form-delete-btn" onClick={onDelete}>
                        <Trash2 size={14} /> Delete
                    </button>
                )}
                <div className="form-actions-right">
                    <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
                        {existingActivity ? 'Save Changes' : 'Add Activity'}
                    </button>
                </div>
            </div>
        </form>
    );
};

export default ActivityForm;
