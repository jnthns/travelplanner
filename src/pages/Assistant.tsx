import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrips, useActivities, useNotes, useChatHistory, useTransportRoutes } from '../lib/store';
import { useTripScenarios } from '../lib/scenarios';
import ScenarioSwitcher from '../components/ScenarioSwitcher';
import { Send, Bot, User, Loader2, CalendarPlus, StickyNote, Check, ChevronDown } from 'lucide-react';
import Markdown from '../components/Markdown';
import { generateAssistantResponse } from '../lib/ai/actions/assistant';
import { eachDayOfInterval, format, parseISO } from 'date-fns';
import { compareActivitiesByTimeThenOrder, getEffectiveDayLocations } from '../lib/itinerary';

const Assistant: React.FC = () => {
    const navigate = useNavigate();
    const { trips, updateTrip } = useTrips();
    const { activities } = useActivities();
    const { getRoutesByTrip } = useTransportRoutes();
    const { addNote } = useNotes();

    // Load last selected trip from local storage to match timeline preferences
    const [selectedTripId, setSelectedTripId] = useState<string | null>(() => {
        try {
            const raw = localStorage.getItem('travelplanner_calendar_view');
            if (raw) return JSON.parse(raw).selectedTripId;
        } catch { /* ignore */ }
        return null;
    });

    const { messages, addMessage } = useChatHistory(selectedTripId);

    // Virtual array combining hardcoded welcome message and live history
    const displayMessages = useMemo(() => {
        const welcome = { id: 'welcome', role: 'model' as const, content: "Hello! I'm your travel assistant. Select a trip and ask me anything about your itinerary, budget, or destination! 🌍" };
        if (!selectedTripId) return [welcome];
        return [welcome, ...messages];
    }, [messages, selectedTripId]);

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [savedNotes, setSavedNotes] = useState<Record<string, boolean>>({});
    const [importedPayloads] = useState<Record<string, boolean>>({});
    const [importMenuOpenFor, setImportMenuOpenFor] = useState<string | null>(null);
    const [prefsExpanded, setPrefsExpanded] = useState(false);
    const [prefPace, setPrefPace] = useState<'relaxed' | 'balanced' | 'fast'>('balanced');
    const [prefBudget, setPrefBudget] = useState<'budget' | 'mid-range' | 'luxury' | ''>('');
    const [prefGroupType, setPrefGroupType] = useState<'solo' | 'couple' | 'family' | 'group' | ''>('');
    const [prefInterests, setPrefInterests] = useState('');
    const [prefDietaryNeeds, setPrefDietaryNeeds] = useState('');
    const [prefAccessibilityNeeds, setPrefAccessibilityNeeds] = useState('');
    const [prefTransportPreference, setPrefTransportPreference] = useState('');
    const [prefMustHave, setPrefMustHave] = useState('');
    const [prefAvoid, setPrefAvoid] = useState('');
    const [prefNotes, setPrefNotes] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const selectedTrip = trips.find(t => t.id === selectedTripId);
    const { activeScenarioId, activeScenario } = useTripScenarios(selectedTripId);
    const effectiveTrip = activeScenario?.tripSnapshot ?? selectedTrip;

    const resetPrefsFromTrip = useCallback(() => {
        if (!selectedTrip) return;
        const prefs = selectedTrip.aiPreferences;
        setPrefPace(prefs?.pace || 'balanced');
        setPrefBudget(prefs?.budget || '');
        setPrefGroupType(prefs?.groupType || '');
        setPrefInterests((prefs?.interests || []).join(', '));
        setPrefDietaryNeeds(prefs?.dietaryNeeds || '');
        setPrefAccessibilityNeeds(prefs?.accessibilityNeeds || '');
        setPrefTransportPreference(prefs?.transportPreference || '');
        setPrefMustHave(prefs?.mustHave || '');
        setPrefAvoid(prefs?.avoid || '');
        setPrefNotes(prefs?.notes || '');
    }, [selectedTrip]);

    /** Shown so user knows which trip (and Live vs draft) Import will edit. */
    const editingContextLabel = useMemo(() => {
        if (!selectedTrip) return null;
        if (!activeScenarioId || !activeScenario) return `${selectedTrip.name} (Live)`;
        return `${selectedTrip.name} → ${activeScenario.name}`;
    }, [selectedTrip, activeScenarioId, activeScenario]);

    const assistantTripActivities = useMemo(() => selectedTripId ? activities.filter(a => a.tripId === selectedTripId) : [], [selectedTripId, activities]);
    const assistantTripRoutes = useMemo(() => selectedTripId ? getRoutesByTrip(selectedTripId) : [], [selectedTripId, getRoutesByTrip]);

    useEffect(() => {
        if (!selectedTrip) return;
        const prefs = selectedTrip.aiPreferences;
        setPrefPace(prefs?.pace || 'balanced');
        setPrefBudget(prefs?.budget || '');
        setPrefGroupType(prefs?.groupType || '');
        setPrefInterests((prefs?.interests || []).join(', '));
        setPrefDietaryNeeds(prefs?.dietaryNeeds || '');
        setPrefAccessibilityNeeds(prefs?.accessibilityNeeds || '');
        setPrefTransportPreference(prefs?.transportPreference || '');
        setPrefMustHave(prefs?.mustHave || '');
        setPrefAvoid(prefs?.avoid || '');
        setPrefNotes(prefs?.notes || '');
    }, [selectedTripId, selectedTrip?.id]);

    const saveAiPreferences = async () => {
        if (!selectedTripId || !selectedTrip) return;
        const interests = prefInterests.split(',').map((v) => v.trim()).filter(Boolean);
        await updateTrip(selectedTripId, {
            aiPreferences: {
                pace: prefPace,
                budget: prefBudget || undefined,
                groupType: prefGroupType || undefined,
                interests: interests.length > 0 ? interests : undefined,
                dietaryNeeds: prefDietaryNeeds.trim() || undefined,
                accessibilityNeeds: prefAccessibilityNeeds.trim() || undefined,
                transportPreference: prefTransportPreference.trim() || undefined,
                mustHave: prefMustHave.trim() || undefined,
                avoid: prefAvoid.trim() || undefined,
                notes: prefNotes.trim() || undefined,
            },
        });
    };


    const tripContext = useMemo(() => {
        if (!effectiveTrip) return "No trip selected.";
        const tripActs = activities
            .filter(a => a.tripId === selectedTripId)
            .sort((a, b) => a.date.localeCompare(b.date) || compareActivitiesByTimeThenOrder(a, b))
            .map(a => `Date: ${a.date} | Time: ${a.time || 'TBD'} | Activity: ${a.title} | Location: ${a.location || 'none'} | Cost: ${a.cost || 'none'}`)
            .join('\n');

        return `ACTIVE TRIP CONTEXT:
Name: ${effectiveTrip.name}
Dates: ${effectiveTrip.startDate} to ${effectiveTrip.endDate}
Destinations: ${(() => {
          try {
            const dates = eachDayOfInterval({
              start: parseISO(effectiveTrip.startDate),
              end: parseISO(effectiveTrip.endDate),
            }).map(d => format(d, 'yyyy-MM-dd'));
            const all = dates.flatMap(date =>
              getEffectiveDayLocations(effectiveTrip.itinerary?.[date], effectiveTrip.dayLocations?.[date])
            );
            return [...new Set(all)].filter(Boolean).join(', ') || 'Not set';
          } catch { return 'Not set'; }
        })()}

ACTIVITIES:
${tripActs || "None planned yet."}

AI_PREFERENCES:
Pace: ${effectiveTrip.aiPreferences?.pace || 'balanced'}
Budget: ${effectiveTrip.aiPreferences?.budget || 'none set'}
Traveling as: ${effectiveTrip.aiPreferences?.groupType || 'none set'}
Interests: ${(effectiveTrip.aiPreferences?.interests || []).join(', ') || 'none set'}
Transport preference: ${effectiveTrip.aiPreferences?.transportPreference || 'none set'}
Must-haves: ${effectiveTrip.aiPreferences?.mustHave || 'none set'}
Dietary: ${effectiveTrip.aiPreferences?.dietaryNeeds || 'none set'}
Accessibility: ${effectiveTrip.aiPreferences?.accessibilityNeeds || 'none set'}
Avoid: ${effectiveTrip.aiPreferences?.avoid || 'none set'}
Notes: ${effectiveTrip.aiPreferences?.notes || 'none set'}`;
    }, [effectiveTrip, selectedTripId, activities]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [displayMessages]);

    const handleSaveNote = async (msgId: string, content: string) => {
        if (!selectedTripId) {
            alert('Please select a trip context from the dropdown above to attach a note to.');
            return;
        }
        if (savedNotes[msgId]) return;
        try {
            await addNote({
                tripId: selectedTripId,
                title: 'AI Travel Recommendation',
                content: content,
                format: 'freeform',
                order: Date.now(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            } as Omit<import('../lib/types').Note, 'id' | 'userId' | 'tripMembers'>, selectedTrip?.members || [selectedTrip?.userId].filter(Boolean) as string[]);
            setSavedNotes(prev => ({ ...prev, [msgId]: true }));
        } catch (e) {
            console.error('Failed to save note', e);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        if (!selectedTripId) {
            alert('Please select a trip from the dropdown above to start chatting.');
            return;
        }

        const userMsg = input.trim();
        if (!userMsg) return;

        // Ensure trip data is loaded before allowing chat (avoids empty tripMembers rejection)
        if (!selectedTrip) {
            alert('Loading trip details... please wait a moment.');
            return;
        }

        setInput('');
        setIsLoading(true);

        const tripMembers = selectedTrip.members || [selectedTrip.userId];

        try {
            // Immediately sync to Firebase
            await addMessage({
                tripId: selectedTripId,
                role: 'user',
                content: userMsg,
                createdAt: new Date().toISOString()
            }, tripMembers);

            const currentHistory = displayMessages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');
            const responseText = await generateAssistantResponse({
                userMessage: userMsg,
                currentHistory,
                tripContext,
            });

            await addMessage({
                tripId: selectedTripId,
                role: 'model',
                content: responseText,
                createdAt: new Date().toISOString()
            }, tripMembers);

        } catch (error) {
            console.error('Chat error:', error);
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            try {
                await addMessage({
                    tripId: selectedTripId,
                    role: 'model',
                    content: `⚠️ ${errorMsg}`,
                    createdAt: new Date().toISOString()
                }, tripMembers);
            } catch (e) {
                // Ignore nested save errors
            }
        } finally {
            setIsLoading(false);
        }
    };

    const setPrefsCount = useMemo(() => {
        const prefs = selectedTrip?.aiPreferences;
        if (!prefs) return 0;
        return [
            prefs.pace && prefs.pace !== 'balanced',
            prefs.budget,
            prefs.groupType,
            prefs.interests && prefs.interests.length > 0,
            prefs.dietaryNeeds,
            prefs.accessibilityNeeds,
            prefs.transportPreference,
            prefs.mustHave,
            prefs.avoid,
            prefs.notes,
        ].filter(Boolean).length;
    }, [selectedTrip]);

    return (
        <div className="page-container flex flex-col h-full overflow-hidden animate-fade-in assistant-page" style={{ maxHeight: 'calc(100vh - 100px)' }}>
            <style>{`
                @media (max-width: 768px) {
                    .assistant-page .assistant-message-row { max-width: 95% !important; }
                    .assistant-page .assistant-loading-row { max-width: 95% !important; }
                    .assistant-page .assistant-form .input-field { min-width: 0; flex: 1 1 100%; }
                }
                .prefs-drawer-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 10px;
                }
                .prefs-drawer-label {
                    display: block;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    margin-bottom: 4px;
                }
                .prefs-drawer-toggle {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 10px 14px;
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: var(--text-color);
                    gap: 8px;
                }
                .prefs-drawer-toggle:hover { background: var(--surface-hover, rgba(0,0,0,0.04)); }
                .prefs-drawer-body {
                    padding: 0 14px 14px;
                    overflow-y: auto;
                    max-height: clamp(200px, 42vh, 380px);
                }
                .prefs-chevron {
                    transition: transform 0.2s;
                    flex-shrink: 0;
                    color: var(--text-secondary);
                }
                .prefs-chevron.open { transform: rotate(180deg); }
                .prefs-set-badge {
                    font-size: 0.7rem;
                    font-weight: 700;
                    padding: 1px 6px;
                    border-radius: 999px;
                    background: var(--primary-color);
                    color: white;
                    line-height: 1.6;
                }
            `}</style>
            <header className="page-header mb-md">
                <div>
                    <h1>Trip Assistant</h1>
                    <p>AI that knows your trip — ask about alternatives, budget, timing, or get a full itinerary suggestion.</p>
                </div>
            </header>

            <div className="card p-md mb-md">
                <div className="flex flex-wrap items-center gap-2">
                    <select
                        className="input-field"
                        style={{ flex: '1 1 200px', minWidth: 0, maxWidth: '100%' }}
                        value={selectedTripId || ''}
                        onChange={e => {
                            const id = e.target.value || null;
                            setSelectedTripId(id);
                            if (id) {
                                try {
                                    const raw = localStorage.getItem('travelplanner_calendar_view') || '{}';
                                    const parsed = JSON.parse(raw);
                                    localStorage.setItem('travelplanner_calendar_view', JSON.stringify({ ...parsed, selectedTripId: id }));
                                } catch { /* ignore */ }
                            }
                        }}
                    >
                        <option value="">Select a trip for context...</option>
                        {trips.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                    {selectedTrip && (
                        <ScenarioSwitcher trip={selectedTrip} activities={assistantTripActivities} routes={assistantTripRoutes} />
                    )}
                </div>
                {selectedTripId && (
                    <div className="mt-2 text-xs flex justify-between items-center flex-wrap gap-1" style={{ color: 'var(--text-secondary)' }}>
                        {editingContextLabel && (
                            <span className="font-medium" style={{ color: 'var(--text-color)' }}>
                                Editing: {editingContextLabel}
                            </span>
                        )}
                        <span>{messages.length} messages loaded</span>
                    </div>
                )}
            </div>

            {/* ── AI Preferences inline drawer ── */}
            {selectedTrip && (
                <div className="card p-0 mb-md" style={{ overflow: 'hidden' }}>
                    <button
                        type="button"
                        className="prefs-drawer-toggle"
                        onClick={() => setPrefsExpanded(v => !v)}
                        aria-expanded={prefsExpanded}
                    >
                        <div className="flex items-center gap-sm" style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                            <Bot size={15} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                            AI Preferences
                            {setPrefsCount > 0 && (
                                <span className="prefs-set-badge">{setPrefsCount}</span>
                            )}
                        </div>
                        <ChevronDown size={15} className={`prefs-chevron${prefsExpanded ? ' open' : ''}`} />
                    </button>

                    {prefsExpanded && (
                        <div className="prefs-drawer-body">
                            <div className="prefs-drawer-grid">
                                <div>
                                    <label className="prefs-drawer-label">Pace</label>
                                    <select className="input-field" value={prefPace} onChange={(e) => setPrefPace(e.target.value as 'relaxed' | 'balanced' | 'fast')}>
                                        <option value="relaxed">Relaxed</option>
                                        <option value="balanced">Balanced</option>
                                        <option value="fast">Fast-paced</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="prefs-drawer-label">Budget tier</label>
                                    <select className="input-field" value={prefBudget} onChange={(e) => setPrefBudget(e.target.value as 'budget' | 'mid-range' | 'luxury' | '')}>
                                        <option value="">Not specified</option>
                                        <option value="budget">Budget</option>
                                        <option value="mid-range">Mid-range</option>
                                        <option value="luxury">Luxury</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="prefs-drawer-label">Traveling as</label>
                                    <select className="input-field" value={prefGroupType} onChange={(e) => setPrefGroupType(e.target.value as 'solo' | 'couple' | 'family' | 'group' | '')}>
                                        <option value="">Not specified</option>
                                        <option value="solo">Solo</option>
                                        <option value="couple">Couple</option>
                                        <option value="family">Family</option>
                                        <option value="group">Group</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="prefs-drawer-label">Interests</label>
                                    <input className="input-field" value={prefInterests} onChange={(e) => setPrefInterests(e.target.value)} placeholder="food, history, beaches..." />
                                </div>

                                <div>
                                    <label className="prefs-drawer-label">Transport preference</label>
                                    <input className="input-field" value={prefTransportPreference} onChange={(e) => setPrefTransportPreference(e.target.value)} placeholder="public transit, walking..." />
                                </div>

                                <div>
                                    <label className="prefs-drawer-label">Must-haves</label>
                                    <input className="input-field" value={prefMustHave} onChange={(e) => setPrefMustHave(e.target.value)} placeholder="beach day, local market..." />
                                </div>

                                <div>
                                    <label className="prefs-drawer-label">Dietary needs</label>
                                    <input className="input-field" value={prefDietaryNeeds} onChange={(e) => setPrefDietaryNeeds(e.target.value)} placeholder="vegetarian, halal..." />
                                </div>

                                <div>
                                    <label className="prefs-drawer-label">Accessibility needs</label>
                                    <input className="input-field" value={prefAccessibilityNeeds} onChange={(e) => setPrefAccessibilityNeeds(e.target.value)} placeholder="wheelchair-friendly..." />
                                </div>

                                <div>
                                    <label className="prefs-drawer-label">Avoid</label>
                                    <input className="input-field" value={prefAvoid} onChange={(e) => setPrefAvoid(e.target.value)} placeholder="long hikes, tourist traps..." />
                                </div>

                                <div>
                                    <label className="prefs-drawer-label">Notes</label>
                                    <input className="input-field" value={prefNotes} onChange={(e) => setPrefNotes(e.target.value)} placeholder="honeymoon, anniversary..." />
                                </div>
                            </div>

                            <div className="flex gap-sm justify-end mt-md pt-sm" style={{ borderTop: '1px solid var(--border-color)' }}>
                                <button type="button" className="btn btn-ghost btn-sm" onClick={resetPrefsFromTrip}>
                                    Reset
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={() => void saveAiPreferences().then(() => setPrefsExpanded(false))}
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="card flex flex-col flex-1 overflow-hidden p-0" style={{ marginBottom: '1rem' }}>
                <div className="flex-1 overflow-y-auto p-lg flex flex-col gap-lg">
                    {messages.length === 0 && !isLoading && selectedTripId && (
                        <div className="text-center text-secondary py-lg opacity-60">
                            <p>No messages in the last 7 days.</p>
                            <p style={{ fontSize: '0.8rem' }}>Start typing below to chat!</p>
                        </div>
                    )}

                    {displayMessages.map((msg) => {
                        const isModel = msg.role === 'model';
                        let textContent = msg.content;
                        let payloadData = null;

                        if (isModel && textContent.includes('---PAYLOAD---')) {
                            const parts = textContent.split('---PAYLOAD---');
                            textContent = parts[0].trim();
                            try {
                                const jsonStr = parts[1].replace(/```json/g, '').replace(/```/g, '').trim();
                                payloadData = JSON.parse(jsonStr);
                            } catch (e) {
                                console.error("Failed to parse AI payload", e);
                            }
                        }

                        return (
                            <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
                                <div className={`flex gap-md items-start assistant-message-row ${msg.role === 'user' ? 'flex-row-reverse' : ''}`} style={{ maxWidth: '85%' }}>
                                    <div className="flex items-center justify-center shrink-0 rounded-full bg-surface-1"
                                        style={{
                                            width: '36px', height: '36px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)',
                                        }}>
                                        {msg.role === 'model' ? <Bot size={20} /> : <User size={20} />}
                                    </div>
                                    <div className="bg-surface-1 border"
                                        style={{
                                            padding: '1rem 1.25rem', borderRadius: 'var(--radius-lg)',
                                            lineHeight: 1.5,
                                            ...(msg.role === 'user' ? {
                                                backgroundColor: 'var(--primary-color)', color: 'white', borderColor: 'var(--primary-color)',
                                                borderTopRightRadius: '4px'
                                            } : { borderColor: 'var(--border-color)', borderTopLeftRadius: '4px' })
                                        }}>
                                        <Markdown>{textContent}</Markdown>

                                        {isModel && msg.id !== 'welcome' && (
                                            <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
                                                <button
                                                    type="button"
                                                    className="btn btn-outline shrink-0"
                                                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                                                    onClick={() => handleSaveNote(msg.id, textContent)}
                                                    disabled={savedNotes[msg.id]}
                                                >
                                                    {savedNotes[msg.id] ? <Check size={14} /> : <StickyNote size={14} />}
                                                    <span>{savedNotes[msg.id] ? 'Saved' : 'Save as Note'}</span>
                                                </button>

                                                {payloadData && Array.isArray(payloadData) && (
                                                    <div className="relative shrink-0">
                                                        <button
                                                            type="button"
                                                            className="btn btn-primary"
                                                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                                                            onClick={() => setImportMenuOpenFor(importMenuOpenFor === msg.id ? null : msg.id)}
                                                            disabled={importedPayloads[msg.id]}
                                                        >
                                                            {importedPayloads[msg.id] ? <Check size={14} /> : <CalendarPlus size={14} />}
                                                            <span>{importedPayloads[msg.id] ? 'Imported' : 'Import Activities'}</span>
                                                            {!importedPayloads[msg.id] && <ChevronDown size={14} />}
                                                        </button>
                                                        {importMenuOpenFor === msg.id && (
                                                            <>
                                                                <div
                                                                    className="fixed inset-0 z-10"
                                                                    aria-hidden
                                                                    onClick={() => setImportMenuOpenFor(null)}
                                                                />
                                                                <div
                                                                    className="absolute left-0 mt-1 z-20 rounded-lg border shadow-lg overflow-hidden flex flex-col"
                                                                    style={{
                                                                        borderColor: 'var(--border-color)',
                                                                        backgroundColor: 'var(--surface-color)',
                                                                        minWidth: 'clamp(200px, 90vw, 280px)',
                                                                    }}
                                                                >
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-outline rounded-none border-b border-t-0 border-l-0 border-r-0 w-full justify-start text-left"
                                                                        style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', gap: '0.35rem' }}
                                                                        onClick={() => {
                                                                            setImportMenuOpenFor(null);
                                                                            if (selectedTripId) {
                                                                                navigate('/import', {
                                                                                    state: {
                                                                                        fromAssistant: true,
                                                                                        payload: payloadData,
                                                                                        importMode: 'overwrite_trip',
                                                                                        preselectedTripId: selectedTripId,
                                                                                        activeScenarioId: activeScenarioId ?? undefined,
                                                                                        activeScenarioName: activeScenario?.name,
                                                                                    },
                                                                                });
                                                                            }
                                                                        }}
                                                                        disabled={!selectedTripId}
                                                                    >
                                                                        <CalendarPlus size={14} className="shrink-0" />
                                                                        <span>Overwrite existing trip</span>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-outline rounded-none border-b border-t-0 border-l-0 border-r-0 w-full justify-start text-left"
                                                                        style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', gap: '0.35rem' }}
                                                                        onClick={() => {
                                                                            setImportMenuOpenFor(null);
                                                                            navigate('/import', {
                                                                                state: {
                                                                                    fromAssistant: true,
                                                                                    payload: payloadData,
                                                                                    importMode: 'add_to_day',
                                                                                    preselectedTripId: selectedTripId ?? undefined,
                                                                                    activeScenarioId: activeScenarioId ?? undefined,
                                                                                    activeScenarioName: activeScenario?.name,
                                                                                },
                                                                            });
                                                                        }}
                                                                    >
                                                                        <CalendarPlus size={14} className="shrink-0" />
                                                                        <span>Add to existing trip (pick day)</span>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-outline rounded-none border-t-0 border-l-0 border-r-0 w-full justify-start text-left"
                                                                        style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', gap: '0.35rem' }}
                                                                        onClick={() => {
                                                                            setImportMenuOpenFor(null);
                                                                            navigate('/import', {
                                                                                state: {
                                                                                    fromAssistant: true,
                                                                                    payload: payloadData,
                                                                                    importMode: 'replace_existing_day',
                                                                                    preselectedTripId: selectedTripId ?? undefined,
                                                                                    activeScenarioId: activeScenarioId ?? undefined,
                                                                                    activeScenarioName: activeScenario?.name,
                                                                                },
                                                                            });
                                                                        }}
                                                                    >
                                                                        <CalendarPlus size={14} className="shrink-0" />
                                                                        <span>Replace existing day</span>
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {isLoading && (
                        <div className="flex w-full justify-start mb-4">
                            <div className="flex gap-md items-start assistant-loading-row" style={{ maxWidth: '85%' }}>
                                <div className="flex items-center justify-center shrink-0 rounded-full bg-surface-1" style={{ width: '36px', height: '36px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                    <Bot size={20} />
                                </div>
                                <div className="flex items-center gap-sm text-secondary" style={{ fontStyle: 'italic', padding: '0.5rem' }}>
                                    <Loader2 size={16} className="spin" /> Thinking...
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <form className="assistant-form flex gap-md p-md bg-surface-1 border-t" style={{ borderBottomLeftRadius: 'var(--radius-lg)', borderBottomRightRadius: 'var(--radius-lg)' }} onSubmit={handleSubmit}>
                    <textarea
                        className="input-field flex-1 mb-0 min-w-0"
                        placeholder="Ask about your itinerary..."
                        value={input}
                        onChange={(e) => {
                            setInput(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit(e as unknown as React.FormEvent);
                            }
                        }}
                        disabled={isLoading}
                        rows={1}
                        style={{
                            resize: 'none',
                            overflowY: 'auto',
                            minHeight: '44px',
                            maxHeight: '150px',
                            lineHeight: '1.5',
                            paddingTop: '0.6rem',
                            paddingBottom: '0.6rem',
                            boxSizing: 'border-box'
                        }}
                    />
                    <button type="submit" className="btn btn-primary" disabled={!input.trim() || isLoading}>
                        <Send size={18} />
                    </button>
                </form>

            </div>
        </div>
    );
};

export default Assistant;
