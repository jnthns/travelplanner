import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrips, useActivities, useNotes, useChatHistory, useTransportRoutes } from '../lib/store';
import { useTripScenarios } from '../lib/scenarios';
import ScenarioSwitcher from '../components/ScenarioSwitcher';
import { Send, Bot, User, Loader2, CalendarPlus, StickyNote, Check, ChevronDown } from 'lucide-react';
import Markdown from '../components/Markdown';
import { generateAssistantResponse } from '../lib/ai/actions/assistant';
import { compareActivitiesByTimeThenOrder, getEffectiveDayLocations } from '../lib/itinerary';

const Assistant: React.FC = () => {
    const navigate = useNavigate();
    const { trips } = useTrips();
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
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const selectedTrip = trips.find(t => t.id === selectedTripId);
    const { activeScenarioId, activeScenario } = useTripScenarios(selectedTripId);

    /** Shown so user knows which trip (and Live vs draft) Import will edit. */
    const editingContextLabel = useMemo(() => {
        if (!selectedTrip) return null;
        if (!activeScenarioId || !activeScenario) return `${selectedTrip.name} (Live)`;
        return `${selectedTrip.name} → ${activeScenario.name}`;
    }, [selectedTrip, activeScenarioId, activeScenario]);

    const assistantTripActivities = useMemo(() => selectedTripId ? activities.filter(a => a.tripId === selectedTripId) : [], [selectedTripId, activities]);
    const assistantTripRoutes = useMemo(() => selectedTripId ? getRoutesByTrip(selectedTripId) : [], [selectedTripId, getRoutesByTrip]);

    const tripContext = useMemo(() => {
        if (!selectedTrip) return "No trip selected.";
        const tripActs = activities
            .filter(a => a.tripId === selectedTripId)
            .sort((a, b) => a.date.localeCompare(b.date) || compareActivitiesByTimeThenOrder(a, b))
            .map(a => `Date: ${a.date} | Time: ${a.time || 'TBD'} | Activity: ${a.title} | Location: ${a.location || 'none'} | Cost: ${a.cost || 'none'}`)
            .join('\n');

        return `ACTIVE TRIP CONTEXT:
Name: ${selectedTrip.name}
Dates: ${selectedTrip.startDate} to ${selectedTrip.endDate}
Destinations: ${(() => {
          const dates: string[] = [];
          try {
            const start = new Date(selectedTrip.startDate + 'T12:00:00Z');
            const end = new Date(selectedTrip.endDate + 'T12:00:00Z');
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
              dates.push(d.toISOString().slice(0, 10));
            }
          } catch { /* ignore */ }
          const all = dates.flatMap((date) =>
            getEffectiveDayLocations(selectedTrip.itinerary?.[date], selectedTrip.dayLocations?.[date])
          );
          return [...new Set(all)].filter(Boolean).join(', ') || 'Not set';
        })()}

ACTIVITIES:
${tripActs || "None planned yet."}`;
    }, [selectedTrip, selectedTripId, activities]);

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
            try {
                await addMessage({
                    tripId: selectedTripId,
                    role: 'model',
                    content: '⚠️ Sorry, I encountered an error answering your question. Please try again.',
                    createdAt: new Date().toISOString()
                }, tripMembers);
            } catch (e) {
                // Ignore nested save errors, probably a permissions or network bug causing the main throw anyway
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="page-container flex flex-col h-full overflow-hidden animate-fade-in assistant-page" style={{ maxHeight: 'calc(100vh - 100px)' }}>
            <style>{`
                @media (max-width: 768px) {
                    .assistant-page .assistant-message-row { max-width: 95% !important; }
                    .assistant-page .assistant-loading-row { max-width: 95% !important; }
                    .assistant-page .assistant-form .input-field { min-width: 0; flex: 1 1 100%; }
                }
            `}</style>
            <header className="page-header mb-md">
                <div>
                    <h1>Travel Assistant</h1>
                    <p>Context-aware AI help for your planning.</p>
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
