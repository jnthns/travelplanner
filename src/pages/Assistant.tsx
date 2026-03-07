import React, { useState, useRef, useEffect, useMemo } from 'react';
import { generateWithGemini } from '../lib/gemini';
import { useTrips, useActivities } from '../lib/store';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import Markdown from '../components/Markdown';

interface Message {
    id: string;
    role: 'user' | 'model';
    content: string;
}

const Assistant: React.FC = () => {
    const { trips } = useTrips();
    const { activities } = useActivities();

    // Load last selected trip from local storage to match timeline preferences
    const [selectedTripId, setSelectedTripId] = useState<string | null>(() => {
        try {
            const raw = localStorage.getItem('travelplanner_calendar_view');
            if (raw) return JSON.parse(raw).selectedTripId;
        } catch { /* ignore */ }
        return null;
    });

    const [messages, setMessages] = useState<Message[]>([
        { id: 'welcome', role: 'model', content: "Hello! I'm your travel assistant. Select a trip and ask me anything about your itinerary, budget, or destination! 🌍" }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
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
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg = input.trim();
        setInput('');

        const newMessage: Message = { id: Date.now().toString(), role: 'user', content: userMsg };
        setMessages(prev => [...prev, newMessage]);
        setIsLoading(true);

        const currentHistory = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');

        const prompt = `Chat History:\n${currentHistory}\n\nUser: ${userMsg}\n\nAssistant:`;

        try {
            const systemInstruction = `You are a direct, concise travel assistant. Adhere strictly to these rules: 
            1. Answer in 200 words maximum.
            2. Be direct and avoid superlative chatter or overly enthusiastic language.
            3. Use bullet points heavily.
            4. Use emojis.
            5. Base your answers on the user's active trip context below.

            When you are asked to generate or suggest an itinerary, you must return the data following this structure so it is compatible with the app's format:
            - Activities must have a title, an explicit category (sightseeing, food, accommodation, transport, shopping, other), and explicit 24-hour time HH:mm format.
            - Anchor times specifically around Morning (09:00), Afternoon (13:00), and Evening (18:00) blocks if unknown.
            - Add "transport" category activities to account for geographic travel times between distant points.
            - Limit sightseeing to 3-6 heavy activities per day to prioritize realistic pacing.

            ${tripContext}`;

            const responseText = await generateWithGemini(prompt, {
                maxTokens: 500,
                systemInstruction
            });

            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: responseText }]);
        } catch (error) {
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: '⚠️ Sorry, I encountered an error answering your question. Please try again.' }]);
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
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex gap-md items-start ${msg.role === 'user' ? 'flex-row-reverse self-end' : ''}`} style={{ maxWidth: '85%' }}>
                            <div className="flex items-center justify-center shrink-0 rounded-full bg-surface-1"
                                style={{
                                    width: '36px', height: '36px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)',
                                    ...(msg.role === 'user' ? { backgroundColor: 'var(--primary-color)', color: 'white', borderColor: 'var(--primary-color)' } : {})
                                }}>
                                {msg.role === 'model' ? <Bot size={20} /> : <User size={20} />}
                            </div>
                            <div className="bg-surface-1 border-b"
                                style={{
                                    padding: '1rem 1.25rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)',
                                    lineHeight: 1.5,
                                    ...(msg.role === 'user' ? {
                                        backgroundColor: 'var(--primary-color)', color: 'white', borderColor: 'var(--primary-color)',
                                        borderTopRightRadius: '4px', borderTopLeftRadius: 'var(--radius-lg)'
                                    } : { borderTopLeftRadius: '4px' })
                                }}>
                                <Markdown>{msg.content}</Markdown>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex gap-md items-start" style={{ maxWidth: '85%' }}>
                            <div className="flex items-center justify-center shrink-0 rounded-full bg-surface-1" style={{ width: '36px', height: '36px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                <Bot size={20} />
                            </div>
                            <div className="flex items-center gap-sm text-secondary" style={{ fontStyle: 'italic' }}>
                                <Loader2 size={16} className="spin" /> Thinking...
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <form className="flex gap-md p-md bg-surface-1 border-t" style={{ borderBottomLeftRadius: 'var(--radius-lg)', borderBottomRightRadius: 'var(--radius-lg)' }} onSubmit={handleSubmit}>
                    <input
                        type="text"
                        className="input-field flex-1 mb-0"
                        placeholder="Ask about your itinerary..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={isLoading}
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
