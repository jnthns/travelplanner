import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { format, parseISO, eachDayOfInterval } from 'date-fns';
import { useTrips, useActivities, useTransportRoutes } from '../lib/store';
import { CATEGORY_EMOJIS, CATEGORY_COLORS } from '../lib/types';
import { useLocalStorageState } from '../lib/persist';
import { logEvent } from '../lib/amplitude';
import './Budget.css';

const CATEGORIES = ['sightseeing', 'food', 'accommodation', 'transport', 'shopping', 'other'] as const;
const COMMON_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'KRW', 'SGD', 'THB', 'MXN'] as const;

interface CurrencyTotal { [currency: string]: number; }

function formatCurrency(amount: number, currency: string): string {
    return `${currency} ${amount.toFixed(2)}`;
}

function sumCurrency(totals: CurrencyTotal): number {
    return Object.values(totals).reduce((a, b) => a + b, 0);
}

function convertAmount(amount: number, from: string, to: string, rates: Record<string, number>): number {
    if (from === to) return amount;
    const rate = rates[from];
    return rate ? amount * rate : amount;
}

// --- SVG Donut Chart ---
const DonutChart: React.FC<{ segments: { label: string; value: number; color: string }[]; size?: number }> = ({ segments, size = 160 }) => {
    const total = segments.reduce((s, seg) => s + seg.value, 0);
    if (total === 0) return null;
    const cx = size / 2, cy = size / 2, r = size * 0.35, stroke = size * 0.18;
    const circumference = 2 * Math.PI * r;
    let offset = 0;

    return (
        <div className="donut-wrapper">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {segments.map((seg, i) => {
                    const pct = seg.value / total;
                    const dash = circumference * pct;
                    const currentOffset = offset;
                    offset += dash;
                    return (
                        <circle
                            key={i}
                            cx={cx} cy={cy} r={r}
                            fill="none"
                            stroke={seg.color}
                            strokeWidth={stroke}
                            strokeDasharray={`${dash} ${circumference - dash}`}
                            strokeDashoffset={-currentOffset}
                            transform={`rotate(-90 ${cx} ${cy})`}
                        />
                    );
                })}
            </svg>
            <div className="donut-legend">
                {segments.map((seg, i) => (
                    <div key={i} className="donut-legend-item">
                        <span className="donut-swatch" style={{ backgroundColor: seg.color }} />
                        <span className="donut-legend-label">{seg.label}</span>
                        <span className="donut-legend-pct">{Math.round((seg.value / total) * 100)}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- SVG Cumulative Spend Chart ---
const CumulativeChart: React.FC<{
    days: { label: string; cumulative: number }[];
    budgetTarget?: number;
    height?: number;
}> = ({ days, budgetTarget, height = 180 }) => {
    if (days.length === 0) return null;
    const maxVal = Math.max(
        days[days.length - 1].cumulative,
        budgetTarget ?? 0,
    ) * 1.1 || 1;
    const w = 600, h = height, pad = { top: 10, right: 10, bottom: 30, left: 50 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    const points = days.map((d, i) => {
        const x = pad.left + (days.length === 1 ? plotW / 2 : (i / (days.length - 1)) * plotW);
        const y = pad.top + plotH - (d.cumulative / maxVal) * plotH;
        return `${x},${y}`;
    });

    const areaPoints = [
        `${pad.left + (days.length === 1 ? plotW / 2 : 0)},${pad.top + plotH}`,
        ...points,
        `${pad.left + (days.length === 1 ? plotW / 2 : plotW)},${pad.top + plotH}`,
    ];

    const gridLines = [0, 0.25, 0.5, 0.75, 1].map(pct => ({
        y: pad.top + plotH - pct * plotH,
        label: Math.round(pct * maxVal),
    }));

    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="cumulative-chart" preserveAspectRatio="xMidYMid meet">
            {gridLines.map((g, i) => (
                <g key={i}>
                    <line x1={pad.left} y1={g.y} x2={w - pad.right} y2={g.y} stroke="var(--border-color)" strokeWidth="0.5" />
                    <text x={pad.left - 4} y={g.y + 3} textAnchor="end" fontSize="10" fill="var(--text-tertiary)">{g.label}</text>
                </g>
            ))}
            <polygon points={areaPoints.join(' ')} fill="url(#cumGrad)" opacity="0.3" />
            <polyline points={points.join(' ')} fill="none" stroke="var(--primary-color)" strokeWidth="2.5" strokeLinejoin="round" />
            {budgetTarget != null && budgetTarget > 0 && (
                <line
                    x1={pad.left} y1={pad.top + plotH - (budgetTarget / maxVal) * plotH}
                    x2={w - pad.right} y2={pad.top + plotH - (budgetTarget / maxVal) * plotH}
                    stroke="var(--error-color)" strokeWidth="1.5" strokeDasharray="6,4"
                />
            )}
            {days.map((d, i) => {
                const x = pad.left + (days.length === 1 ? plotW / 2 : (i / (days.length - 1)) * plotW);
                return i % Math.max(1, Math.floor(days.length / 8)) === 0 || i === days.length - 1 ? (
                    <text key={i} x={x} y={h - 8} textAnchor="middle" fontSize="9" fill="var(--text-tertiary)">{d.label}</text>
                ) : null;
            })}
            <defs>
                <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary-color)" />
                    <stop offset="100%" stopColor="var(--primary-color)" stopOpacity="0" />
                </linearGradient>
            </defs>
        </svg>
    );
};

const Budget: React.FC = () => {
    const { trips, updateTrip } = useTrips();
    const { activities } = useActivities();
    const { routes } = useTransportRoutes();

    const [selectedTripId, setSelectedTripId] = useLocalStorageState<string | null>(
        'travelplanner_budget_selectedTripId', null,
    );
    const [locationFilter, setLocationFilter] = useState<string>('');
    const [tagFilter, setTagFilter] = useState<string>('');
    const [showBudgetEditor, setShowBudgetEditor] = useState(false);
    const [budgetInput, setBudgetInput] = useState('');
    const [budgetCurrInput, setBudgetCurrInput] = useState('USD');
    const [displayCurrency, setDisplayCurrency] = useLocalStorageState<string>(
        'travelplanner_budget_displayCurrency', '',
    );
    const [exchangeRates, setExchangeRates] = useLocalStorageState<Record<string, Record<string, number>>>(
        'travelplanner_budget_exchangeRates', {},
    );
    const [showRateEditor, setShowRateEditor] = useState(false);

    const selectedTrip = trips.find(t => t.id === selectedTripId);

    const tripActivities = useMemo(() => {
        if (!selectedTripId) return [];
        return activities.filter(a => a.tripId === selectedTripId);
    }, [selectedTripId, activities]);

    const tripRoutes = useMemo(() => {
        if (!selectedTripId) return [];
        return routes.filter(r => r.tripId === selectedTripId);
    }, [selectedTripId, routes]);

    const locationsByDate = useMemo(() => selectedTrip?.dayLocations ?? {}, [selectedTrip]);

    const uniqueLocations = useMemo(() => {
        const locs = new Set(Object.values(locationsByDate).filter(Boolean));
        return Array.from(locs).sort();
    }, [locationsByDate]);

    const allTags = useMemo(() => {
        const tags = new Set<string>();
        tripActivities.forEach(a => a.tags?.forEach(t => tags.add(t)));
        return Array.from(tags).sort();
    }, [tripActivities]);

    const filteredDates = useMemo(() => {
        if (!locationFilter) return null;
        return new Set(
            Object.entries(locationsByDate)
                .filter(([, loc]) => loc === locationFilter)
                .map(([date]) => date),
        );
    }, [locationFilter, locationsByDate]);

    const costedActivities = useMemo(() => {
        let items = tripActivities.filter(a => a.cost != null && a.cost > 0);
        if (filteredDates) items = items.filter(a => filteredDates.has(a.date));
        if (tagFilter) items = items.filter(a => a.tags?.includes(tagFilter));
        return items;
    }, [tripActivities, filteredDates, tagFilter]);

    const costedRoutes = useMemo(() => {
        const items = tripRoutes.filter(r => r.cost != null && r.cost > 0);
        if (!filteredDates) return items;
        return items.filter(r => filteredDates.has(r.date));
    }, [tripRoutes, filteredDates]);

    const usedCurrencies = useMemo(() => {
        const set = new Set<string>();
        costedActivities.forEach(a => set.add(a.currency || 'USD'));
        costedRoutes.forEach(r => set.add(r.currency || 'USD'));
        return Array.from(set).sort();
    }, [costedActivities, costedRoutes]);

    const tripRates = useMemo(() =>
        (selectedTripId && exchangeRates[selectedTripId]) || {},
    [selectedTripId, exchangeRates]);

    const convertedTotal = useMemo(() => {
        if (!displayCurrency) return null;
        let total = 0;
        for (const a of costedActivities) {
            total += convertAmount(a.cost!, a.currency || 'USD', displayCurrency, tripRates);
        }
        for (const r of costedRoutes) {
            total += convertAmount(r.cost!, r.currency || 'USD', displayCurrency, tripRates);
        }
        return total;
    }, [displayCurrency, costedActivities, costedRoutes, tripRates]);

    const grandTotal = useMemo(() => {
        const totals: CurrencyTotal = {};
        for (const a of costedActivities) {
            const cur = a.currency || 'USD';
            totals[cur] = (totals[cur] || 0) + a.cost!;
        }
        for (const r of costedRoutes) {
            const cur = r.currency || 'USD';
            totals[cur] = (totals[cur] || 0) + r.cost!;
        }
        return totals;
    }, [costedActivities, costedRoutes]);

    const categoryBreakdown = useMemo(() => {
        const breakdown: Record<string, CurrencyTotal> = {};
        for (const cat of CATEGORIES) breakdown[cat] = {};
        breakdown['transport_routes'] = {};

        for (const a of costedActivities) {
            const cat = a.category || 'other';
            const cur = a.currency || 'USD';
            breakdown[cat][cur] = (breakdown[cat][cur] || 0) + a.cost!;
        }
        for (const r of costedRoutes) {
            const cur = r.currency || 'USD';
            breakdown['transport_routes'][cur] = (breakdown['transport_routes'][cur] || 0) + r.cost!;
        }
        return breakdown;
    }, [costedActivities, costedRoutes]);

    const donutSegments = useMemo(() => {
        const segments: { label: string; value: number; color: string }[] = [];
        for (const cat of CATEGORIES) {
            const totals = categoryBreakdown[cat];
            let val: number;
            if (displayCurrency) {
                val = Object.entries(totals).reduce((s, [cur, amt]) => s + convertAmount(amt, cur, displayCurrency, tripRates), 0);
            } else {
                val = sumCurrency(totals);
            }
            if (val > 0) segments.push({ label: cat, value: val, color: CATEGORY_COLORS[cat] });
        }
        const trVal = displayCurrency
            ? Object.entries(categoryBreakdown['transport_routes']).reduce((s, [cur, amt]) => s + convertAmount(amt, cur, displayCurrency, tripRates), 0)
            : sumCurrency(categoryBreakdown['transport_routes']);
        if (trVal > 0) segments.push({ label: 'transport routes', value: trVal, color: CATEGORY_COLORS['transport'] });
        return segments;
    }, [categoryBreakdown, displayCurrency, tripRates]);

    const locationBreakdown = useMemo(() => {
        const breakdown: Record<string, CurrencyTotal> = {};
        const addItem = (date: string, cost: number, currency: string) => {
            const loc = locationsByDate[date] || 'Unassigned';
            if (!breakdown[loc]) breakdown[loc] = {};
            breakdown[loc][currency] = (breakdown[loc][currency] || 0) + cost;
        };
        for (const a of costedActivities) addItem(a.date, a.cost!, a.currency || 'USD');
        for (const r of costedRoutes) addItem(r.date, r.cost!, r.currency || 'USD');
        return breakdown;
    }, [costedActivities, costedRoutes, locationsByDate]);

    const allTripDays = useMemo(() => {
        if (!selectedTrip) return [];
        try {
            return eachDayOfInterval({ start: parseISO(selectedTrip.startDate), end: parseISO(selectedTrip.endDate) });
        } catch { return []; }
    }, [selectedTrip]);

    const dailyBreakdown = useMemo(() => {
        return allTripDays.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayActivities = costedActivities.filter(a => a.date === dateStr);
            const dayRoutes = costedRoutes.filter(r => r.date === dateStr);

            const totals: CurrencyTotal = {};
            for (const a of dayActivities) { const cur = a.currency || 'USD'; totals[cur] = (totals[cur] || 0) + a.cost!; }
            for (const r of dayRoutes) { const cur = r.currency || 'USD'; totals[cur] = (totals[cur] || 0) + r.cost!; }

            return { date: day, dateStr, location: locationsByDate[dateStr] || '', activities: dayActivities, routes: dayRoutes, totals, itemCount: dayActivities.length + dayRoutes.length };
        }).filter(d => d.itemCount > 0);
    }, [allTripDays, costedActivities, costedRoutes, locationsByDate]);

    const cumulativeData = useMemo(() => {
        let running = 0;
        return allTripDays.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayActs = costedActivities.filter(a => a.date === dateStr);
            const dayRoutes = costedRoutes.filter(r => r.date === dateStr);
            for (const a of dayActs) running += displayCurrency ? convertAmount(a.cost!, a.currency || 'USD', displayCurrency, tripRates) : a.cost!;
            for (const r of dayRoutes) running += displayCurrency ? convertAmount(r.cost!, r.currency || 'USD', displayCurrency, tripRates) : r.cost!;
            return { label: format(day, 'MMM d'), cumulative: running };
        });
    }, [allTripDays, costedActivities, costedRoutes, displayCurrency, tripRates]);

    const topExpenses = useMemo(() => {
        const items: { emoji: string; title: string; cost: number; currency: string; date: string; converted?: number }[] = [];
        for (const a of costedActivities) {
            items.push({
                emoji: CATEGORY_EMOJIS[a.category || 'other'],
                title: a.title,
                cost: a.cost!,
                currency: a.currency || 'USD',
                date: a.date,
                converted: displayCurrency ? convertAmount(a.cost!, a.currency || 'USD', displayCurrency, tripRates) : undefined,
            });
        }
        for (const r of costedRoutes) {
            items.push({
                emoji: '🚆',
                title: `${r.from} → ${r.to}`,
                cost: r.cost!,
                currency: r.currency || 'USD',
                date: r.date,
                converted: displayCurrency ? convertAmount(r.cost!, r.currency || 'USD', displayCurrency, tripRates) : undefined,
            });
        }
        items.sort((a, b) => (b.converted ?? b.cost) - (a.converted ?? a.cost));
        return items.slice(0, 5);
    }, [costedActivities, costedRoutes, displayCurrency, tripRates]);

    const avgDailySpend = useMemo(() => {
        if (allTripDays.length === 0) return null;
        if (displayCurrency && convertedTotal != null) return convertedTotal / allTripDays.length;
        const total = sumCurrency(grandTotal);
        return total / allTripDays.length;
    }, [allTripDays, grandTotal, displayCurrency, convertedTotal]);

    const maxDayTotal = useMemo(() => {
        let max = 0;
        for (const day of dailyBreakdown) {
            const sum = displayCurrency
                ? Object.entries(day.totals).reduce((s, [cur, amt]) => s + convertAmount(amt, cur, displayCurrency, tripRates), 0)
                : sumCurrency(day.totals);
            if (sum > max) max = sum;
        }
        return max;
    }, [dailyBreakdown, displayCurrency, tripRates]);

    const categoryBarMax = useMemo(() => {
        let max = 0;
        for (const totals of Object.values(categoryBreakdown)) {
            const sum = displayCurrency
                ? Object.entries(totals).reduce((s, [cur, amt]) => s + convertAmount(amt, cur, displayCurrency, tripRates), 0)
                : sumCurrency(totals);
            if (sum > max) max = sum;
        }
        return max;
    }, [categoryBreakdown, displayCurrency, tripRates]);

    const locationBarMax = useMemo(() => {
        let max = 0;
        for (const totals of Object.values(locationBreakdown)) {
            const sum = displayCurrency
                ? Object.entries(totals).reduce((s, [cur, amt]) => s + convertAmount(amt, cur, displayCurrency, tripRates), 0)
                : sumCurrency(totals);
            if (sum > max) max = sum;
        }
        return max;
    }, [locationBreakdown, displayCurrency, tripRates]);

    const totalExpenses = costedActivities.length + costedRoutes.length;
    const budgetTarget = selectedTrip?.budgetTarget;
    const budgetCurrency = selectedTrip?.budgetCurrency || selectedTrip?.defaultCurrency || 'USD';

    const budgetProgress = useMemo(() => {
        if (!budgetTarget) return null;
        let spent: number;
        if (displayCurrency === budgetCurrency && convertedTotal != null) {
            spent = convertedTotal;
        } else {
            spent = sumCurrency(grandTotal);
        }
        return { spent, target: budgetTarget, pct: Math.min((spent / budgetTarget) * 100, 100) };
    }, [budgetTarget, budgetCurrency, displayCurrency, convertedTotal, grandTotal]);

    const handleSaveBudget = useCallback(() => {
        if (!selectedTrip) return;
        const val = parseFloat(budgetInput);
        if (isNaN(val) || val <= 0) {
            updateTrip(selectedTrip.id, { budgetTarget: undefined, budgetCurrency: undefined } as Partial<typeof selectedTrip>);
        } else {
            updateTrip(selectedTrip.id, { budgetTarget: val, budgetCurrency: budgetCurrInput });
        }
        setShowBudgetEditor(false);
        logEvent('Budget Target Set', { amount: val, currency: budgetCurrInput });
    }, [selectedTrip, budgetInput, budgetCurrInput, updateTrip]);

    const handleSetRate = useCallback((fromCur: string, rate: number) => {
        if (!selectedTripId) return;
        setExchangeRates(prev => ({
            ...prev,
            [selectedTripId]: { ...prev[selectedTripId], [fromCur]: rate },
        }));
    }, [selectedTripId, setExchangeRates]);

    const renderAmount = useCallback((totals: CurrencyTotal) => {
        if (displayCurrency) {
            const converted = Object.entries(totals).reduce(
                (s, [cur, amt]) => s + convertAmount(amt, cur, displayCurrency, tripRates), 0,
            );
            return <span>{formatCurrency(converted, displayCurrency)}</span>;
        }
        return Object.entries(totals).map(([cur, amt]) => <span key={cur}>{formatCurrency(amt, cur)}</span>);
    }, [displayCurrency, tripRates]);

    useEffect(() => {
        if (!selectedTrip) return;
        let tripDays: string[] = [];
        try {
            tripDays = eachDayOfInterval({ start: parseISO(selectedTrip.startDate), end: parseISO(selectedTrip.endDate) }).map(d => format(d, 'yyyy-MM-dd'));
        } catch { return; }
        const daysWithCost = new Set(costedActivities.map(a => a.date));
        const daysWithActivity = new Set(tripActivities.map(a => a.date));
        logEvent('Budget Viewed', {
            trip_id: selectedTrip.id, trip_name: selectedTrip.name,
            duration_days: tripDays.length, total_activities: tripActivities.length,
            costed_activities: costedActivities.length, total_expense_items: totalExpenses,
            days_with_any_activity: tripDays.filter(d => daysWithActivity.has(d)).length,
            days_with_any_cost: tripDays.filter(d => daysWithCost.has(d)).length,
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTripId]);

    useEffect(() => { setLocationFilter(''); setTagFilter(''); }, [selectedTripId]);

    useEffect(() => {
        if (selectedTrip) {
            setBudgetInput(selectedTrip.budgetTarget?.toString() || '');
            setBudgetCurrInput(selectedTrip.budgetCurrency || selectedTrip.defaultCurrency || 'USD');
        }
    }, [selectedTrip]);

    if (trips.length === 0) {
        return (
            <div className="page-container animate-fade-in">
                <div className="empty-state">
                    <div className="empty-icon">💰</div>
                    <h2>No trips yet</h2>
                    <p>Create a trip from the Trips page to start tracking your budget.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container animate-fade-in">
            <header className="page-header">
                <div>
                    <h1>Budget</h1>
                    <p>Track your travel spending across activities and transport.</p>
                </div>
            </header>

            {/* Controls */}
            <div className="budget-controls">
                <select className="input-field" value={selectedTripId || ''} onChange={e => setSelectedTripId(e.target.value || null)}>
                    <option value="">Select a trip...</option>
                    {trips.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {uniqueLocations.length > 0 && selectedTrip && (
                    <select className="input-field" value={locationFilter} onChange={e => setLocationFilter(e.target.value)}>
                        <option value="">All locations</option>
                        {uniqueLocations.map(loc => <option key={loc} value={loc}>📍 {loc}</option>)}
                    </select>
                )}
                {allTags.length > 0 && selectedTrip && (
                    <select className="input-field" value={tagFilter} onChange={e => setTagFilter(e.target.value)}>
                        <option value="">All tags</option>
                        {allTags.map(tag => <option key={tag} value={tag}>🏷️ {tag}</option>)}
                    </select>
                )}
                {usedCurrencies.length > 1 && selectedTrip && (
                    <div className="budget-currency-toggle">
                        <select className="input-field" value={displayCurrency} onChange={e => setDisplayCurrency(e.target.value)}>
                            <option value="">Multi-currency</option>
                            {COMMON_CURRENCIES.filter(c => usedCurrencies.includes(c) || c === (selectedTrip?.defaultCurrency || 'USD')).map(c =>
                                <option key={c} value={c}>Show in {c}</option>
                            )}
                        </select>
                        {displayCurrency && (
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowRateEditor(p => !p)}>
                                {showRateEditor ? 'Hide rates' : 'Edit rates'}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Exchange rate editor */}
            {showRateEditor && displayCurrency && selectedTripId && (
                <div className="rate-editor card">
                    <h4>Exchange Rates → {displayCurrency}</h4>
                    <p className="rate-hint">Enter how much 1 unit of each currency is worth in {displayCurrency}.</p>
                    <div className="rate-grid">
                        {usedCurrencies.filter(c => c !== displayCurrency).map(cur => (
                            <div key={cur} className="rate-row">
                                <label>1 {cur} =</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    step="0.0001"
                                    min="0"
                                    placeholder="1.0"
                                    value={tripRates[cur] ?? ''}
                                    onChange={e => handleSetRate(cur, parseFloat(e.target.value) || 0)}
                                />
                                <span>{displayCurrency}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!selectedTrip && (
                <div className="empty-state">
                    <div className="empty-icon">💰</div>
                    <h2>Select a trip</h2>
                    <p>Choose a trip above to see your budget breakdown.</p>
                </div>
            )}

            {selectedTrip && (
                <>
                    {/* Stats row */}
                    <div className="budget-stats-row">
                        {/* Grand total */}
                        <div className="budget-stat-card card">
                            <h3>Total Spending{locationFilter && ` — ${locationFilter}`}</h3>
                            {Object.keys(grandTotal).length > 0 ? (
                                <div className="budget-stat-value">
                                    {displayCurrency && convertedTotal != null
                                        ? formatCurrency(convertedTotal, displayCurrency)
                                        : Object.entries(grandTotal).sort(([, a], [, b]) => b - a).map(([cur, amt]) => (
                                            <span key={cur}>{formatCurrency(amt, cur)}</span>
                                        ))
                                    }
                                </div>
                            ) : (
                                <p className="budget-no-data">No costs recorded yet.</p>
                            )}
                            <span className="budget-stat-sub">{totalExpenses} expense{totalExpenses !== 1 ? 's' : ''} across {dailyBreakdown.length} day{dailyBreakdown.length !== 1 ? 's' : ''}</span>
                        </div>

                        {/* Average daily */}
                        {avgDailySpend != null && avgDailySpend > 0 && (
                            <div className="budget-stat-card card">
                                <h3>Avg / Day</h3>
                                <div className="budget-stat-value">
                                    {displayCurrency
                                        ? formatCurrency(avgDailySpend, displayCurrency)
                                        : formatCurrency(avgDailySpend, usedCurrencies[0] || 'USD')
                                    }
                                </div>
                                <span className="budget-stat-sub">{allTripDays.length} day trip</span>
                            </div>
                        )}

                        {/* Budget target */}
                        <div className="budget-stat-card card budget-target-card">
                            <h3>Budget Target</h3>
                            {showBudgetEditor ? (
                                <div className="budget-target-editor">
                                    <input type="number" className="input-field" placeholder="e.g. 2000" value={budgetInput} onChange={e => setBudgetInput(e.target.value)} min="0" step="1" />
                                    <select className="input-field" value={budgetCurrInput} onChange={e => setBudgetCurrInput(e.target.value)}>
                                        {COMMON_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <button className="btn btn-primary btn-sm" onClick={handleSaveBudget}>Save</button>
                                    <button className="btn btn-ghost btn-sm" onClick={() => setShowBudgetEditor(false)}>Cancel</button>
                                </div>
                            ) : budgetProgress ? (
                                <>
                                    <div className="budget-stat-value">{formatCurrency(budgetProgress.target, budgetCurrency)}</div>
                                    <div className="budget-progress-track">
                                        <div
                                            className={`budget-progress-fill ${budgetProgress.pct >= 90 ? 'over' : ''}`}
                                            style={{ width: `${budgetProgress.pct}%` }}
                                        />
                                    </div>
                                    <span className="budget-stat-sub">
                                        {Math.round(budgetProgress.pct)}% used — {formatCurrency(budgetProgress.target - budgetProgress.spent, budgetCurrency)} remaining
                                    </span>
                                    <button className="btn btn-ghost btn-sm" onClick={() => setShowBudgetEditor(true)}>Edit</button>
                                </>
                            ) : (
                                <>
                                    <p className="budget-no-data">No target set</p>
                                    <button className="btn btn-outline btn-sm" onClick={() => setShowBudgetEditor(true)}>Set budget</button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Donut + Category bars */}
                    {totalExpenses > 0 && (
                        <div className="budget-section budget-category-section">
                            <h2 className="budget-section-title">By Category</h2>
                            <div className="budget-category-layout">
                                {donutSegments.length > 1 && <DonutChart segments={donutSegments} />}
                                <div className="budget-category-grid">
                                    {CATEGORIES.map(cat => {
                                        const totals = categoryBreakdown[cat];
                                        const sum = displayCurrency
                                            ? Object.entries(totals).reduce((s, [cur, amt]) => s + convertAmount(amt, cur, displayCurrency, tripRates), 0)
                                            : sumCurrency(totals);
                                        if (sum === 0) return null;
                                        const barWidth = categoryBarMax > 0 ? (sum / categoryBarMax) * 100 : 0;
                                        return (
                                            <div key={cat} className="budget-category-row">
                                                <div className="budget-cat-label">
                                                    <span className="budget-cat-emoji">{CATEGORY_EMOJIS[cat]}</span>
                                                    <span className="budget-cat-name">{cat}</span>
                                                </div>
                                                <div className="budget-cat-bar-track">
                                                    <div className="budget-cat-bar-fill" style={{ width: `${barWidth}%`, backgroundColor: CATEGORY_COLORS[cat] }} />
                                                </div>
                                                <div className="budget-cat-amounts">{renderAmount(totals)}</div>
                                            </div>
                                        );
                                    })}
                                    {(() => {
                                        const trTotals = categoryBreakdown['transport_routes'];
                                        const trSum = displayCurrency
                                            ? Object.entries(trTotals).reduce((s, [cur, amt]) => s + convertAmount(amt, cur, displayCurrency, tripRates), 0)
                                            : sumCurrency(trTotals);
                                        if (trSum === 0) return null;
                                        const barW = categoryBarMax > 0 ? (trSum / categoryBarMax) * 100 : 0;
                                        return (
                                            <div className="budget-category-row">
                                                <div className="budget-cat-label">
                                                    <span className="budget-cat-emoji">🚆</span>
                                                    <span className="budget-cat-name">transport routes</span>
                                                </div>
                                                <div className="budget-cat-bar-track">
                                                    <div className="budget-cat-bar-fill" style={{ width: `${barW}%`, backgroundColor: CATEGORY_COLORS['transport'] }} />
                                                </div>
                                                <div className="budget-cat-amounts">{renderAmount(trTotals)}</div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Location breakdown */}
                    {totalExpenses > 0 && Object.keys(locationBreakdown).length > 1 && (
                        <div className="budget-section">
                            <h2 className="budget-section-title">By Location</h2>
                            <div className="budget-category-grid">
                                {Object.entries(locationBreakdown)
                                    .sort(([, a], [, b]) => {
                                        const sa = displayCurrency ? Object.entries(a).reduce((s, [c, v]) => s + convertAmount(v, c, displayCurrency, tripRates), 0) : sumCurrency(a);
                                        const sb = displayCurrency ? Object.entries(b).reduce((s, [c, v]) => s + convertAmount(v, c, displayCurrency, tripRates), 0) : sumCurrency(b);
                                        return sb - sa;
                                    })
                                    .map(([loc, totals]) => {
                                        const sum = displayCurrency
                                            ? Object.entries(totals).reduce((s, [cur, amt]) => s + convertAmount(amt, cur, displayCurrency, tripRates), 0)
                                            : sumCurrency(totals);
                                        const barWidth = locationBarMax > 0 ? (sum / locationBarMax) * 100 : 0;
                                        return (
                                            <div key={loc} className="budget-category-row">
                                                <div className="budget-cat-label">
                                                    <span className="budget-cat-emoji">{loc === 'Unassigned' ? '📌' : '📍'}</span>
                                                    <span className="budget-cat-name">{loc}</span>
                                                </div>
                                                <div className="budget-cat-bar-track">
                                                    <div className="budget-cat-bar-fill" style={{ width: `${barWidth}%`, backgroundColor: 'var(--primary-color)' }} />
                                                </div>
                                                <div className="budget-cat-amounts">{renderAmount(totals)}</div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    )}

                    {/* Cumulative spend chart */}
                    {cumulativeData.length > 1 && cumulativeData[cumulativeData.length - 1].cumulative > 0 && (
                        <div className="budget-section">
                            <h2 className="budget-section-title">Cumulative Spending</h2>
                            <div className="chart-container card">
                                <CumulativeChart
                                    days={cumulativeData}
                                    budgetTarget={budgetTarget && displayCurrency === budgetCurrency ? budgetTarget : undefined}
                                />
                            </div>
                        </div>
                    )}

                    {/* Top expenses */}
                    {topExpenses.length > 0 && (
                        <div className="budget-section">
                            <h2 className="budget-section-title">Top Expenses</h2>
                            <div className="top-expenses-list">
                                {topExpenses.map((item, i) => (
                                    <div key={i} className="top-expense-row">
                                        <span className="top-expense-rank">#{i + 1}</span>
                                        <span className="top-expense-emoji">{item.emoji}</span>
                                        <span className="top-expense-title">{item.title}</span>
                                        <span className="top-expense-date">{(() => { try { return format(parseISO(item.date), 'MMM d'); } catch { return item.date; } })()}</span>
                                        <span className="top-expense-cost">
                                            {displayCurrency && item.converted != null
                                                ? formatCurrency(item.converted, displayCurrency)
                                                : formatCurrency(item.cost, item.currency)
                                            }
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Daily breakdown */}
                    {dailyBreakdown.length > 0 && (
                        <div className="budget-section">
                            <h2 className="budget-section-title">By Day</h2>
                            <div className="budget-daily-grid">
                                {dailyBreakdown.map(day => {
                                    const daySum = displayCurrency
                                        ? Object.entries(day.totals).reduce((s, [cur, amt]) => s + convertAmount(amt, cur, displayCurrency, tripRates), 0)
                                        : sumCurrency(day.totals);
                                    const barWidth = maxDayTotal > 0 ? (daySum / maxDayTotal) * 100 : 0;
                                    const overAvg = avgDailySpend != null && daySum > avgDailySpend * 1.5;
                                    return (
                                        <div key={day.dateStr} className={`budget-day-tile card ${overAvg ? 'over-budget' : ''}`}>
                                            <div className="budget-day-header">
                                                <div className="budget-day-date">
                                                    <span className="budget-day-name">{format(day.date, 'EEE')}</span>
                                                    <span className="budget-day-full">{format(day.date, 'MMM d')}</span>
                                                </div>
                                                <div className="budget-day-total">
                                                    <span className="budget-day-amount">
                                                        {displayCurrency ? formatCurrency(daySum, displayCurrency) : Object.entries(day.totals).map(([cur, amt]) => formatCurrency(amt, cur)).join(' / ')}
                                                    </span>
                                                </div>
                                            </div>
                                            {day.location && <span className="budget-day-location">📍 {day.location}</span>}
                                            <div className="budget-day-bar-track">
                                                <div className="budget-day-bar-fill" style={{ width: `${barWidth}%` }} />
                                            </div>
                                            <div className="budget-day-items">
                                                {day.activities.map(a => (
                                                    <div key={a.id} className="budget-item">
                                                        <span className="budget-item-emoji">{CATEGORY_EMOJIS[a.category || 'other']}</span>
                                                        <span className="budget-item-title">
                                                            {a.title}
                                                            {a.tags && a.tags.length > 0 && <span className="budget-item-tags">{a.tags.map(t => `#${t}`).join(' ')}</span>}
                                                        </span>
                                                        <span className="budget-item-cost">
                                                            {displayCurrency ? formatCurrency(convertAmount(a.cost!, a.currency || 'USD', displayCurrency, tripRates), displayCurrency) : formatCurrency(a.cost!, a.currency || 'USD')}
                                                        </span>
                                                    </div>
                                                ))}
                                                {day.routes.map(r => (
                                                    <div key={r.id} className="budget-item">
                                                        <span className="budget-item-emoji">🚆</span>
                                                        <span className="budget-item-title">{r.from} → {r.to}</span>
                                                        <span className="budget-item-cost">
                                                            {displayCurrency ? formatCurrency(convertAmount(r.cost!, r.currency || 'USD', displayCurrency, tripRates), displayCurrency) : formatCurrency(r.cost!, r.currency || 'USD')}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default Budget;
