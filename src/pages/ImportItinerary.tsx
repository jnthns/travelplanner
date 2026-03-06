import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Check, AlertCircle, Plus, X, Plane } from 'lucide-react';
import { useTrips, useActivities } from '../lib/store';
import { CATEGORY_EMOJIS } from '../lib/types';
import type { Activity } from '../lib/types';
import { generateWithGemini } from '../lib/gemini';
import { logEvent } from '../lib/amplitude';
import './ImportItinerary.css';

const TRAVEL_JOKES = [
    "My travel budget is like my liver — absolutely destroyed by the end of every trip.",
    "TSA took my dignity, my water bottle, and somehow still missed the emotional baggage.",
    "I told my boss I needed a trip to find myself. Turns out I was at the hotel bar the whole time.",
    "The only thing getting laid on this vacation is my suitcase — flat on the airport floor.",
    "Jet lag is just your body saying 'what the hell did you do to me' in every time zone.",
    "My travel philosophy: if you haven't ugly-cried in a foreign airport, you haven't truly lived.",
    "The hostel said 'shared bathroom.' They didn't mention I'd be sharing it with the devil himself.",
    "Nothing says 'vacation' like diarrhea in a country where you can't read the pharmacy signs.",
    "I spent $200 on a 'scenic tour' that was basically a drunk guy with a van and strong opinions.",
    "My packing list: clothes, passport, poor decisions, and an unreasonable amount of Imodium.",
    "Airplane wine is just grape-flavored regret served at 35,000 feet.",
    "I don't always get upgraded, but when I do, it's because someone threw up in first class.",
    "Hotel 'continental breakfast' is just sad croissants and the crushing weight of expectations.",
    "I came for the culture. I stayed because I couldn't figure out the damn bus schedule.",
    "The resort called it an 'infinity pool.' Infinite was also how long I waited for a damn towel.",
    "My Uber driver in Bali had no GPS, no AC, and absolutely no f***s to give.",
    "Customs asked if I had anything to declare. I said 'just my crippling fear of commitment.'",
    "Middle seat, crying baby, broken AC — the holy trinity of air travel suffering.",
    "I booked a 'beachfront' hotel. The beach was a lie. The front was a parking lot.",
    "They say travel broadens the mind. Mine just broadened my credit card statement.",
];

interface ParsedActivity {
    date: string;
    title: string;
    details?: string;
    time?: string | null;
    location?: string;
    category?: Activity['category'];
}

interface ParsedItinerary {
    tripName: string;
    startDate: string;
    endDate: string;
    activities: ParsedActivity[];
}

type Stage = 'input' | 'preview' | 'saving' | 'done';

const CATEGORY_LIST = ['sightseeing', 'food', 'accommodation', 'transport', 'shopping', 'other'] as const;
const CURRENCY_LIST = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'KRW', 'TWD', 'THB', 'SGD'];

function buildPrompt(raw: string): string {
    const year = new Date().getFullYear();
    return `Parse this travel itinerary into structured JSON. Return ONLY valid JSON — no markdown fences, no explanation.
Be concise: omit fields that are null/empty, keep details under 80 chars.

{
  "tripName": "string",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "activities": [
    { "date": "YYYY-MM-DD", "title": "string", "details": "string?", "time": "HH:mm?", "location": "string?", "category": "sightseeing|food|accommodation|transport|shopping|other" }
  ]
}

Rules:
- Split each distinct activity/place into its own entry.
- Infer category from context.
- If year is not specified, assume ${year}.
- Use 09:00 for morning, 13:00 for afternoon, 18:00 for evening if exact time unknown.
- Order activities chronologically within each day.

Itinerary:
${raw}`;
}

function extractJSON(text: string): string {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) return fenced[1].trim();
    const braceStart = text.indexOf('{');
    const braceEnd = text.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd > braceStart) {
        return text.slice(braceStart, braceEnd + 1);
    }
    return text.trim();
}

function tryParseJSON(text: string): ParsedItinerary | null {
    try {
        const jsonStr = extractJSON(text);
        const data = JSON.parse(jsonStr) as ParsedItinerary;
        if (data.tripName && data.startDate && data.endDate && Array.isArray(data.activities) && data.activities.length > 0) {
            return data;
        }
    } catch { /* truncated or invalid */ }
    return null;
}

function splitIntoChunks(text: string, maxChunks: number): string[] {
    const lines = text.split('\n');
    if (lines.length <= 10) return [text];

    const dayPattern = /^(?:\|?\s*)?(?:\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2}|day\s*\d|(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*(?:day)?|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d)/i;

    const dayStarts: number[] = [];
    for (let i = 0; i < lines.length; i++) {
        if (dayPattern.test(lines[i].trim())) {
            dayStarts.push(i);
        }
    }

    if (dayStarts.length >= 2) {
        const dayGroups: string[] = [];
        for (let i = 0; i < dayStarts.length; i++) {
            const start = dayStarts[i];
            const end = i + 1 < dayStarts.length ? dayStarts[i + 1] : lines.length;
            dayGroups.push(lines.slice(start, end).join('\n'));
        }
        const header = dayStarts[0] > 0 ? lines.slice(0, dayStarts[0]).join('\n').trim() : '';

        const daysPerChunk = Math.ceil(dayGroups.length / maxChunks);
        const chunks: string[] = [];
        for (let i = 0; i < dayGroups.length; i += daysPerChunk) {
            const slice = dayGroups.slice(i, i + daysPerChunk).join('\n');
            chunks.push(header ? `${header}\n${slice}` : slice);
        }
        return chunks;
    }

    const linesPerChunk = Math.ceil(lines.length / maxChunks);
    const chunks: string[] = [];
    for (let i = 0; i < lines.length; i += linesPerChunk) {
        chunks.push(lines.slice(i, i + linesPerChunk).join('\n'));
    }
    return chunks;
}

function mergeResults(results: ParsedItinerary[]): ParsedItinerary {
    const allActivities = results.flatMap(r => r.activities);
    const dates = results.flatMap(r => [r.startDate, r.endDate]).sort();
    return {
        tripName: results[0].tripName,
        startDate: dates[0],
        endDate: dates[dates.length - 1],
        activities: allActivities,
    };
}

function groupByDate(activities: ParsedActivity[]): Map<string, ParsedActivity[]> {
    const map = new Map<string, ParsedActivity[]>();
    for (const act of activities) {
        const list = map.get(act.date) ?? [];
        list.push(act);
        map.set(act.date, list);
    }
    return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function formatDate(dateStr: string): string {
    try {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return dateStr;
    }
}

const LoadingJokes: React.FC<{ progress: string }> = ({ progress }) => {
    const [jokeIdx, setJokeIdx] = useState(() => Math.floor(Math.random() * TRAVEL_JOKES.length));
    const [fade, setFade] = useState(true);

    useEffect(() => {
        const interval = setInterval(() => {
            setFade(false);
            setTimeout(() => {
                setJokeIdx(prev => (prev + 1) % TRAVEL_JOKES.length);
                setFade(true);
            }, 300);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="import-loading-jokes">
            <div className="import-loading-plane">
                <Plane size={48} />
            </div>
            <p className="import-loading-progress">{progress || 'Parsing itinerary...'}</p>
            <div className={`import-loading-joke ${fade ? 'visible' : ''}`}>
                "{TRAVEL_JOKES[jokeIdx]}"
            </div>
        </div>
    );
};

const ImportItinerary: React.FC = () => {
    const navigate = useNavigate();
    const { addTrip, updateTrip } = useTrips();
    const { addActivity, getActivitiesByTrip } = useActivities();

    const [rawText, setRawText] = useState('');
    const [stage, setStage] = useState<Stage>('input');
    const [parsed, setParsed] = useState<ParsedItinerary | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [parseProgress, setParseProgress] = useState('');
    const [currency, setCurrency] = useState('USD');

    const [activeTripId, setActiveTripId] = useState<string | null>(null);
    const [activeTripName, setActiveTripName] = useState<string | null>(null);
    const [totalImported, setTotalImported] = useState(0);

    const isAppending = activeTripId !== null;

    const updateParsedField = useCallback((field: keyof ParsedItinerary, value: string) => {
        setParsed(prev => prev ? { ...prev, [field]: value } : prev);
    }, []);

    const updateActivity = useCallback((index: number, field: keyof ParsedActivity, value: string) => {
        setParsed(prev => {
            if (!prev) return prev;
            const activities = [...prev.activities];
            activities[index] = { ...activities[index], [field]: value || undefined };
            return { ...prev, activities };
        });
    }, []);

    const removeActivity = useCallback((index: number) => {
        setParsed(prev => {
            if (!prev) return prev;
            const activities = prev.activities.filter((_, i) => i !== index);
            return { ...prev, activities };
        });
    }, []);

    const handleDiscard = useCallback(() => {
        setParsed(null);
        setError(null);
        setRawText('');
        setStage('input');
        logEvent('Import Discarded');
    }, []);

    async function parseChunk(text: string): Promise<ParsedItinerary> {
        const response = await generateWithGemini(buildPrompt(text), 8000);
        const result = tryParseJSON(response);
        if (!result) {
            const isTruncated = !/}\s*$/.test(response);
            throw new Error(
                isTruncated
                    ? 'TRUNCATED'
                    : 'Failed to parse AI response as JSON. Try again or simplify your input.'
            );
        }
        return result;
    }

    const handleParse = async () => {
        if (!rawText.trim()) return;
        setLoading(true);
        setError(null);
        setParseProgress('');
        logEvent('Import Parse Started', { is_append: isAppending });

        try {
            setParseProgress('Parsing itinerary...');
            let result: ParsedItinerary;
            try {
                result = await parseChunk(rawText.trim());
            } catch (firstErr) {
                const firstMsg = firstErr instanceof Error ? firstErr.message : '';
                if (firstMsg !== 'TRUNCATED') throw firstErr;

                const chunks = splitIntoChunks(rawText.trim(), 3);
                if (chunks.length <= 1) {
                    throw new Error('The AI response was too long even for a single chunk. Try pasting less text.');
                }

                logEvent('Import Auto Chunking', { chunk_count: chunks.length });
                const results: ParsedItinerary[] = [];
                for (let i = 0; i < chunks.length; i++) {
                    setParseProgress(`Parsing chunk ${i + 1} of ${chunks.length}...`);
                    try {
                        const chunkResult = await parseChunk(chunks[i]);
                        results.push(chunkResult);
                    } catch (chunkErr) {
                        const chunkMsg = chunkErr instanceof Error ? chunkErr.message : '';
                        if (chunkMsg === 'TRUNCATED') {
                            const subChunks = splitIntoChunks(chunks[i], 2);
                            for (let j = 0; j < subChunks.length; j++) {
                                setParseProgress(`Parsing chunk ${i + 1}.${j + 1} of ${chunks.length}...`);
                                results.push(await parseChunk(subChunks[j]));
                            }
                        } else {
                            throw chunkErr;
                        }
                    }
                }

                if (results.length === 0) {
                    throw new Error('No activities were parsed from any chunk.');
                }
                result = mergeResults(results);
            }

            if (result.activities.length === 0) {
                throw new Error('No activities were parsed from the input. Try providing more detail.');
            }

            setParsed(result);
            setStage('preview');
            logEvent('Import Parse Success', { activity_count: result.activities.length, trip_name: result.tripName, is_append: isAppending });
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Parsing failed';
            console.error('Import parse error:', e);
            setError(msg);
            logEvent('Import Parse Failed', { error: msg, input_length: rawText.trim().length });
        } finally {
            setLoading(false);
            setParseProgress('');
        }
    };

    const handleConfirm = async () => {
        if (!parsed || parsed.activities.length === 0) return;
        setStage('saving');

        try {
            let tripId: string;

            if (isAppending && activeTripId) {
                tripId = activeTripId;
                await updateTrip(tripId, expandDateRange(tripId, parsed.startDate, parsed.endDate));
            } else {
                const trip = await addTrip({
                    name: parsed.tripName,
                    startDate: parsed.startDate,
                    endDate: parsed.endDate,
                    defaultCurrency: currency,
                });
                tripId = trip.id;
                setActiveTripId(tripId);
                setActiveTripName(parsed.tripName);
            }

            const existingActivities = getActivitiesByTrip(tripId);
            const maxOrderByDate = new Map<string, number>();
            for (const a of existingActivities) {
                const cur = maxOrderByDate.get(a.date) ?? -1;
                if (a.order > cur) maxOrderByDate.set(a.date, a.order);
            }

            const grouped = groupByDate(parsed.activities);
            let addedCount = 0;
            for (const [date, acts] of grouped) {
                const startOrder = (maxOrderByDate.get(date) ?? -1) + 1;
                for (let i = 0; i < acts.length; i++) {
                    const act = acts[i];
                    await addActivity({
                        tripId,
                        date,
                        title: act.title,
                        details: act.details || undefined,
                        time: act.time || undefined,
                        location: act.location || undefined,
                        category: act.category || 'other',
                        order: startOrder + i,
                    } as Omit<Activity, 'id' | 'userId'>);
                    addedCount++;
                }
            }

            setTotalImported(prev => prev + addedCount);
            logEvent('Import Confirmed', { trip_id: tripId, trip_name: activeTripName ?? parsed.tripName, activity_count: addedCount, is_append: isAppending });
            setStage('done');
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to save';
            console.error('Import save error:', e);
            setError(msg);
            logEvent('Import Save Failed', { error: msg, trip_name: parsed.tripName, activity_count: parsed.activities.length });
            setStage('preview');
        }
    };

    function expandDateRange(tripId: string, newStart: string, newEnd: string) {
        const existing = getActivitiesByTrip(tripId);
        let earliest = newStart;
        let latest = newEnd;
        for (const a of existing) {
            if (a.date < earliest) earliest = a.date;
            if (a.date > latest) latest = a.date;
        }
        return { startDate: earliest < newStart ? earliest : newStart, endDate: latest > newEnd ? latest : newEnd };
    }

    const handleAddMore = () => {
        setRawText('');
        setParsed(null);
        setError(null);
        setStage('input');
    };

    const handleStartFresh = () => {
        setRawText('');
        setParsed(null);
        setError(null);
        setActiveTripId(null);
        setActiveTripName(null);
        setTotalImported(0);
        setCurrency('USD');
        setStage('input');
    };

    const grouped = parsed ? groupByDate(parsed.activities) : null;
    let globalIdx = 0;

    return (
        <div className="page-container animate-fade-in">
            <header className="page-header">
                <div>
                    <h1>Import Itinerary</h1>
                    <p>Paste an AI-generated itinerary and we'll parse it into a trip.</p>
                </div>
            </header>

            {/* Input Stage */}
            {stage === 'input' && !loading && (
                <div className="import-input-section">
                    {isAppending && (
                        <div className="import-append-banner">
                            <Plus size={16} />
                            <span>Adding more days to <strong>{activeTripName}</strong> ({totalImported} activities imported so far)</span>
                        </div>
                    )}
                    <label className="input-label" htmlFor="import-textarea">
                        {isAppending ? 'Paste the next chunk of your itinerary' : 'Paste your itinerary'}
                    </label>
                    <textarea
                        id="import-textarea"
                        className="input-field import-textarea"
                        value={rawText}
                        onChange={e => setRawText(e.target.value)}
                        placeholder={isAppending
                            ? "Paste the next set of days here..."
                            : "Paste your itinerary here (from Gemini, ChatGPT, Claude, etc.)\n\nSupports tables, bullet lists, or any text format.\nLong itineraries are automatically split into chunks."}
                        rows={12}
                    />
                    {error && (
                        <div className="import-error">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}
                    <div className="import-input-actions">
                        {isAppending && (
                            <button className="btn btn-ghost" onClick={handleStartFresh}>
                                Start New Trip
                            </button>
                        )}
                        <button
                            className="btn btn-primary import-parse-btn"
                            onClick={handleParse}
                            disabled={!rawText.trim()}
                        >
                            Parse with AI
                        </button>
                    </div>
                </div>
            )}

            {/* Loading / Parsing Stage */}
            {stage === 'input' && loading && (
                <LoadingJokes progress={parseProgress} />
            )}

            {/* Preview Stage */}
            {stage === 'preview' && parsed && grouped && (() => { globalIdx = 0; return true; })() && (
                <div className="import-preview">
                    <div className="import-sticky-actions">
                        <button className="btn btn-ghost import-discard-btn" onClick={handleDiscard}>
                            Discard
                        </button>
                        <div className="import-actions-right">
                            <button className="btn btn-ghost" onClick={() => { setStage('input'); setError(null); }}>
                                Re-paste
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleConfirm}
                                disabled={parsed.activities.length === 0 || !parsed.tripName.trim()}
                            >
                                {isAppending ? 'Add Activities' : 'Create Trip'}
                            </button>
                        </div>
                    </div>

                    <div className="import-preview-header card">
                        {isAppending ? (
                            <>
                                <p className="import-preview-append-label">Adding to</p>
                                <h2>{activeTripName}</h2>
                            </>
                        ) : (
                            <div className="import-edit-row">
                                <div className="import-edit-group import-edit-name">
                                    <label className="input-label">Trip name</label>
                                    <input
                                        className="input-field"
                                        value={parsed.tripName}
                                        onChange={e => updateParsedField('tripName', e.target.value)}
                                    />
                                </div>
                                <div className="import-edit-group">
                                    <label className="input-label">Currency</label>
                                    <select className="input-field" value={currency} onChange={e => setCurrency(e.target.value)}>
                                        {CURRENCY_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}
                        <div className="import-edit-row import-edit-dates">
                            <div className="import-edit-group">
                                <label className="input-label">Start</label>
                                <input
                                    type="date"
                                    className="input-field"
                                    value={parsed.startDate}
                                    onChange={e => updateParsedField('startDate', e.target.value)}
                                />
                            </div>
                            <div className="import-edit-group">
                                <label className="input-label">End</label>
                                <input
                                    type="date"
                                    className="input-field"
                                    value={parsed.endDate}
                                    onChange={e => updateParsedField('endDate', e.target.value)}
                                />
                            </div>
                        </div>
                        <p className="import-preview-count">
                            {parsed.activities.length} activit{parsed.activities.length === 1 ? 'y' : 'ies'} across {grouped.size} day{grouped.size === 1 ? '' : 's'}
                            {isAppending && <> &middot; {totalImported} already imported</>}
                        </p>
                    </div>

                    <div className="import-day-list">
                        {[...grouped.entries()].map(([date, acts]) => (
                            <div key={date} className="import-day-group">
                                <h3 className="import-day-heading">{formatDate(date)}</h3>
                                <div className="import-activity-list">
                                    {acts.map((act) => {
                                        const idx = globalIdx++;
                                        return (
                                            <div key={idx} className="import-activity-card">
                                                <span className="import-activity-emoji">
                                                    {CATEGORY_EMOJIS[act.category || 'other']}
                                                </span>
                                                <div className="import-activity-body">
                                                    <input
                                                        className="import-inline-input import-inline-title"
                                                        value={act.title}
                                                        onChange={e => updateActivity(idx, 'title', e.target.value)}
                                                    />
                                                    <div className="import-inline-row">
                                                        <input
                                                            type="time"
                                                            className="import-inline-input import-inline-time"
                                                            value={act.time || ''}
                                                            onChange={e => updateActivity(idx, 'time', e.target.value)}
                                                        />
                                                        <select
                                                            className="import-inline-input import-inline-category"
                                                            value={act.category || 'other'}
                                                            onChange={e => updateActivity(idx, 'category', e.target.value)}
                                                        >
                                                            {CATEGORY_LIST.map(c => (
                                                                <option key={c} value={c}>{CATEGORY_EMOJIS[c]} {c}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    {act.location && <span className="import-activity-location">{act.location}</span>}
                                                    {act.details && <p className="import-activity-details">{act.details}</p>}
                                                </div>
                                                <button
                                                    type="button"
                                                    className="import-remove-btn"
                                                    onClick={() => removeActivity(idx)}
                                                    aria-label="Remove activity"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>

                    {parsed.activities.length === 0 && (
                        <div className="import-error">
                            <AlertCircle size={16} />
                            <span>All activities have been removed. Add some back or discard this import.</span>
                        </div>
                    )}

                    {error && (
                        <div className="import-error">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Saving Stage */}
            {stage === 'saving' && (
                <div className="import-saving">
                    <Loader2 size={32} className="spin" />
                    <p>{isAppending ? 'Adding activities...' : 'Creating trip and activities...'}</p>
                </div>
            )}

            {/* Done Stage */}
            {stage === 'done' && parsed && (
                <div className="import-done">
                    <div className="import-sticky-actions import-done-actions">
                        <button className="btn btn-ghost" onClick={handleAddMore}>
                            Add More Days
                        </button>
                        <div className="import-actions-right">
                            <button className="btn btn-ghost" onClick={handleStartFresh}>
                                New Trip
                            </button>
                            <button className="btn btn-primary" onClick={() => navigate('/spreadsheet')}>
                                View Trips
                            </button>
                        </div>
                    </div>
                    <div className="import-done-icon"><Check size={40} /></div>
                    <h2>{isAppending ? 'Activities Added' : 'Trip Created'}</h2>
                    <p>
                        "{activeTripName ?? parsed.tripName}" now has {totalImported} activit{totalImported === 1 ? 'y' : 'ies'}.
                    </p>
                </div>
            )}
        </div>
    );
};

export default ImportItinerary;
