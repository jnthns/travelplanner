import React, { useMemo } from 'react';
import { format, parseISO, eachDayOfInterval } from 'date-fns';
import { useTrips, useActivities, useTransportRoutes } from '../lib/store';
import { CATEGORY_EMOJIS, CATEGORY_COLORS } from '../lib/types';
import { useLocalStorageState } from '../lib/persist';
import './Budget.css';

const CATEGORIES = ['sightseeing', 'food', 'accommodation', 'transport', 'shopping', 'other'] as const;

interface CurrencyTotal {
    [currency: string]: number;
}

function formatCurrency(amount: number, currency: string): string {
    return `${currency} ${amount.toFixed(2)}`;
}


const Budget: React.FC = () => {
    const { trips } = useTrips();
    const { activities } = useActivities();
    const { routes } = useTransportRoutes();

    const [selectedTripId, setSelectedTripId] = useLocalStorageState<string | null>(
        'travelplanner_budget_selectedTripId',
        null,
    );

    const selectedTrip = trips.find(t => t.id === selectedTripId);

    const tripActivities = useMemo(() => {
        if (!selectedTripId) return [];
        return activities.filter(a => a.tripId === selectedTripId);
    }, [selectedTripId, activities]);

    const tripRoutes = useMemo(() => {
        if (!selectedTripId) return [];
        return routes.filter(r => r.tripId === selectedTripId);
    }, [selectedTripId, routes]);

    const costedActivities = useMemo(
        () => tripActivities.filter(a => a.cost != null && a.cost > 0),
        [tripActivities],
    );

    const costedRoutes = useMemo(
        () => tripRoutes.filter(r => r.cost != null && r.cost > 0),
        [tripRoutes],
    );

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
        for (const cat of CATEGORIES) {
            breakdown[cat] = {};
        }
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

    const dailyBreakdown = useMemo(() => {
        if (!selectedTrip) return [];
        let days: Date[];
        try {
            days = eachDayOfInterval({
                start: parseISO(selectedTrip.startDate),
                end: parseISO(selectedTrip.endDate),
            });
        } catch { return []; }

        return days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayActivities = costedActivities.filter(a => a.date === dateStr);
            const dayRoutes = costedRoutes.filter(r => r.date === dateStr);

            const totals: CurrencyTotal = {};
            for (const a of dayActivities) {
                const cur = a.currency || 'USD';
                totals[cur] = (totals[cur] || 0) + a.cost!;
            }
            for (const r of dayRoutes) {
                const cur = r.currency || 'USD';
                totals[cur] = (totals[cur] || 0) + r.cost!;
            }

            return {
                date: day,
                dateStr,
                activities: dayActivities,
                routes: dayRoutes,
                totals,
                itemCount: dayActivities.length + dayRoutes.length,
            };
        }).filter(d => d.itemCount > 0);
    }, [selectedTrip, costedActivities, costedRoutes]);

    const maxDayTotal = useMemo(() => {
        let max = 0;
        for (const day of dailyBreakdown) {
            const sum = Object.values(day.totals).reduce((a, b) => a + b, 0);
            if (sum > max) max = sum;
        }
        return max;
    }, [dailyBreakdown]);

    const categoryBarMax = useMemo(() => {
        let max = 0;
        for (const totals of Object.values(categoryBreakdown)) {
            const sum = Object.values(totals).reduce((a, b) => a + b, 0);
            if (sum > max) max = sum;
        }
        return max;
    }, [categoryBreakdown]);

    const totalExpenses = costedActivities.length + costedRoutes.length;

    if (trips.length === 0) {
        return (
            <div className="page-container animate-fade-in">
                <div className="empty-state">
                    <div className="empty-icon">💰</div>
                    <h2>No trips yet</h2>
                    <p>Create a trip from the Itinerary page to start tracking your budget.</p>
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

            <div className="budget-controls">
                <select
                    className="input-field"
                    value={selectedTripId || ''}
                    onChange={e => setSelectedTripId(e.target.value || null)}
                >
                    <option value="">Select a trip...</option>
                    {trips.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>
            </div>

            {!selectedTrip && (
                <div className="empty-state">
                    <div className="empty-icon">💰</div>
                    <h2>Select a trip</h2>
                    <p>Choose a trip above to see your budget breakdown.</p>
                </div>
            )}

            {selectedTrip && (
                <>
                    {/* Grand total */}
                    <div className="budget-total-card card">
                        <h3>Total Spending</h3>
                        {Object.keys(grandTotal).length > 0 ? (
                            <div className="budget-total-amounts">
                                {Object.entries(grandTotal)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([cur, amt]) => (
                                        <span key={cur} className="budget-total-badge">
                                            {formatCurrency(amt, cur)}
                                        </span>
                                    ))}
                            </div>
                        ) : (
                            <p className="budget-no-data">No costs recorded yet. Add costs to your activities to see budget data.</p>
                        )}
                        <span className="budget-total-count">{totalExpenses} expense{totalExpenses !== 1 ? 's' : ''} across {dailyBreakdown.length} day{dailyBreakdown.length !== 1 ? 's' : ''}</span>
                    </div>

                    {/* Category breakdown */}
                    {totalExpenses > 0 && (
                        <div className="budget-section">
                            <h2 className="budget-section-title">By Category</h2>
                            <div className="budget-category-grid">
                                {CATEGORIES.map(cat => {
                                    const totals = categoryBreakdown[cat];
                                    const sum = Object.values(totals).reduce((a, b) => a + b, 0);
                                    if (sum === 0) return null;
                                    const barWidth = categoryBarMax > 0 ? (sum / categoryBarMax) * 100 : 0;
                                    return (
                                        <div key={cat} className="budget-category-row">
                                            <div className="budget-cat-label">
                                                <span className="budget-cat-emoji">{CATEGORY_EMOJIS[cat]}</span>
                                                <span className="budget-cat-name">{cat}</span>
                                            </div>
                                            <div className="budget-cat-bar-track">
                                                <div
                                                    className="budget-cat-bar-fill"
                                                    style={{ width: `${barWidth}%`, backgroundColor: CATEGORY_COLORS[cat] }}
                                                />
                                            </div>
                                            <div className="budget-cat-amounts">
                                                {Object.entries(totals).map(([cur, amt]) => (
                                                    <span key={cur}>{formatCurrency(amt, cur)}</span>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Transport routes as a separate category */}
                                {Object.values(categoryBreakdown['transport_routes']).reduce((a, b) => a + b, 0) > 0 && (
                                    <div className="budget-category-row">
                                        <div className="budget-cat-label">
                                            <span className="budget-cat-emoji">🚆</span>
                                            <span className="budget-cat-name">transport routes</span>
                                        </div>
                                        <div className="budget-cat-bar-track">
                                            <div
                                                className="budget-cat-bar-fill"
                                                style={{
                                                    width: `${categoryBarMax > 0 ? (Object.values(categoryBreakdown['transport_routes']).reduce((a, b) => a + b, 0) / categoryBarMax) * 100 : 0}%`,
                                                    backgroundColor: CATEGORY_COLORS['transport'],
                                                }}
                                            />
                                        </div>
                                        <div className="budget-cat-amounts">
                                            {Object.entries(categoryBreakdown['transport_routes']).map(([cur, amt]) => (
                                                <span key={cur}>{formatCurrency(amt, cur)}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Daily breakdown */}
                    {dailyBreakdown.length > 0 && (
                        <div className="budget-section">
                            <h2 className="budget-section-title">By Day</h2>
                            <div className="budget-daily-list">
                                {dailyBreakdown.map(day => {
                                    const daySum = Object.values(day.totals).reduce((a, b) => a + b, 0);
                                    const barWidth = maxDayTotal > 0 ? (daySum / maxDayTotal) * 100 : 0;
                                    return (
                                        <div key={day.dateStr} className="budget-day-card card">
                                            <div className="budget-day-header">
                                                <div className="budget-day-date">
                                                    <span className="budget-day-name">{format(day.date, 'EEE')}</span>
                                                    <span className="budget-day-full">{format(day.date, 'MMM d')}</span>
                                                </div>
                                                <div className="budget-day-total">
                                                    {Object.entries(day.totals).map(([cur, amt]) => (
                                                        <span key={cur} className="budget-day-amount">{formatCurrency(amt, cur)}</span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="budget-day-bar-track">
                                                <div className="budget-day-bar-fill" style={{ width: `${barWidth}%` }} />
                                            </div>
                                            <div className="budget-day-items">
                                                {day.activities.map(a => (
                                                    <div key={a.id} className="budget-item">
                                                        <span className="budget-item-emoji">{CATEGORY_EMOJIS[a.category || 'other']}</span>
                                                        <span className="budget-item-title">{a.title}</span>
                                                        <span className="budget-item-cost">{formatCurrency(a.cost!, a.currency || 'USD')}</span>
                                                    </div>
                                                ))}
                                                {day.routes.map(r => (
                                                    <div key={r.id} className="budget-item">
                                                        <span className="budget-item-emoji">🚆</span>
                                                        <span className="budget-item-title">{r.from} → {r.to}</span>
                                                        <span className="budget-item-cost">{formatCurrency(r.cost!, r.currency || 'USD')}</span>
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
