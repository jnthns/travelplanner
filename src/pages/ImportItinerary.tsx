import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Check, AlertCircle, Plus, X, Plane } from 'lucide-react';
import { useTrips, useActivities, useTransportRoutes, useNotes } from '../lib/store';
import { useLocalStorageState } from '../hooks/useLocalStorageState';
import { CATEGORY_EMOJIS } from '../lib/types';
import type { Activity } from '../lib/types';
import { useToast } from '../components/Toast';
import { logEvent } from '../lib/amplitude';
import { buildTripExportPayload, downloadTextFile, slugifyFilename, toTripCsv } from '../lib/exportTrip';
import { parseItineraryChunk, type ParsedActivity, type ParsedItinerary } from '../lib/ai/actions/importItinerary';

type Stage = 'input' | 'preview' | 'saving' | 'done';
type ImportExportMode = 'import' | 'export';
type ExportFormat = 'json' | 'csv';

const CATEGORY_LIST = ['sightseeing', 'food', 'accommodation', 'transport', 'shopping', 'other'] as const;
const CURRENCY_LIST = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'KRW', 'TWD', 'THB', 'SGD'];

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

const LOADING_MESSAGES = [
    "Analyzing your itinerary...",
    "Extracting dates and times...",
    "Categorizing activities...",
    "Structuring the schedule...",
    "Almost done...",
    "Just a little more..."
];

const LoadingJokes: React.FC<{ progress: string }> = ({ progress }) => {
    const [msgIdx, setMsgIdx] = React.useState(0);

    React.useEffect(() => {
        const interval = setInterval(() => {
            setMsgIdx(prev => (prev + 1) % LOADING_MESSAGES.length);
        }, 10000);
        return () => clearInterval(interval);
    }, []);

    // Explicit progress overrides rotating messages (e.g. chunking progress)
    const displayMessage = progress || LOADING_MESSAGES[msgIdx];

    return (
        <div className="flex flex-col items-center text-center gap-xl" style={{ padding: '4rem 2rem' }}>
            <div className="text-primary animate-plane-bob">
                <Plane size={48} />
            </div>
            <p className="flex items-center gap-sm text-sm text-tertiary loading-spinner-before">{displayMessage}</p>
        </div>
    );
};

const ImportItinerary: React.FC = () => {
    const navigate = useNavigate();
    const { trips, addTrip, updateTrip } = useTrips();
    const { addActivity, getActivitiesByTrip } = useActivities();
    const { getRoutesByTrip } = useTransportRoutes();
    const { getNotesByTrip } = useNotes();
    const { showToast } = useToast();

    const [mode, setMode] = useState<ImportExportMode>('import');
    const [exportTripId, setExportTripId] = useState<string>('');
    const [exportFormat, setExportFormat] = useState<ExportFormat>('json');

    const [rawText, setRawText] = useLocalStorageState('travelplanner_import_raw', '');
    const [stage, setStage] = useLocalStorageState<Stage>('travelplanner_import_stage', 'input');
    const [parsed, setParsed] = useLocalStorageState<ParsedItinerary | null>('travelplanner_import_parsed', null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [parseProgress, setParseProgress] = useState('');
    const [currency, setCurrency] = useState('USD');

    const [activeTripId, setActiveTripId] = useState<string | null>(null);
    const [activeTripName, setActiveTripName] = useState<string | null>(null);
    const [totalImported, setTotalImported] = useState(0);

    const isAppending = activeTripId !== null;

    const updateParsedField = useCallback((field: keyof ParsedItinerary, value: string) => {
        setParsed((prev: ParsedItinerary | null) => prev ? { ...prev, [field]: value } : prev);
    }, [setParsed]);

    const updateActivity = useCallback((index: number, field: keyof ParsedActivity, value: string) => {
        setParsed((prev: ParsedItinerary | null) => {
            if (!prev) return prev;
            const activities = [...prev.activities];
            activities[index] = { ...activities[index], [field]: value || undefined };
            return { ...prev, activities };
        });
    }, [setParsed]);

    const removeActivity = useCallback((index: number) => {
        setParsed((prev: ParsedItinerary | null) => {
            if (!prev) return prev;
            const activities = prev.activities.filter((_: any, i: number) => i !== index);
            return { ...prev, activities };
        });
    }, [setParsed]);

    const handleDiscard = useCallback(() => {
        setParsed(null);
        setError(null);
        setRawText('');
        setStage('input');
        logEvent('Import Discarded');
    }, [setParsed, setRawText, setStage]);

    async function parseChunk(text: string): Promise<ParsedItinerary> {
        return parseItineraryChunk(text);
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
            let tripMembers: string[] = [];

            if (isAppending && activeTripId) {
                tripId = activeTripId;
                const activeTrip = trips.find(t => t.id === tripId);
                tripMembers = activeTrip?.members || (activeTrip ? [activeTrip.userId] : []);
                await updateTrip(tripId, expandDateRange(tripId, parsed.startDate, parsed.endDate));
            } else {
                const trip = await addTrip({
                    name: parsed.tripName,
                    startDate: parsed.startDate,
                    endDate: parsed.endDate,
                    defaultCurrency: currency,
                });
                tripId = trip.id;
                tripMembers = trip.members || [];
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
                    } as Omit<Activity, 'id' | 'userId' | 'tripMembers'>, tripMembers);
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

    const selectedExportTrip = trips.find(t => t.id === exportTripId) || null;

    const handleExport = useCallback(() => {
        if (!selectedExportTrip) {
            showToast('Select a trip to export');
            return;
        }

        try {
            const activitiesForTrip = getActivitiesByTrip(selectedExportTrip.id);
            const routesForTrip = getRoutesByTrip(selectedExportTrip.id);
            const notesForTrip = getNotesByTrip(selectedExportTrip.id);
            const baseFilename = `${slugifyFilename(selectedExportTrip.name)}-${selectedExportTrip.startDate}-${selectedExportTrip.endDate}`;

            if (exportFormat === 'json') {
                const payload = buildTripExportPayload({
                    trip: selectedExportTrip,
                    activities: activitiesForTrip,
                    transportRoutes: routesForTrip,
                    notes: notesForTrip,
                });
                downloadTextFile(`${baseFilename}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
            } else {
                const csv = toTripCsv({
                    trip: selectedExportTrip,
                    activities: activitiesForTrip,
                    transportRoutes: routesForTrip,
                    notes: notesForTrip,
                });
                downloadTextFile(`${baseFilename}-trip.csv`, csv, 'text/csv;charset=utf-8');
            }

            logEvent('Trip Exported', {
                trip_id: selectedExportTrip.id,
                trip_name: selectedExportTrip.name,
                format: exportFormat,
                activity_count: activitiesForTrip.length,
                route_count: routesForTrip.length,
                note_count: notesForTrip.length,
            });
            showToast(`Exported ${selectedExportTrip.name} as ${exportFormat.toUpperCase()}`);
        } catch (err) {
            console.error('Export failed:', err);
            showToast('Export failed. Please try again.');
        }
    }, [selectedExportTrip, showToast, getActivitiesByTrip, getRoutesByTrip, getNotesByTrip, exportFormat]);

    return (
        <div className="page-container animate-fade-in">
            <header className="page-header">
                <div>
                    <h1>Import Itinerary</h1>
                    <p>Paste an AI-generated itinerary and we'll parse it into a trip.</p>
                </div>
            </header>

            <div className="flex items-center gap-xs mb-lg">
                <button
                    type="button"
                    className={`btn btn-sm ${mode === 'import' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setMode('import')}
                >
                    Import
                </button>
                <button
                    type="button"
                    className={`btn btn-sm ${mode === 'export' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => {
                        setMode('export');
                        if (!exportTripId && trips.length > 0) {
                            setExportTripId(trips[0].id);
                        }
                    }}
                >
                    Export
                </button>
            </div>

            {mode === 'export' && (
                <div className="card p-xl flex flex-col gap-md">
                    <div className="flex flex-wrap items-end gap-sm">
                        <div className="flex flex-col gap-xs" style={{ minWidth: '240px', flex: '1 1 280px' }}>
                            <label className="input-label">Select trip</label>
                            <select
                                className="input-field"
                                value={exportTripId}
                                onChange={(e) => setExportTripId(e.target.value)}
                            >
                                <option value="">Choose a trip...</option>
                                {trips.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.name} ({t.startDate} to {t.endDate})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex flex-col gap-xs">
                            <label className="input-label">Format</label>
                            <select
                                className="input-field"
                                value={exportFormat}
                                onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                            >
                                <option value="json">JSON</option>
                                <option value="csv">CSV (trip.csv)</option>
                            </select>
                        </div>
                    </div>

                    <p className="text-sm text-tertiary">
                        {exportFormat === 'json'
                            ? 'JSON export includes trip metadata plus activities, transport routes, and notes.'
                            : 'CSV export creates trip.csv with metadata and flattened itinerary records.'}
                    </p>

                    <div className="flex justify-end">
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleExport}
                            disabled={!exportTripId}
                        >
                            Export {exportFormat.toUpperCase()}
                        </button>
                    </div>
                </div>
            )}

            {/* Input Stage */}
            {mode === 'import' && stage === 'input' && !loading && (
                <div className="flex flex-col gap-sm">
                    {isAppending && (
                        <div className="flex items-center gap-sm p-sm rounded-md text-sm text-secondary" style={{ backgroundColor: 'color-mix(in srgb, var(--primary-color) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--primary-color) 20%, transparent)' }}>
                            <Plus size={16} className="text-primary shrink-0" />
                            <span>Adding more days to <strong>{activeTripName}</strong> ({totalImported} activities imported so far)</span>
                        </div>
                    )}
                    <label className="input-label" htmlFor="import-textarea">
                        {isAppending ? 'Paste the next chunk of your itinerary' : 'Paste your itinerary'}
                    </label>
                    <textarea
                        id="import-textarea"
                        className="input-field"
                        style={{ minHeight: '200px', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.9rem', lineHeight: 1.5 }}
                        value={rawText}
                        onChange={e => setRawText(e.target.value)}
                        placeholder={isAppending
                            ? "Paste the next set of days here..."
                            : "Paste your itinerary here (from Gemini, ChatGPT, Claude, etc.)\n\nSupports tables, bullet lists, or any text format.\nLong itineraries are automatically split into chunks."}
                        rows={12}
                    />
                    {error && (
                        <div className="flex items-start gap-sm p-sm rounded-md text-sm" style={{ backgroundColor: 'color-mix(in srgb, var(--error-color) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--error-color) 25%, transparent)', color: 'var(--error-color)', lineHeight: 1.4 }}>
                            <AlertCircle size={16} className="shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}
                    <style>{`
                        @media (max-width: 768px) {
                            .mobile-column-reverse { flex-direction: column-reverse !important; align-items: stretch !important; }
                            .mobile-column-reverse .btn { width: 100% !important; margin-left: 0 !important; }
                        }
                    `}</style>
                    <div className="flex items-center gap-sm mobile-column-reverse">
                        {isAppending && (
                            <button className="btn btn-ghost" onClick={handleStartFresh}>
                                Start New Trip
                            </button>
                        )}
                        <button
                            className="btn btn-primary"
                            style={{ marginLeft: 'auto' }}
                            onClick={handleParse}
                            disabled={!rawText.trim()}
                        >
                            Parse with AI
                        </button>
                    </div>
                </div>
            )}

            {/* Loading / Parsing Stage */}
            {mode === 'import' && stage === 'input' && loading && (
                <LoadingJokes progress={parseProgress} />
            )}

            {/* Preview Stage */}
            {mode === 'import' && stage === 'preview' && parsed && grouped && (() => { globalIdx = 0; return true; })() && (
                <div className="flex flex-col gap-xl">
                    <style>{`
                        @media (max-width: 768px) {
                            .mobile-actions { flex-wrap: wrap !important; padding: 0.5rem 0.75rem !important; }
                            .mobile-actions-right { width: 100% !important; display: flex; gap: 0.75rem; }
                            .mobile-actions-right .btn { flex: 1; }
                            .mobile-discard { width: 100% !important; margin-bottom: 0.5rem; }
                            .mobile-edit-row { flex-direction: column !important; align-items: stretch !important; gap: 0.5rem !important; }
                        }
                    `}</style>
                    <div className="sticky-actions mobile-actions">
                        <button className="btn btn-ghost mobile-discard" style={{ color: 'var(--error-color)' }} onClick={handleDiscard}>
                            Discard
                        </button>
                        <div className="flex items-center gap-sm mobile-actions-right">
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

                    <div className="card p-xl flex flex-col gap-sm" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary-color) 6%, transparent), color-mix(in srgb, var(--secondary-color) 6%, transparent))' }}>
                        {isAppending ? (
                            <>
                                <p className="text-xs text-tertiary uppercase font-semibold mb-0" style={{ letterSpacing: '0.05em' }}>Adding to</p>
                                <h2 className="text-xl mb-xs">{activeTripName}</h2>
                            </>
                        ) : (
                            <div className="flex items-end gap-sm mobile-edit-row">
                                <div className="flex flex-col gap-xs flex-1" style={{ minWidth: 0 }}>
                                    <label className="text-xs text-tertiary uppercase font-semibold" style={{ letterSpacing: '0.04em' }}>Trip name</label>
                                    <input
                                        className="input-field"
                                        value={parsed.tripName}
                                        onChange={e => updateParsedField('tripName', e.target.value)}
                                    />
                                </div>
                                <div className="flex flex-col gap-xs">
                                    <label className="text-xs text-tertiary uppercase font-semibold" style={{ letterSpacing: '0.04em' }}>Currency</label>
                                    <select className="input-field" value={currency} onChange={e => setCurrency(e.target.value)}>
                                        {CURRENCY_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}
                        <div className="flex items-end gap-sm mobile-edit-row" style={{ flexDirection: 'row' }}>
                            <div className="flex flex-col gap-xs flex-1" style={{ minWidth: 0 }}>
                                <label className="text-xs text-tertiary uppercase font-semibold" style={{ letterSpacing: '0.04em' }}>Start</label>
                                <input
                                    type="date"
                                    className="input-field"
                                    value={parsed.startDate}
                                    onChange={e => updateParsedField('startDate', e.target.value)}
                                />
                            </div>
                            <div className="flex flex-col gap-xs flex-1" style={{ minWidth: 0 }}>
                                <label className="text-xs text-tertiary uppercase font-semibold" style={{ letterSpacing: '0.04em' }}>End</label>
                                <input
                                    type="date"
                                    className="input-field"
                                    value={parsed.endDate}
                                    onChange={e => updateParsedField('endDate', e.target.value)}
                                />
                            </div>
                        </div>
                        <p className="text-sm text-tertiary mt-xs">
                            {parsed.activities.length} activit{parsed.activities.length === 1 ? 'y' : 'ies'} across {grouped.size} day{grouped.size === 1 ? '' : 's'}
                            {isAppending && <> &middot; {totalImported} already imported</>}
                        </p>
                    </div>

                    <div className="flex flex-col gap-xl">
                        {[...grouped.entries()].map(([date, acts]) => (
                            <div key={date}>
                                <h3 className="font-bold text-primary pb-xs mb-sm" style={{ fontSize: '0.95rem', borderBottom: '2px solid color-mix(in srgb, var(--primary-color) 15%, transparent)' }}>{formatDate(date)}</h3>
                                <div className="flex flex-col gap-sm">
                                    {acts.map((act) => {
                                        const idx = globalIdx++;
                                        return (
                                            <div key={idx} className="flex items-start gap-sm p-sm bg-surface rounded-md border relative" style={{ padding: '0.65rem 0.85rem' }}>
                                                <span className="shrink-0" style={{ fontSize: '1.1rem', marginTop: '0.35rem' }}>
                                                    {CATEGORY_EMOJIS[act.category || 'other']}
                                                </span>
                                                <div className="flex flex-col flex-1" style={{ minWidth: 0, gap: '0.25rem' }}>
                                                    <input
                                                        className="input-ghost font-semibold w-full text-base"
                                                        value={act.title}
                                                        onChange={e => updateActivity(idx, 'title', e.target.value)}
                                                    />
                                                    <div className="flex items-center gap-sm flex-wrap">
                                                        <input
                                                            type="time"
                                                            className="input-ghost text-xs text-tertiary"
                                                            style={{ width: 'auto', maxWidth: '110px' }}
                                                            value={act.time || ''}
                                                            onChange={e => updateActivity(idx, 'time', e.target.value)}
                                                        />
                                                        <select
                                                            className="input-ghost text-xs text-secondary cursor-pointer"
                                                            style={{ padding: '0.15rem 0.3rem' }}
                                                            value={act.category || 'other'}
                                                            onChange={e => updateActivity(idx, 'category', e.target.value)}
                                                        >
                                                            {CATEGORY_LIST.map(c => (
                                                                <option key={c} value={c}>{CATEGORY_EMOJIS[c]} {c}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    {act.location && <span className="text-xs text-secondary px-1">{act.location}</span>}
                                                    {act.details && <p className="text-sm text-secondary mt-xs px-1" style={{ lineHeight: 1.4 }}>{act.details}</p>}
                                                </div>
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost btn-icon shrink-0 mt-xs opacity-50 hover:opacity-100 hover:text-danger hover:bg-danger/10"
                                                    style={{ padding: '0.25rem' }}
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
                        <div className="flex items-start gap-sm p-sm rounded-md text-sm mt-md" style={{ backgroundColor: 'color-mix(in srgb, var(--error-color) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--error-color) 25%, transparent)', color: 'var(--error-color)', lineHeight: 1.4 }}>
                            <AlertCircle size={16} className="shrink-0 mt-0.5" />
                            <span>All activities have been removed. Add some back or discard this import.</span>
                        </div>
                    )}

                    {error && (
                        <div className="flex items-start gap-sm p-sm rounded-md text-sm mt-md" style={{ backgroundColor: 'color-mix(in srgb, var(--error-color) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--error-color) 25%, transparent)', color: 'var(--error-color)', lineHeight: 1.4 }}>
                            <AlertCircle size={16} className="shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Saving Stage */}
            {mode === 'import' && stage === 'saving' && (
                <div className="flex flex-col items-center gap-sm text-tertiary" style={{ padding: '3rem 0' }}>
                    <Loader2 size={32} className="spin" />
                    <p>{isAppending ? 'Adding activities...' : 'Creating trip and activities...'}</p>
                </div>
            )}

            {/* Done Stage */}
            {mode === 'import' && stage === 'done' && parsed && (
                <div className="flex flex-col items-center text-center gap-sm" style={{ padding: '3rem 1rem' }}>
                    <div className="sticky-actions mobile-actions w-full" style={{ position: 'relative', top: 'unset', marginBottom: '1.5rem' }}>
                        <button className="btn btn-ghost mobile-discard" onClick={handleAddMore}>
                            Add More Days
                        </button>
                        <div className="flex gap-sm items-center mobile-actions-right">
                            <button className="btn btn-ghost" onClick={() => {
                                setRawText('');
                                setParsed(null);
                                setStage('input');
                            }}>
                                New Trip
                            </button>
                            <button className="btn btn-primary" onClick={() => {
                                setRawText('');
                                setParsed(null);
                                setStage('input');
                                navigate('/spreadsheet');
                            }}>
                                View Trips
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center justify-center text-secondary mb-sm" style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'color-mix(in srgb, var(--secondary-color) 12%, transparent)' }}>
                        <Check size={40} />
                    </div>
                    <h2 className="text-xl">{isAppending ? 'Activities Added' : 'Trip Created'}</h2>
                    <p className="text-secondary text-sm mb-sm">
                        "{activeTripName ?? parsed.tripName}" now has {totalImported} activit{totalImported === 1 ? 'y' : 'ies'}.
                    </p>
                </div>
            )}
        </div>
    );
};

export default ImportItinerary;
