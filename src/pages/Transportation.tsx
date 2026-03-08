import React, { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useTrips, useTransportRoutes } from '../lib/store';
import type { TransportRoute } from '../lib/types';
import { TRANSPORT_EMOJIS } from '../lib/types';
import { generateWithGemini } from '../lib/gemini';
import { useLocalStorageState } from '../lib/persist';
import Markdown from '../components/Markdown';
import { useToast } from '../components/Toast';
import { logEvent } from '../lib/amplitude';

const transportTypes = ['flight', 'train', 'bus', 'car', 'ferry', 'taxi', 'walk', 'other'] as const;

const Transportation: React.FC = () => {
    const { trips } = useTrips();
    const { routes, addRoute, updateRoute, deleteRoute, restoreRoute, getRoutesByTrip } = useTransportRoutes();
    const { showToast } = useToast();

    const [selectedTripId, setSelectedTripId] = useLocalStorageState<string | null>(
        'travelplanner_transport_selectedTripId',
        null,
    );
    const [showForm, setShowForm] = useState(false);
    const [editingRoute, setEditingRoute] = useState<TransportRoute | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        date: '',
        type: 'flight' as TransportRoute['type'],
        from: '',
        to: '',
        departureTime: '',
        arrivalTime: '',
        cost: '',
        currency: 'USD',
        bookingRef: '',
        notes: '',
    });
    const [aiRoutesSuggestion, setAiRoutesSuggestion] = useState<string | null>(null);
    const [aiRoutesLoading, setAiRoutesLoading] = useState(false);
    const [aiRoutesError, setAiRoutesError] = useState<string | null>(null);

    const tripRoutes = useMemo(() => {
        if (!selectedTripId) return routes.sort((a, b) => a.date.localeCompare(b.date));
        return getRoutesByTrip(selectedTripId);
    }, [selectedTripId, routes, getRoutesByTrip]);

    const totalCost = useMemo(() => {
        const byCurrency: Record<string, number> = {};
        tripRoutes.forEach(r => {
            if (r.cost) {
                const curr = r.currency || 'USD';
                byCurrency[curr] = (byCurrency[curr] || 0) + r.cost;
            }
        });
        return byCurrency;
    }, [tripRoutes]);

    const selectedTrip = trips.find((t) => t.id === selectedTripId);

    const resetForm = (overrides?: Partial<typeof formData>) => {
        setFormData({
            date: '', type: 'flight', from: '', to: '',
            departureTime: '', arrivalTime: '', cost: '',
            currency: selectedTrip?.defaultCurrency || 'USD',
            bookingRef: '', notes: '',
            ...overrides,
        });
        setEditingRoute(null);
        setShowForm(false);
    };

    const openAddForm = () => {
        setFormData({
            date: '', type: 'flight', from: '', to: '',
            departureTime: '', arrivalTime: '', cost: '',
            currency: selectedTrip?.defaultCurrency || 'USD',
            bookingRef: '', notes: '',
        });
        setEditingRoute(null);
        setShowForm(true);
    };

    const openEditForm = (route: TransportRoute) => {
        setEditingRoute(route);
        setFormData({
            date: route.date,
            type: route.type,
            from: route.from,
            to: route.to,
            departureTime: route.departureTime || '',
            arrivalTime: route.arrivalTime || '',
            cost: route.cost?.toString() || '',
            currency: route.currency || 'USD',
            bookingRef: route.bookingRef || '',
            notes: route.notes || '',
        });
        setShowForm(true);
    };

    const handleSuggestRoutes = async () => {
        if (!formData.from.trim() || !formData.to.trim()) return;
        setAiRoutesLoading(true);
        setAiRoutesError(null);
        setAiRoutesSuggestion(null);
        logEvent('AI Route Suggestion Requested', { from: formData.from.trim(), to: formData.to.trim() });
        const prompt = `From "${formData.from.trim()}" to "${formData.to.trim()}", list the 2-3 most practical transport options. 

For each option use a bullet with:
- Sub-bullets: approximate duration, typical cost range, popularity (e.g. common/niche), and one line description.
- Include a booking or info URL (real link if you know one, or a placeholder like https://example.com) for each option.

Format: short bullet list only. Maximum 200 words. Be direct and factual; avoid superlatives.`;
        try {
            const text = await generateWithGemini(prompt);
            setAiRoutesSuggestion(text);
        } catch (e) {
            setAiRoutesError(e instanceof Error ? e.message : 'AI suggestion failed');
        } finally {
            setAiRoutesLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.from.trim() || !formData.to.trim() || !formData.date) return;

        const routeData = {
            tripId: selectedTripId || '',
            date: formData.date,
            type: formData.type,
            from: formData.from.trim(),
            to: formData.to.trim(),
            departureTime: formData.departureTime || undefined,
            arrivalTime: formData.arrivalTime || undefined,
            cost: formData.cost ? parseFloat(formData.cost) : undefined,
            currency: formData.cost ? formData.currency : undefined,
            bookingRef: formData.bookingRef.trim() || undefined,
            notes: formData.notes.trim() || undefined,
        };

        if (editingRoute) {
            await updateRoute(editingRoute.id, routeData);
            logEvent('Route Updated', { transport_type: routeData.type, from: routeData.from, to: routeData.to, date: routeData.date });
        } else {
            await addRoute(routeData as Omit<TransportRoute, 'id' | 'userId' | 'tripMembers'>, selectedTrip?.members || []);
            logEvent('Route Created', { transport_type: routeData.type, from: routeData.from, to: routeData.to, date: routeData.date, cost: routeData.cost, currency: routeData.currency });
        }
        resetForm();
    };

    const handleDelete = (id: string) => {
        const route = routes.find(r => r.id === id);
        if (!route) return;
        deleteRoute(id);
        logEvent('Route Deleted', { transport_type: route.type, from: route.from, to: route.to });
        showToast(`Route "${route.from} → ${route.to}" deleted`, () => {
            restoreRoute(route);
            logEvent('Route Delete Undone', { transport_type: route.type });
        });
    };

    return (
        <div className="page-container animate-fade-in">
            <header className="page-header">
                <div>
                    <h1>Transportation</h1>
                    <p>Track all your flights, trains, rides, and routes.</p>
                </div>
            </header>

            {/* Trip Filter + Add */}
            <div className="flex flex-wrap items-center gap-md mb-lg">
                <select
                    className="input-field"
                    style={{ flex: '1 1 120px', maxWidth: '250px' }}
                    value={selectedTripId || ''}
                    onChange={e => setSelectedTripId(e.target.value || null)}
                >
                    <option value="">All Trips</option>
                    {trips.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>
                <button className="btn btn-primary" onClick={openAddForm}>
                    <Plus size={18} /> Add Route
                </button>
            </div>

            {/* Cost Summary */}
            {Object.keys(totalCost).length > 0 && (
                <div className="card p-lg mb-lg" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--secondary-color) 5%, transparent), color-mix(in srgb, var(--primary-color) 5%, transparent))' }}>
                    <h3 className="text-sm text-secondary mb-sm">Total Transport Costs</h3>
                    <div className="flex flex-wrap gap-md">
                        {Object.entries(totalCost).map(([currency, amount]) => (
                            <span key={currency} className="text-xl font-bold text-success">
                                {currency} {amount.toFixed(2)}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Add/Edit Form */}
            {showForm && (
                <form className="card p-md mb-md animate-fade-in" onSubmit={handleSubmit}>
                    <h3 className="text-base mb-sm">{editingRoute ? 'Edit Route' : 'New Route'}</h3>

                    <div className="flex flex-wrap gap-xs mb-md">
                        {transportTypes.map(type => (
                            <button
                                type="button"
                                key={type}
                                className={`px-3 py-1 rounded-full border text-xs capitalize transition-colors ${formData.type === type ? 'bg-primary text-white border-primary' : 'bg-surface border-light hover:border-primary'}`}
                                style={{
                                    padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-full)', border: '1px solid',
                                    ...(formData.type === type ? { backgroundColor: 'var(--primary-color)', color: 'white', borderColor: 'var(--primary-color)' } : { backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)', color: 'inherit' })
                                }}
                                onClick={() => setFormData(p => ({ ...p, type }))}
                            >
                                {TRANSPORT_EMOJIS[type]} {type}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-wrap gap-sm mb-xs">
                        <div className="flex flex-col gap-xs" style={{ flex: '1 1 200px' }}>
                            <label className="text-sm font-medium">From *</label>
                            <input
                                className="input-field"
                                type="text"
                                value={formData.from}
                                onChange={e => setFormData(p => ({ ...p, from: e.target.value }))}
                                placeholder="e.g. Rome FCO"
                                required
                            />
                        </div>
                        <div className="flex items-center text-xl font-bold text-primary" style={{ paddingTop: '1.2rem' }}>→</div>
                        <div className="flex flex-col gap-xs" style={{ flex: '1 1 200px' }}>
                            <label className="text-sm font-medium">To *</label>
                            <input
                                className="input-field"
                                type="text"
                                value={formData.to}
                                onChange={e => setFormData(p => ({ ...p, to: e.target.value }))}
                                placeholder="e.g. Paris CDG"
                                required
                            />
                        </div>
                    </div>

                    {(formData.from.trim() && formData.to.trim()) && (
                        <div className="mb-md">
                            <button
                                type="button"
                                className="btn btn-outline btn-sm mb-sm"
                                onClick={handleSuggestRoutes}
                                disabled={aiRoutesLoading}
                            >
                                {aiRoutesLoading ? <><Loader2 size={14} className="spin" /> Finding options…</> : 'Suggest optimal routes'}
                            </button>
                            {aiRoutesError && <p className="text-xs text-danger mt-xs">{aiRoutesError}</p>}
                            {aiRoutesSuggestion && (
                                <div className="card p-md mt-sm">
                                    <div className="text-sm text-secondary mb-md" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                                        <Markdown>{aiRoutesSuggestion}</Markdown>
                                    </div>
                                    <div className="flex gap-sm">
                                        <button type="button" className="btn btn-primary btn-sm" onClick={() => { setFormData(p => ({ ...p, notes: (p.notes ? p.notes + '\n\n' : '') + aiRoutesSuggestion })); setAiRoutesSuggestion(null); logEvent('AI Route Suggestion Accepted', { from: formData.from.trim(), to: formData.to.trim() }); }}>Accept</button>
                                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setAiRoutesSuggestion(null); logEvent('AI Route Suggestion Declined', { from: formData.from.trim(), to: formData.to.trim() }); }}>Decline</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex flex-wrap gap-sm mb-xs">
                        <div className="flex flex-col gap-xs" style={{ flex: '1 1 200px' }}>
                            <label className="text-sm font-medium">Date *</label>
                            <input
                                className="input-field"
                                type="date"
                                value={formData.date}
                                onChange={e => setFormData(p => ({ ...p, date: e.target.value }))}
                                required
                            />
                            {selectedTrip?.dayLocations?.[formData.date] && (
                                <span className="block text-xs text-subtle mt-xs">📍 {selectedTrip.dayLocations[formData.date]}</span>
                            )}
                        </div>
                        <div className="flex flex-col gap-xs" style={{ flex: '0 0 auto', minWidth: '120px' }}>
                            <label className="text-sm font-medium">Departure</label>
                            <input
                                className="input-field"
                                type="time"
                                value={formData.departureTime}
                                onChange={e => setFormData(p => ({ ...p, departureTime: e.target.value }))}
                            />
                        </div>
                        <div className="flex flex-col gap-xs" style={{ flex: '0 0 auto', minWidth: '120px' }}>
                            <label className="text-sm font-medium">Arrival</label>
                            <input
                                className="input-field"
                                type="time"
                                value={formData.arrivalTime}
                                onChange={e => setFormData(p => ({ ...p, arrivalTime: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-sm mb-xs">
                        <div className="flex flex-col gap-xs" style={{ flex: '1 1 120px' }}>
                            <label className="text-sm font-medium">Cost</label>
                            <input
                                className="input-field"
                                type="number"
                                value={formData.cost}
                                onChange={e => setFormData(p => ({ ...p, cost: e.target.value }))}
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                            />
                        </div>
                        <div className="flex flex-col gap-xs" style={{ flex: '0 0 auto', minWidth: '100px' }}>
                            <label className="text-sm font-medium">Currency</label>
                            <select
                                className="input-field"
                                value={formData.currency}
                                onChange={e => setFormData(p => ({ ...p, currency: e.target.value }))}
                            >
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                                <option value="GBP">GBP</option>
                                <option value="JPY">JPY</option>
                                <option value="CAD">CAD</option>
                                <option value="AUD">AUD</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-xs" style={{ flex: '1 1 200px' }}>
                            <label className="text-sm font-medium">Booking Ref</label>
                            <input
                                className="input-field"
                                type="text"
                                value={formData.bookingRef}
                                onChange={e => setFormData(p => ({ ...p, bookingRef: e.target.value }))}
                                placeholder="e.g. ABC123"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-xs mb-sm">
                        <label className="text-sm font-medium">Notes</label>
                        <textarea
                            className="input-field textarea"
                            value={formData.notes}
                            onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                            placeholder="Any extra notes..."
                            rows={2}
                        />
                    </div>

                    <div className="flex gap-xs mt-sm">
                        <button type="button" className="btn btn-ghost" onClick={() => resetForm()}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={!formData.from.trim() || !formData.to.trim() || !formData.date}>
                            {editingRoute ? 'Save Changes' : 'Add Route'}
                        </button>
                    </div>
                </form>
            )}

            {/* Routes Grid */}
            {tripRoutes.length === 0 && !showForm ? (
                <div className="text-center p-xl mx-auto" style={{ maxWidth: '400px' }}>
                    <div className="text-xl mb-md" style={{ fontSize: '4rem' }}>🚀</div>
                    <h2 className="mb-sm">No routes yet</h2>
                    <p className="mb-lg">Add your first transport route to start tracking.</p>
                </div>
            ) : (
                <div className="grid grid-cols-auto-300 gap-md">
                    {tripRoutes.map(route => (
                        <div key={route.id} className="card p-md">
                            <div className="flex justify-between items-center mb-sm">
                                <span className="bg-border-light px-sm py-xs rounded-full text-xs font-medium capitalize" style={{ backgroundColor: 'var(--border-light)' }}>
                                    {TRANSPORT_EMOJIS[route.type]} {route.type}
                                </span>
                                <div className="flex gap-xs">
                                    <button className="btn btn-ghost btn-sm" onClick={() => openEditForm(route)}>
                                        <Pencil size={14} />
                                    </button>
                                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(route.id)}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-baseline gap-sm flex-wrap text-sm" style={{ lineHeight: 1.4 }}>
                                <strong>{route.from}</strong>
                                {route.departureTime && <span className="text-xs text-subtle">{route.departureTime}</span>}
                                <span className="text-subtle font-semibold">→</span>
                                <strong>{route.to}</strong>
                                {route.arrivalTime && <span className="text-xs text-subtle">{route.arrivalTime}</span>}
                            </div>
                            <div className="flex items-center gap-md mt-sm flex-wrap">
                                <span className="text-sm text-secondary">{format(parseISO(route.date), 'MMM d, yyyy')}</span>
                                {route.cost != null && (
                                    <span className="text-sm font-bold text-success">{route.currency || 'USD'} {route.cost.toFixed(2)}</span>
                                )}
                                {route.bookingRef && (
                                    <span className="text-xs text-subtle bg-border-light rounded-sm px-xs py-1" style={{ backgroundColor: 'var(--border-light)' }}>Ref: {route.bookingRef}</span>
                                )}
                            </div>
                            {route.notes && (
                                <div className="text-xs text-secondary mt-sm pt-sm border-t italic" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    <Markdown>{route.notes}</Markdown>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Transportation;
