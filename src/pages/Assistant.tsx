import React, { useState, useRef, useEffect, useMemo } from 'react';
import { generateWithGemini } from '../lib/gemini';
import { useTrips, useActivities } from '../lib/store';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import Markdown from '../components/Markdown';
import './Assistant.css';

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
        <div className="page-container assistant-page animate-fade-in">
            <header className="page-header">
                <div>
                    <h1>Travel Assistant</h1>
                    <p>Context-aware AI help for your planning.</p>
                </div>
            </header>

            <div className="assistant-controls card">
                <select
                    className="input-field trip-select"
                    value={selectedTripId || ''}
                    onChange={e => setSelectedTripId(e.target.value || null)}
                >
                    <option value="">Select a trip for context...</option>
                    {trips.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>
            </div>

            <div className="chat-container card">
                <div className="chat-messages">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`chat-message ${msg.role}`}>
                            <div className="message-avatar">
                                {msg.role === 'model' ? <Bot size={20} /> : <User size={20} />}
                            </div>
                            <div className="message-bubble">
                                <Markdown>{msg.content}</Markdown>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="chat-message model">
                            <div className="message-avatar"><Bot size={20} /></div>
                            <div className="message-bubble loading-bubble">
                                <Loader2 size={16} className="spin" /> Thinking...
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <form className="chat-input-area" onSubmit={handleSubmit}>
                    <input
                        type="text"
                        className="input-field"
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
