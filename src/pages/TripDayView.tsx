import React, { useEffect } from 'react';
import { Navigate, useParams, useNavigate } from 'react-router-dom';
import { setLastContext } from '../lib/lastContext';
import { format, isSameDay } from 'date-fns';
import { AlertTriangle, Info, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { CATEGORY_EMOJIS } from '../lib/types';
import ActivityForm from '../components/ActivityForm';
import DraggableList from '../components/DraggableList';
import Markdown from '../components/Markdown';
import ScenarioSwitcher from '../components/ScenarioSwitcher';
import WeatherBadge from '../components/WeatherBadge';
import NearbyRestaurants from '../components/NearbyRestaurants';
import ActivityReviews from '../components/ActivityReviews';
import { useCalendarViewController } from './useCalendarViewController';
import { useTrips } from '../lib/store';
import { getDefaultDayDateStr, isDateInTripRange } from '../lib/tripDefaultDay';
import styles from './CalendarView.module.css';

const TripDayView: React.FC = () => {
    const { tripId, date: dateParam } = useParams<{ tripId: string; date: string }>();
    const navigate = useNavigate();
    const { trips, loading: tripsLoading } = useTrips();

    const {
        updateItineraryDay,
        activities,
        updateActivity,
        deleteActivity,
        restoreActivity,
        reorderActivities,
        showToast,
        appSettings,
        currentDate,
        setCurrentDate,
        selectedTripId,
        selectedTrip,
        addingActivityForDate,
        setAddingActivityForDate,
        editingActivityId,
        setEditingActivityId,
        tripSummary,
        setTripSummary,
        summaryLoading,
        summaryError,
        optimizationLoading,
        optimizationError,
        optimizedRoute,
        setOptimizedRoute,
        descriptionLoading,
        descriptionError,
        pendingDescriptions,
        setPendingDescriptions,
        showNearbyRestaurantsForActivityId,
        setShowNearbyRestaurantsForActivityId,
        reviewsActivityId,
        setReviewsActivityId,
        conflictsExpandedDate,
        setConflictsExpandedDate,
        weatherByDate,
        weatherLoading,
        activeScenario,
        effectiveTrip,
        hasLocationForDate,
        effectiveActivities,
        currentDateStr,
        currentDayLocations,
        effectiveRoutes,
        tripDays,
        handleReorderActivities,
        getActivityColor,
        dayViewActivities,
        planningConflicts,
        conflictCountsByDate,
        handleSaveActivity,
        handleGenerateSummary,
        handleOptimizeRoute,
        handleGenerateDescriptions,
        dismissPendingDescription,
        applyPendingDescription,
        handleAcceptAllDescriptions,
        fillGapsLoading,
        fillGapsError,
        gapSuggestions,
        handleFillGaps,
        acceptGapSuggestion,
        dismissGapSuggestion,
        hasDaySummaryContent,
        getNearbyPlacesLabel,
        updateScenarioTripSnapshot,
        getEffectiveDayLocations,
        reorderScenarioActivities,
        removeScenarioActivity,
    } = useCalendarViewController({ routeTripId: tripId ?? null, routeDateStr: dateParam ?? null });

    const tripFromStore = tripId ? trips.find((t) => t.id === tripId) : undefined;

    useEffect(() => {
        if (tripId && dateParam) {
            setLastContext(tripId, dateParam);
        }
    }, [tripId, dateParam]);

    if (!tripId || !dateParam) {
        return <Navigate to="/spreadsheet" replace />;
    }

    if (tripsLoading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <Loader2 size={28} className="spin" style={{ color: 'var(--primary-color)' }} />
            </div>
        );
    }

    if (!tripFromStore) {
        return <Navigate to="/spreadsheet" replace />;
    }

    if (!isDateInTripRange(dateParam, tripFromStore)) {
        const fallback = getDefaultDayDateStr(tripFromStore);
        return <Navigate to={`/trip/${tripId}/day/${fallback}`} replace />;
    }

    const goToDay = (day: Date, dateStr: string, conflictCount: number) => {
        navigate(`/trip/${tripId}/day/${dateStr}`);
        setCurrentDate(day);
        if (conflictCount > 0) {
            setConflictsExpandedDate((prev) => (prev === dateStr ? null : dateStr));
        } else {
            setConflictsExpandedDate(null);
        }
    };

    return (
        <div className="page-container animate-fade-in">
            <header className="page-header">
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <div>
                        <h1>Day</h1>
                        <p>
                            {selectedTrip ? (
                                <>
                                    {selectedTrip.name} · {format(currentDate, 'EEEE, MMM d, yyyy')}
                                </>
                            ) : (
                                'Trip day'
                            )}
                        </p>
                    </div>
                </div>
            </header>

            <div className={styles['calendar-controls']}>
                {selectedTrip && (
                    <ScenarioSwitcher trip={selectedTrip} activities={effectiveActivities} routes={effectiveRoutes} />
                )}

                {selectedTrip && tripDays.length > 0 && (
                    <div className={styles['day-nav-wrapper']}>
                        <div className={styles['day-pills']}>
                            {tripDays.map((day, idx) => {
                                const ds = format(day, 'yyyy-MM-dd');
                                const count = conflictCountsByDate[ds] || 0;
                                return (
                                    <button
                                        key={idx}
                                        type="button"
                                        className={`${styles['day-pill']} ${isSameDay(day, currentDate) ? styles['active'] : ''} ${isSameDay(day, new Date()) ? styles['today'] : ''}`}
                                        onClick={() => goToDay(day, ds, count)}
                                        title={format(day, 'EEEE, MMM d')}
                                    >
                                        <span className={styles['day-pill-num']}>{format(day, 'd')}</span>
                                        <span className={styles['day-pill-dow']}>{format(day, 'EEE')}</span>
                                        {appSettings.showPlanningChecks && count > 0 && (
                                            <span className={styles['issue-badge']}>{count}</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        {appSettings.showPlanningChecks && conflictsExpandedDate && (() => {
                            const expanded = planningConflicts.filter((c) => c.date === conflictsExpandedDate);
                            if (expanded.length === 0) return null;
                            return (
                                <div className={styles['inline-conflicts']}>
                                    {expanded.map((c) => (
                                        <div key={c.id} className={styles['inline-conflict-item']}>
                                            <span
                                                className={`${styles['inline-conflict-icon']} ${c.severity === 'info' ? styles['info'] : ''}`}
                                            >
                                                {c.severity === 'warning' ? <AlertTriangle size={13} /> : <Info size={13} />}
                                            </span>
                                            <span>
                                                <span className={styles['inline-conflict-title']}>{c.title}</span>
                                                {c.message}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>

            <div className={styles['day-detail-view']}>
                <div className={styles['day-export-capture']}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <WeatherBadge
                                day={weatherByDate.get(currentDateStr)?.[0]}
                                hasLocation={hasLocationForDate(currentDateStr)}
                                loading={weatherLoading}
                                tempUnit={appSettings.temperatureUnit}
                                compact={false}
                            />
                        </div>
                    </div>
                    <div className={`${styles['day-accommodation-card']} card`}>
                        <div className={styles['acc-card-header']} style={{ alignItems: 'baseline' }}>
                            <div className={styles['acc-card-icon']}>📅</div>
                            <div className={styles['acc-card-info']}>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                                    {format(currentDate, 'EEEE, MMM d')}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                    <div>
                                        <label htmlFor="day-location-input-tripday" className={styles['acc-label']}>
                                            City
                                        </label>
                                        <input
                                            id="day-location-input-tripday"
                                            type="text"
                                            className={`${styles['acc-name-input']} ${styles['input-transparent']}`}
                                            placeholder="e.g. Tokyo or Tokyo, Kyoto"
                                            defaultValue={currentDayLocations.join(', ')}
                                            key={`day-loc-${selectedTripId}-${activeScenario?.id ?? 'live'}-${currentDateStr}`}
                                            onBlur={(e) => {
                                                const raw = e.target.value;
                                                const parsed = raw.split(',').map((s) => s.trim()).filter(Boolean);
                                                const prev = getEffectiveDayLocations(
                                                    effectiveTrip?.itinerary?.[currentDateStr],
                                                    effectiveTrip?.dayLocations?.[currentDateStr],
                                                );
                                                if (parsed.join(', ') === prev.join(', ')) return;
                                                if (!selectedTripId) return;
                                                const updates =
                                                    parsed.length === 0
                                                        ? { location: '', locations: [] as string[] }
                                                        : parsed.length === 1
                                                          ? { location: parsed[0], locations: [parsed[0]] }
                                                          : { location: parsed[0], locations: parsed };
                                                if (activeScenario) {
                                                    updateScenarioTripSnapshot(selectedTripId, activeScenario.id, (trip) => ({
                                                        ...trip,
                                                        itinerary: {
                                                            ...(trip.itinerary || {}),
                                                            [currentDateStr]: { ...(trip.itinerary?.[currentDateStr] || {}), ...updates },
                                                        },
                                                    }));
                                                } else {
                                                    updateItineraryDay(selectedTripId, currentDateStr, updates);
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label className={styles['acc-label']}>Accommodation</label>
                                        <input
                                            type="text"
                                            className={`${styles['acc-name-input']} ${styles['input-transparent']}`}
                                            placeholder="Hotel / Ryokan / Airbnb"
                                            defaultValue={effectiveTrip?.itinerary?.[currentDateStr]?.accommodation?.name ?? ''}
                                            key={`acc-name-inline-${selectedTripId}-${activeScenario?.id ?? 'live'}-${currentDateStr}`}
                                            onBlur={(e) => {
                                                const val = e.target.value.trim();
                                                const current = effectiveTrip?.itinerary?.[currentDateStr]?.accommodation;
                                                if (val !== (current?.name ?? '')) {
                                                    if (selectedTripId && activeScenario) {
                                                        updateScenarioTripSnapshot(selectedTripId, activeScenario.id, (trip) => ({
                                                            ...trip,
                                                            itinerary: {
                                                                ...(trip.itinerary || {}),
                                                                [currentDateStr]: {
                                                                    ...(trip.itinerary?.[currentDateStr] || {}),
                                                                    accommodation: { ...current, name: val },
                                                                },
                                                            },
                                                        }));
                                                    } else {
                                                        updateItineraryDay(selectedTripId!, currentDateStr, {
                                                            accommodation: { ...current, name: val },
                                                        });
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className={`${styles['planning-action-row']} no-export`}>
                        <div className={styles['planning-action-row__left']}>
                            <button
                                type="button"
                                className={`${styles['action-btn']} ${styles['action-btn-violet']}`}
                                onClick={handleGenerateDescriptions}
                                disabled={descriptionLoading || dayViewActivities.length === 0}
                            >
                                <span className={styles['action-btn-icon']}>✨</span>
                                {descriptionLoading ? (
                                    <>
                                        <Loader2 size={14} className="spin" /> Describing…
                                    </>
                                ) : (
                                    'Describe Day'
                                )}
                            </button>
                            <button
                                type="button"
                                className={`${styles['action-btn']} ${styles['action-btn-amber']}`}
                                onClick={handleGenerateSummary}
                                disabled={summaryLoading || dayViewActivities.length === 0}
                            >
                                <span className={styles['action-btn-icon']}>📝</span>
                                {summaryLoading ? (
                                    <>
                                        <Loader2 size={14} className="spin" /> Generating…
                                    </>
                                ) : (
                                    'AI Summary'
                                )}
                            </button>
                            <button
                                type="button"
                                className={`${styles['action-btn']} ${styles['action-btn-mint']}`}
                                onClick={handleOptimizeRoute}
                                disabled={optimizationLoading || dayViewActivities.length <= 1}
                            >
                                <span className={styles['action-btn-icon']}>🗺️</span>
                                {optimizationLoading ? (
                                    <>
                                        <Loader2 size={14} className="spin" /> Optimizing…
                                    </>
                                ) : (
                                    'Optimize Route'
                                )}
                            </button>
                            <button
                                type="button"
                                className={`${styles['action-btn']} ${styles['action-btn-indigo']}`}
                                onClick={() => void handleFillGaps()}
                                disabled={fillGapsLoading || !dayViewActivities.some((a) => a.time)}
                            >
                                <span className={styles['action-btn-icon']}>⏱️</span>
                                {fillGapsLoading ? (
                                    <>
                                        <Loader2 size={14} className="spin" /> Filling…
                                    </>
                                ) : (
                                    'Fill gaps'
                                )}
                            </button>
                        </div>
                        {selectedTripId && addingActivityForDate !== currentDateStr && (
                            <button
                                type="button"
                                className={`${styles['action-btn']} ${styles['action-btn-sky']}`}
                                onClick={() => setAddingActivityForDate(currentDateStr)}
                            >
                                <Plus size={18} /> Add activity
                            </button>
                        )}
                    </div>
                    {selectedTripId && dayViewActivities.length > 0 && hasDaySummaryContent && (
                        <div className={`${styles['day-summary-section']} no-export`}>
                            {descriptionError && <p className="text-red-500 text-sm mt-2">{descriptionError}</p>}
                            {summaryError && <p className="text-red-500 text-sm mt-2">{summaryError}</p>}
                            {optimizationError && <p className="text-red-500 text-sm mt-2">{optimizationError}</p>}
                            {fillGapsError && <p className="text-red-500 text-sm mt-2">{fillGapsError}</p>}

                            {pendingDescriptions && (
                                <div className={`${styles['description-suggestion-card']} card`}>
                                    <div className={styles['description-suggestion-header']}>
                                        <div>
                                            <h4 className={styles['trip-summary-header']}>Suggested Activity Descriptions</h4>
                                            <p className={styles['trip-summary-text']}>
                                                Gemini drafted every activity in one request with a short description plus local tips and recommendations.
                                            </p>
                                        </div>
                                        <div className={styles['description-suggestion-actions']}>
                                            <button type="button" className="btn btn-primary btn-sm" onClick={() => void handleAcceptAllDescriptions()}>
                                                Accept all
                                            </button>
                                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPendingDescriptions(null)}>
                                                Dismiss all
                                            </button>
                                        </div>
                                    </div>

                                    <div className={styles['description-suggestion-list']}>
                                        {pendingDescriptions.map((item) => (
                                            <div key={item.activityId} className={styles['description-suggestion-item']}>
                                                <div className={styles['description-suggestion-copy']}>
                                                    <p className={styles['description-suggestion-title']}>{item.title}</p>
                                                    <p className={styles['description-suggestion-summary']}>{item.summary}</p>
                                                    <ul className={styles['description-suggestion-tips']}>
                                                        {item.tips.map((tip, index) => (
                                                            <li key={`${item.activityId}-${index}`}>{tip}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <div className={styles['description-suggestion-actions']}>
                                                    <button
                                                        type="button"
                                                        className="btn btn-primary btn-sm"
                                                        onClick={() => void applyPendingDescription(item.activityId, item.summary, item.tips)}
                                                    >
                                                        Accept
                                                    </button>
                                                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => dismissPendingDescription(item.activityId)}>
                                                        Decline
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {gapSuggestions && gapSuggestions.length > 0 && (
                                <div className={`${styles['description-suggestion-card']} card`}>
                                    <div className={styles['description-suggestion-header']}>
                                        <div>
                                            <h4 className={styles['trip-summary-header']}>Fill time gaps</h4>
                                            <p className={styles['trip-summary-text']}>
                                                Suggested activities for free windows of at least one hour. Times are local to your day.
                                            </p>
                                        </div>
                                    </div>
                                    <div className={styles['description-suggestion-list']}>
                                        {gapSuggestions.map((row, idx) => (
                                            <div
                                                key={`${row.windowStart}-${row.windowEnd}-${idx}`}
                                                className={styles['description-suggestion-item']}
                                            >
                                                <div className={styles['description-suggestion-copy']}>
                                                    <p className={`${styles['trip-summary-text']} ${styles['gap-suggestion-window']}`}>
                                                        {row.windowStart}–{row.windowEnd}
                                                    </p>
                                                    <p className={styles['description-suggestion-title']}>{row.suggestion.title}</p>
                                                    <p className={styles['description-suggestion-summary']}>{row.suggestion.details}</p>
                                                    <p className={`${styles['trip-summary-text']} ${styles['gap-suggestion-meta']}`}>
                                                        {row.suggestion.time} · {row.suggestion.location}
                                                    </p>
                                                </div>
                                                <div className={styles['description-suggestion-actions']}>
                                                    <button
                                                        type="button"
                                                        className="btn btn-primary btn-sm"
                                                        onClick={() => acceptGapSuggestion(idx)}
                                                    >
                                                        Accept
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => dismissGapSuggestion(idx)}
                                                    >
                                                        Dismiss
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {tripSummary && (
                                <div className="trip-summary-card card" style={{ padding: '1rem', marginTop: '0.75rem' }}>
                                    <h4 className={styles['trip-summary-header']}>AI Trip Summary</h4>
                                    <p className={styles['trip-summary-text']}>{tripSummary.summary}</p>
                                    {tripSummary.highlights.length > 0 && (
                                        <ul className={styles['trip-summary-highlights']}>
                                            {tripSummary.highlights.map((h, i) => (
                                                <li key={i}>{h}</li>
                                            ))}
                                        </ul>
                                    )}
                                    <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: '0.5rem' }} onClick={() => setTripSummary(null)}>
                                        Dismiss
                                    </button>
                                </div>
                            )}

                            {optimizedRoute && (
                                <div
                                    className="trip-summary-card card"
                                    style={{
                                        padding: '1rem',
                                        marginTop: '0.75rem',
                                        border: '2px solid var(--primary-color)',
                                        background: 'color-mix(in srgb, var(--primary-color) 12%, var(--surface-color))',
                                        borderRadius: 'var(--radius-md)',
                                    }}
                                >
                                    <h4 className={styles['trip-summary-header']}>AI Route Suggestion</h4>
                                    <p className={styles['trip-summary-text']}>{optimizedRoute.recommendation}</p>
                                    <ul className={styles['trip-summary-highlights']} style={{ marginTop: '0.5rem' }}>
                                        {optimizedRoute.optimizedOrder.map((id) => {
                                            const act = activities.find((a) => a.id === id);
                                            return act ? (
                                                <li key={id}>
                                                    {act.title} {act.time ? `(${act.time})` : ''}
                                                </li>
                                            ) : null;
                                        })}
                                    </ul>
                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                        <button
                                            type="button"
                                            className="btn btn-primary btn-sm"
                                            onClick={() => {
                                                const reorderedActivities = optimizedRoute.optimizedOrder
                                                    .map((id) => dayViewActivities.find((activity) => activity.id === id))
                                                    .filter((activity): activity is (typeof dayViewActivities)[number] => Boolean(activity));
                                                if (selectedTripId && activeScenario) {
                                                    reorderScenarioActivities(selectedTripId, activeScenario.id, reorderedActivities);
                                                } else {
                                                    const updates = optimizedRoute.optimizedOrder.map((id, idx) => ({ id, order: idx }));
                                                    reorderActivities(updates);
                                                }
                                                setOptimizedRoute(null);
                                            }}
                                        >
                                            Apply Order
                                        </button>
                                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOptimizedRoute(null)}>
                                            Dismiss
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {selectedTripId && addingActivityForDate === currentDateStr && (
                        <div className="no-export">
                            <ActivityForm
                                tripId={selectedTripId}
                                date={currentDateStr}
                                nextOrder={dayViewActivities.length}
                                defaultCurrency={selectedTrip?.defaultCurrency}
                                onSave={(data) => handleSaveActivity(data, currentDateStr)}
                                onCancel={() => setAddingActivityForDate(null)}
                            />
                        </div>
                    )}
                    {dayViewActivities.length === 0 && !addingActivityForDate && (
                        <p className={styles['no-activities-cal']}>No activities planned for this day.</p>
                    )}
                    <DraggableList
                        items={dayViewActivities}
                        keyFn={(a) => a.id}
                        onReorder={handleReorderActivities}
                        disabled={editingActivityId !== null}
                        renderItem={(act) =>
                            editingActivityId === act.id ? (
                                <div className="no-export">
                                    <ActivityForm
                                        tripId={act.tripId}
                                        date={act.date}
                                        existingActivity={act}
                                        nextOrder={act.order}
                                        defaultCurrency={effectiveTrip?.defaultCurrency}
                                        onSave={handleSaveActivity}
                                        onCancel={() => setEditingActivityId(null)}
                                        onDelete={() => {
                                            if (selectedTripId && activeScenario) {
                                                removeScenarioActivity(selectedTripId, activeScenario.id, act.id);
                                            } else {
                                                deleteActivity(act.id);
                                            }
                                            setEditingActivityId(null);
                                            if (!activeScenario) {
                                                showToast(`"${act.title}" deleted`, () => {
                                                    restoreActivity(act);
                                                });
                                            }
                                        }}
                                    />
                                </div>
                            ) : (
                                <div className={`${styles['day-detail-activity']} card`} style={{ ['--activity-color' as string]: getActivityColor(act) }}>
                                    <div className={styles['detail-header']}>
                                        <span className={styles['detail-emoji']}>{CATEGORY_EMOJIS[act.category || 'other']}</span>
                                        <div>
                                            <h4>{act.title}</h4>
                                            {act.time && <span className={styles['detail-time']}>{act.time}</span>}
                                        </div>
                                        <div className={`${styles['detail-actions']} no-export`}>
                                            {(act.location || currentDayLocations[0]) && (
                                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReviewsActivityId(act.id)} aria-label="Reviews">
                                                    📋 Reviews
                                                </button>
                                            )}
                                            {(act.location || currentDayLocations[0]) && (
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => setShowNearbyRestaurantsForActivityId(act.id)}
                                                    aria-label={getNearbyPlacesLabel(act.category).button}
                                                >
                                                    {getNearbyPlacesLabel(act.category).button}
                                                </button>
                                            )}
                                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingActivityId(act.id)} aria-label="Edit">
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => {
                                                    if (selectedTripId && activeScenario) {
                                                        removeScenarioActivity(selectedTripId, activeScenario.id, act.id);
                                                    } else {
                                                        deleteActivity(act.id);
                                                    }
                                                    if (!activeScenario) {
                                                        showToast(`"${act.title}" deleted`, () => {
                                                            restoreActivity(act);
                                                        });
                                                    }
                                                }}
                                                aria-label="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    {act.details && <Markdown className={styles['detail-desc']}>{act.details}</Markdown>}
                                    {act.location && <p className={styles['detail-location']}>📍 {act.location}</p>}
                                    {act.cost != null && (
                                        <p className={styles['detail-cost']}>
                                            💰 {act.currency || '$'}
                                            {act.cost.toFixed(2)}
                                        </p>
                                    )}
                                    {act.notes && <Markdown className={styles['detail-notes']}>{act.notes}</Markdown>}
                                    {reviewsActivityId === act.id && (
                                        <div className="no-export" style={{ marginTop: '0.75rem' }}>
                                            <ActivityReviews
                                                activityTitle={act.title}
                                                activityLocation={act.location || currentDayLocations[0]}
                                                onClose={() => setReviewsActivityId(null)}
                                            />
                                        </div>
                                    )}
                                    {showNearbyRestaurantsForActivityId === act.id && (
                                        <div className="no-export" style={{ marginTop: '0.75rem' }}>
                                            <NearbyRestaurants
                                                location={(act.location || currentDayLocations[0]) ?? ''}
                                                category={act.category}
                                                title={act.title}
                                                label={getNearbyPlacesLabel(act.category).panel}
                                                onClose={() => setShowNearbyRestaurantsForActivityId(null)}
                                                onAddToNote={(text) => {
                                                    const newNotes = act.notes ? act.notes.trimEnd() + '\n\n' + text : text;
                                                    updateActivity(act.id, { notes: newNotes });
                                                    setShowNearbyRestaurantsForActivityId(null);
                                                    showToast('Added to activity note');
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )
                        }
                    />
                </div>
            </div>
        </div>
    );
};

export default TripDayView;
