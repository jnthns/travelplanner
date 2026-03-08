import React, { useState, useRef, useEffect, useMemo } from 'react';
import { generateWithGemini } from '../lib/gemini';
import { useTrips, useActivities, useNotes, useChatHistory } from '../lib/store';
import { Send, Bot, User, Loader2, CalendarPlus, StickyNote, Check } from 'lucide-react';
import Markdown from '../components/Markdown';

const Assistant: React.FC = () => {
    const { trips } = useTrips();
    const { activities, addActivity } = useActivities();
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
    const [importedPayloads, setImportedPayloads] = useState<Record<string, boolean>>({});
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const selectedTrip = trips.find(t => t.id === selectedTripId);

    const tripContext = useMemo(() => {
        if (!selectedTrip) return "No trip selected.";
        const tripActs = activities
            .filter(a => a.tripId === selectedTripId)
            .sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order)
            .map(a => `Date: ${a.date} | Time: ${a.time || 'TBD'} | Activity: ${a.title} | Location: ${a.location || 'none'} | Cost: ${a.cost || 'none'}`)
            .join('\n');

        return `ACTIVE TRIP CONTEXT:
Name: ${selectedTrip.name}
Dates: ${selectedTrip.startDate} to ${selectedTrip.endDate}
Destinations: ${Object.values(selectedTrip.dayLocations || {}).join(', ')}

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
            } as Omit<import('../lib/types').Note, 'id' | 'userId' | 'tripMembers'>, selectedTrip?.members || []);
            setSavedNotes(prev => ({ ...prev, [msgId]: true }));
        } catch (e) {
            console.error('Failed to save note', e);
        }
    };

    const handleImportPayload = async (msgId: string, payloadData: any[]) => {
        if (!selectedTripId || importedPayloads[msgId]) return;
        try {
            for (let i = 0; i < payloadData.length; i++) {
                const act = payloadData[i];
                await addActivity({
                    tripId: selectedTripId,
                    date: act.date,
                    title: act.title,
                    details: act.details || '',
                    time: act.time || null,
                    location: act.location || '',
                    category: act.category || 'other',
                    order: i * 10
                } as Omit<import('../lib/types').Activity, 'id' | 'userId' | 'tripMembers'>, selectedTrip?.members || []);
            }
            setImportedPayloads(prev => ({ ...prev, [msgId]: true }));
        } catch (e) {
            console.error('Failed to import activities', e);
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
        setInput('');
        setIsLoading(true);

        try {
            // Immediately sync to Firebase
            await addMessage({
                tripId: selectedTripId,
                tripMembers: selectedTrip?.members || [],
                role: 'user',
                content: userMsg,
                createdAt: new Date().toISOString()
            });

            const currentHistory = displayMessages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');
            const prompt = `Chat History:\n${currentHistory}\n\nUser: ${userMsg}\n\nAssistant:`;

            const systemInstruction = `You are a direct, concise travel assistant. Adhere strictly to these rules: 
            1. Answer in 400 words maximum.
            2. Be direct and avoid superlative chatter or overly enthusiastic language.
            3. Use bullet points heavily.
            4. Use emojis.
            5. Base your answers on the user's active trip context below.

            When you are asked to generate or suggest an itinerary, you must return the data following this structure so it is compatible with the app's format:
            - Preix with a short summary on what to optimize for the trip duration with a newline and line divider at the end of the summary.
            - Activities must have a title, an explicit category (sightseeing, food, accommodation, transport, shopping, other), and explicit 24-hour time HH:mm format.
            - Anchor times specifically around Morning (09:00), Afternoon (13:00), and Evening (18:00) blocks if unknown.
            - Add "transport" category activities to account for geographic travel times between distant points.
            - Limit sightseeing to 3-6 heavy activities per day to prioritize realistic pacing.
            - IMPORTANT: You MUST append the raw output JSON array at the very end of your message, separated by exactly "---PAYLOAD---".
            Example:
            [Your conversational response...]
            ---PAYLOAD---
            [
              { "date": "2026-08-31", "title": "Arrive KIX", "time": "19:00", "category": "transport", "details": "Clear customs", "location": "Kansai Airport" }
            ]

            ${tripContext}`;

            const responseText = await generateWithGemini(prompt, {
                systemInstruction
            });

            await addMessage({
                tripId: selectedTripId,
                tripMembers: selectedTrip?.members || [],
                role: 'model',
                content: responseText,
                createdAt: new Date().toISOString()
            });

        } catch (error) {
            console.error('Chat error:', error);
            try {
                await addMessage({
                    tripId: selectedTripId,
                    tripMembers: selectedTrip?.members || [],
                    role: 'model',
                    content: '⚠️ Sorry, I encountered an error answering your question. Please try again.',
                    createdAt: new Date().toISOString()
                });
            } catch (e) {
                // Ignore nested save errors, probably a permissions or network bug causing the main throw anyway
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="page-container flex flex-col h-full overflow-hidden animate-fade-in" style={{ maxHeight: 'calc(100vh - 100px)' }}>
            <header className="page-header mb-md">
                <div>
                    <h1>Travel Assistant</h1>
                    <p>Context-aware AI help for your planning.</p>
                </div>
            </header>

            <div className="card p-md mb-md">
                <select
                    className="input-field w-full"
                    value={selectedTripId || ''}
                    onChange={e => setSelectedTripId(e.target.value || null)}
                >
                    <option value="">Select a trip for context...</option>
                    {trips.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>
            </div>

            <div className="card flex flex-col flex-1 overflow-hidden p-0" style={{ marginBottom: '1rem' }}>
                <div className="flex-1 overflow-y-auto p-lg flex flex-col gap-lg">
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
                                <div className={`flex gap-md items-start ${msg.role === 'user' ? 'flex-row-reverse' : ''}`} style={{ maxWidth: '85%' }}>
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
                                            <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
                                                <button
                                                    className="btn btn-outline"
                                                    style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
                                                    onClick={() => handleSaveNote(msg.id, textContent)}
                                                    disabled={savedNotes[msg.id]}
                                                >
                                                    {savedNotes[msg.id] ? <Check size={14} /> : <StickyNote size={14} />}
                                                    {savedNotes[msg.id] ? 'Saved' : 'Save as Note'}
                                                </button>

                                                {payloadData && Array.isArray(payloadData) && selectedTripId && (
                                                    <button
                                                        className="btn btn-primary"
                                                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
                                                        onClick={() => handleImportPayload(msg.id, payloadData)}
                                                        disabled={importedPayloads[msg.id]}
                                                    >
                                                        {importedPayloads[msg.id] ? <Check size={14} /> : <CalendarPlus size={14} />}
                                                        {importedPayloads[msg.id] ? 'Imported' : 'Import Activities'}
                                                    </button>
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
                            <div className="flex gap-md items-start" style={{ maxWidth: '85%' }}>
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

                <form className="flex gap-md p-md bg-surface-1 border-t" style={{ borderBottomLeftRadius: 'var(--radius-lg)', borderBottomRightRadius: 'var(--radius-lg)' }} onSubmit={handleSubmit}>
                    <textarea
                        className="input-field flex-1 mb-0"
                        placeholder="Ask about your itinerary..."
                        value={input}
                        onChange={(e) => {
                            setInput(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
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
