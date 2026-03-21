import React, { useMemo, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { useLocalStorageState } from '../lib/persist';
import { usePackingItems, useTrips } from '../lib/store';
import type { PackingItem } from '../lib/types';
import { useToast } from '../components/Toast';

const CATEGORIES: Array<NonNullable<PackingItem['category']>> = [
    'documents',
    'clothing',
    'toiletries',
    'electronics',
    'medication',
    'other',
];

const Packing: React.FC = () => {
    const { trips } = useTrips();
    const { addPackingItem, updatePackingItem, deletePackingItem, restorePackingItem, getPackingItemsByTrip } = usePackingItems();
    const { showToast } = useToast();

    const [selectedTripId, setSelectedTripId] = useLocalStorageState<string | null>('travelplanner_packing_selectedTripId', null);
    const [title, setTitle] = useState('');
    const [quantity, setQuantity] = useState<string>('1');
    const [category, setCategory] = useState<NonNullable<PackingItem['category']>>('other');
    const [filter, setFilter] = useState<'all' | 'packed' | 'unpacked'>('all');

    const selectedTrip = trips.find((t) => t.id === selectedTripId) ?? null;
    const items = useMemo(() => (selectedTripId ? getPackingItemsByTrip(selectedTripId) : []), [selectedTripId, getPackingItemsByTrip]);

    const filteredItems = useMemo(() => {
        if (filter === 'packed') return items.filter((item) => item.packed);
        if (filter === 'unpacked') return items.filter((item) => !item.packed);
        return items;
    }, [items, filter]);

    const packedCount = items.filter((item) => item.packed).length;
    const progressPct = items.length === 0 ? 0 : Math.round((packedCount / items.length) * 100);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTripId || !title.trim()) return;
        const qty = Number(quantity);
        await addPackingItem({
            tripId: selectedTripId,
            title: title.trim(),
            quantity: Number.isFinite(qty) && qty > 1 ? qty : undefined,
            category,
            packed: false,
            order: items.length,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }, selectedTrip?.members || []);
        setTitle('');
        setQuantity('1');
        setCategory('other');
    };

    return (
        <div className="page-container animate-fade-in">
            <header className="page-header">
                <div>
                    <h1>Packing</h1>
                    <p>Build and track a checklist for each trip.</p>
                </div>
            </header>

            <div className="flex flex-wrap items-center gap-md mb-lg">
                <select
                    className="input-field"
                    style={{ flex: '1 1 200px', maxWidth: '320px' }}
                    value={selectedTripId || ''}
                    onChange={(e) => setSelectedTripId(e.target.value || null)}
                >
                    <option value="">Select a trip...</option>
                    {trips.map((trip) => (
                        <option key={trip.id} value={trip.id}>{trip.name}</option>
                    ))}
                </select>
                <div className="flex gap-xs">
                    <button type="button" className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter('all')}>All</button>
                    <button type="button" className={`btn btn-sm ${filter === 'unpacked' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter('unpacked')}>Unpacked</button>
                    <button type="button" className={`btn btn-sm ${filter === 'packed' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter('packed')}>Packed</button>
                </div>
            </div>

            {selectedTrip && (
                <div className="card p-md mb-lg">
                    <div className="flex items-center justify-between mb-xs">
                        <strong>Packing Progress</strong>
                        <span>{packedCount}/{items.length} ({progressPct}%)</span>
                    </div>
                    <div style={{ height: '8px', borderRadius: '999px', backgroundColor: 'var(--border-light)', overflow: 'hidden' }}>
                        <div
                            style={{
                                width: `${progressPct}%`,
                                height: '100%',
                                backgroundColor: 'var(--primary-color)',
                                transition: 'width 0.25s ease',
                            }}
                        />
                    </div>
                </div>
            )}

            {selectedTrip && (
                <form className="card p-md mb-lg flex flex-wrap gap-sm items-end" onSubmit={handleAdd}>
                    <div className="flex flex-col gap-xs" style={{ flex: '1 1 220px' }}>
                        <label className="text-sm font-medium">Item</label>
                        <input className="input-field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Passport" />
                    </div>
                    <div className="flex flex-col gap-xs" style={{ width: '90px' }}>
                        <label className="text-sm font-medium">Qty</label>
                        <input className="input-field" type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-xs" style={{ width: '160px' }}>
                        <label className="text-sm font-medium">Category</label>
                        <select className="input-field" value={category} onChange={(e) => setCategory(e.target.value as NonNullable<PackingItem['category']>)}>
                            {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
                        <Plus size={16} /> Add
                    </button>
                </form>
            )}

            {!selectedTrip ? (
                <div className="text-center p-xl mx-auto" style={{ maxWidth: '420px' }}>
                    <h2 className="mb-sm">Select a trip</h2>
                    <p>Create and track packing checklists once a trip is selected.</p>
                </div>
            ) : filteredItems.length === 0 ? (
                <div className="text-center p-xl mx-auto" style={{ maxWidth: '420px' }}>
                    <h2 className="mb-sm">No packing items</h2>
                    <p>Add items to start your checklist.</p>
                </div>
            ) : (
                <div className="grid grid-cols-auto-300 gap-md">
                    {filteredItems.map((item) => (
                        <div key={item.id} className="card p-md">
                            <div className="flex items-center justify-between gap-sm">
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => updatePackingItem(item.id, { packed: !item.packed, updatedAt: new Date().toISOString() })}
                                    aria-label={item.packed ? 'Mark unpacked' : 'Mark packed'}
                                >
                                    <Check size={14} style={{ opacity: item.packed ? 1 : 0.35 }} />
                                </button>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, textDecoration: item.packed ? 'line-through' : 'none' }}>{item.title}</div>
                                    <div className="text-xs text-subtle">
                                        {item.category || 'other'}{item.quantity ? ` · qty ${item.quantity}` : ''}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => {
                                        deletePackingItem(item.id);
                                        showToast(`"${item.title}" deleted`, () => restorePackingItem(item));
                                    }}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Packing;

