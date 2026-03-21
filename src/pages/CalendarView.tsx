import React from 'react';
import { createPortal } from 'react-dom';
import { format, isSameDay } from 'date-fns';
import { AlertTriangle, Info, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { CATEGORY_EMOJIS } from '../lib/types';
import ActivityForm from '../components/ActivityForm';
import DraggableList from '../components/DraggableList';
import Markdown from '../components/Markdown';
import { logEvent } from '../lib/amplitude';
import ScenarioSwitcher from '../components/ScenarioSwitcher';
import WeatherBadge from '../components/WeatherBadge';
import NearbyRestaurants from '../components/NearbyRestaurants';
import ActivityReviews from '../components/ActivityReviews';
import { useCalendarViewController, type CalendarViewMode } from './useCalendarViewController';
import styles from './CalendarView.module.css';

const CalendarView: React.FC = () => {
    const {
        trips,
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
        viewMode,
        setViewMode,
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
        accommodationEditDate,
        setAccommodationEditDate,
        accommodationCityInput,
        setAccommodationCityInput,
        accommodationNameInput,
        setAccommodationNameInput,
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
        handleSelectTrip,
        calendarDays,
        effectiveRoutes,
        getActivitiesForDate,
        tripDays,
        handleReorderActivities,
        getActivityColor,
        dayViewActivities,
        planningConflicts,
        conflictCountsByDate,
        handleSaveAccommodationForDate,
        handleSaveActivity,
        handleGenerateSummary,
        handleOptimizeRoute,
        handleGenerateDescriptions,
        dismissPendingDescription,
        applyPendingDescription,
        handleAcceptAllDescriptions,
        hasDaySummaryContent,
        getNearbyPlacesLabel,
        updateScenarioTripSnapshot,
        getEffectiveDayLocations,
        reorderScenarioActivities,
        removeScenarioActivity,
    } = useCalendarViewController();

    return (
        <div className="page-container animate-fade-in">
            <header className="page-header">
                <div>
                    <h1>Calendar</h1>
                    <p>Visualize your travel plans at a glance.</p>
                </div>
            </header>

            {/* Controls */}
            <div className={styles['calendar-controls']}>
                <div className={styles['view-tabs']}>
                    {(['trip', 'day'] as CalendarViewMode[]).map(mode => (
                        <button
                            key={mode}
                            className={`${styles['view-tab']} ${viewMode === mode ? styles['active'] : ''}`}
                            onClick={() => { setViewMode(mode); logEvent('Calendar View Changed', { view_mode: mode }); }}
                        >
                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </button>
                    ))}
                </div>

                <select
                    className={`input-field ${styles['trip-select']}`}
                    value={selectedTripId || ''}
                    onChange={e => handleSelectTrip(e.target.value || null)}
                >
                    <option value="">Select a trip...</option>
                    {trips.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>

                {selectedTrip && (
                    <ScenarioSwitcher trip={selectedTrip} activities={effectiveActivities} routes={effectiveRoutes} />
                )}

                {selectedTrip && calendarDays.length > 0 && (
                    <div className={styles['day-nav-wrapper']}>
                        {tripDays.length > 0 && (<>
                            <div className={styles['day-pills']}>
                                {tripDays.map((day, idx) => (
                                    (() => {
                                        const dateStr = format(day, 'yyyy-MM-dd');
                                        const count = conflictCountsByDate[dateStr] || 0;
                                        return (
                                            <button
                                                key={idx}
                                                className={`${styles['day-pill']} ${isSameDay(day, currentDate) ? styles['active'] : ''} ${isSameDay(day, new Date()) ? styles['today'] : ''}`}
                                                onClick={() => {
                                                    setCurrentDate(day);
                                                    if (count > 0) {
                                                        setConflictsExpandedDate(prev => prev === dateStr ? null : dateStr);
                                                    } else {
                                                        setConflictsExpandedDate(null);
                                                    }
                                                }}
                                                title={format(day, 'EEEE, MMM d')}
                                            >
                                                <span className={styles['day-pill-num']}>{format(day, 'd')}</span>
                                                <span className={styles['day-pill-dow']}>{format(day, 'EEE')}</span>
                                                {appSettings.showPlanningChecks && count > 0 && <span className={styles['issue-badge']}>{count}</span>}
                                            </button>
                                        );
                                    })()
                                ))}
                            </div>
                            {appSettings.showPlanningChecks && conflictsExpandedDate && (() => {
                                const expanded = planningConflicts.filter(c => c.date === conflictsExpandedDate);
                                if (expanded.length === 0) return null;
                                return (
                                    <div className={styles['inline-conflicts']}>
                                        {expanded.map(c => (
                                            <div key={c.id} className={styles['inline-conflict-item']}>
                                                <span className={`${styles['inline-conflict-icon']} ${c.severity === 'info' ? styles['info'] : ''}`}>
                                                    {c.severity === 'warning' ? <AlertTriangle size={13} /> : <Info size={13} />}
                                                </span>
                                                <span><span className={styles['inline-conflict-title']}>{c.title}</span>{c.message}</span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </>)}
                    </div>
                )}
            </div>

            {/* Trip Grid View */}
            {viewMode === 'trip' && (
                <div className={`${styles['calendar-grid']} ${styles.trip}`}>
                    <div className={`${styles['days-grid']} ${styles.trip}`}>
                        {tripDays.map((day, idx) => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const dayActs = getActivitiesForDate(day);
                            const isToday = isSameDay(day, new Date());
                            const dayData = effectiveTrip?.itinerary?.[dateStr];
                            const dayLocationDisplay = getEffectiveDayLocations(dayData, effectiveTrip?.dayLocations?.[dateStr]).join(', ');

                            return (
                                <div
                                    key={idx}
                                    className={`${styles['calendar-day']} ${isToday ? styles['today'] : ''}`}
                                    onClick={() => { setCurrentDate(day); setViewMode('day'); logEvent('Calendar View Changed', { view_mode: 'day', source: 'trip_card_click' }); }}
                                >
                                    <div className={styles['trip-card-header']}>
                                        <span className={styles['cal-day-number']}>{format(day, 'd')}</span>
                                        <div className={styles['cal-day-info']}>
                                            <span className={styles['cal-day-label']}>{format(day, 'EEE')}</span>
                                            {dayLocationDisplay && <span className={styles['cal-day-location']}>📍 {dayLocationDisplay}</span>}
                                            {appSettings.showPlanningChecks && (conflictCountsByDate[dateStr] || 0) > 0 && (
                                                <span className={styles['issue-badge-inline']}>{conflictCountsByDate[dateStr]}</span>
                                            )}
                                            <WeatherBadge
                                                day={weatherByDate.get(dateStr)?.[0]}
                                                hasLocation={hasLocationForDate(dateStr)}
                                                loading={weatherLoading}
                                                tempUnit={appSettings.temperatureUnit}
                                                compact={false}
                                            />
                                        </div>
                                    </div>
                                    {appSettings.showAccommodationOnTripCards && (dayData?.accommodation ? (
                                        <div
                                            className={styles['cal-day-accommodation']}
                                            title={dayData.accommodation.name}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setAccommodationEditDate(dateStr);
                                            }}
                                        >
                                            <span className={styles['cal-acc-icon']}>🏠</span>
                                            <span className={styles['cal-acc-name']}>{dayData.accommodation.name}</span>
                                        </div>
                                    ) : (
                                        <div
                                            className={`${styles['cal-day-accommodation']} ${styles['empty']}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setAccommodationEditDate(dateStr);
                                            }}
                                        >
                                            <span className={styles['cal-acc-icon']}>🏠</span>
                                            <span className={styles['cal-acc-name']}>Add stay...</span>
                                        </div>
                                    ))}
                                    {dayActs.length > 0 ? (
                                        <div className={styles['cal-day-activities']}>
                                            {dayActs.map(act => (
                                                <div key={act.id} className={styles['cal-activity-chip']} style={{ ['--activity-color' as string]: getActivityColor(act) }}>
                                                    <span>{CATEGORY_EMOJIS[act.category || 'other']}</span>
                                                    <span className={styles['cal-activity-title']}>{act.title}</span>
                                                    {act.time && <span className={styles['cal-activity-time']}>{act.time}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className={styles['trip-card-empty']}>No activities</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {accommodationEditDate && selectedTripId && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 120,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '1rem',
                    }}
                    onClick={() => setAccommodationEditDate(null)}
                >
                    <div
                        className="card"
                        style={{
                            width: '100%',
                            maxWidth: '520px',
                            background: 'var(--surface-color)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: 'var(--shadow-lg)',
                            padding: '1rem',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>🏠 Stay</div>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAccommodationEditDate(null)} aria-label="Close">
                                ×
                            </button>
                        </div>

                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>City</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        placeholder="e.g. Tokyo or Tokyo, Kyoto"
                                        value={accommodationCityInput}
                                        onChange={(e) => setAccommodationCityInput(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Accommodation</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Hotel / Ryokan / Airbnb"
                                        value={accommodationNameInput}
                                        onChange={(e) => setAccommodationNameInput(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAccommodationEditDate(null)}>
                                Cancel
                            </button>
                            <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveAccommodationForDate}>
                                Save
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Day Detail View */}
            {viewMode === 'day' && (
                <div className={styles['day-detail-view']}>
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
                                        <label htmlFor="day-location-input" className={styles['acc-label']}>City</label>
                                        <input
                                            id="day-location-input"
                                            type="text"
                                            className={`${styles['acc-name-input']} ${styles['input-transparent']}`}
                                            placeholder="e.g. Tokyo or Tokyo, Kyoto"
                                            defaultValue={currentDayLocations.join(', ')}
                                            key={`day-loc-${selectedTripId}-${activeScenario?.id ?? 'live'}-${currentDateStr}`}
                                            onBlur={e => {
                                                const raw = e.target.value;
                                                const parsed = raw.split(',').map(s => s.trim()).filter(Boolean);
                                                const prev = getEffectiveDayLocations(effectiveTrip?.itinerary?.[currentDateStr], effectiveTrip?.dayLocations?.[currentDateStr]);
                                                if (parsed.join(', ') === prev.join(', ')) return;
                                                if (!selectedTripId) return;
                                                const updates = parsed.length === 0
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
                                            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
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
                                            onBlur={e => {
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
                                                            accommodation: { ...current, name: val }
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
                    <div className={styles['planning-action-row']}>
                        <div className={styles['planning-action-row__left']}>
                            <button
                                type="button"
                                className={`${styles['action-btn']} ${styles['action-btn-violet']}`}
                                onClick={handleGenerateDescriptions}
                                disabled={descriptionLoading || dayViewActivities.length === 0}
                            >
                                <span className={styles['action-btn-icon']}>✨</span>
                                {descriptionLoading ? <><Loader2 size={14} className="spin" /> Describing…</> : 'Describe Day'}
                            </button>
                            <button
                                type="button"
                                className={`${styles['action-btn']} ${styles['action-btn-amber']}`}
                                onClick={handleGenerateSummary}
                                disabled={summaryLoading || dayViewActivities.length === 0}
                            >
                                <span className={styles['action-btn-icon']}>📝</span>
                                {summaryLoading ? <><Loader2 size={14} className="spin" /> Generating…</> : 'AI Summary'}
                            </button>
                            <button
                                type="button"
                                className={`${styles['action-btn']} ${styles['action-btn-mint']}`}
                                onClick={handleOptimizeRoute}
                                disabled={optimizationLoading || dayViewActivities.length <= 1}
                            >
                                <span className={styles['action-btn-icon']}>🗺️</span>
                                {optimizationLoading ? <><Loader2 size={14} className="spin" /> Optimizing…</> : 'Optimize Route'}
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
                        <div className={styles['day-summary-section']}>
                            {descriptionError && <p className="text-red-500 text-sm mt-2">{descriptionError}</p>}
                            {summaryError && <p className="text-red-500 text-sm mt-2">{summaryError}</p>}
                            {optimizationError && <p className="text-red-500 text-sm mt-2">{optimizationError}</p>}

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
                                                    <button
                                                        type="button"
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => dismissPendingDescription(item.activityId)}
                                                    >
                                                        Decline
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
                                            {tripSummary.highlights.map((h, i) => <li key={i}>{h}</li>)}
                                        </ul>
                                    )}
                                    <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: '0.5rem' }} onClick={() => setTripSummary(null)}>Dismiss</button>
                                </div>
                            )}

                            {optimizedRoute && (
                                <div className="trip-summary-card card" style={{ padding: '1rem', marginTop: '0.75rem', border: '2px solid var(--primary-color)', background: 'color-mix(in srgb, var(--primary-color) 12%, var(--surface-color))', borderRadius: 'var(--radius-md)' }}>
                                    <h4 className={styles['trip-summary-header']}>AI Route Suggestion</h4>
                                    <p className={styles['trip-summary-text']}>{optimizedRoute.recommendation}</p>
                                    <ul className={styles['trip-summary-highlights']} style={{ marginTop: '0.5rem' }}>
                                        {optimizedRoute.optimizedOrder.map(id => {
                                            const act = activities.find(a => a.id === id);
                                            return act ? <li key={id}>{act.title} {act.time ? `(${act.time})` : ''}</li> : null;
                                        })}
                                    </ul>
                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                        <button
                                            type="button"
                                            className="btn btn-primary btn-sm"
                                            onClick={() => {
                                                const reorderedActivities = optimizedRoute.optimizedOrder
                                                    .map((id) => dayViewActivities.find((activity) => activity.id === id))
                                                    .filter((activity): activity is typeof dayViewActivities[number] => Boolean(activity));
                                                if (selectedTripId && activeScenario) {
                                                    reorderScenarioActivities(selectedTripId, activeScenario.id, reorderedActivities);
                                                } else {
                                                    const updates = optimizedRoute.optimizedOrder.map((id, idx) => ({ id, order: idx }));
                                                    reorderActivities(updates);
                                                }
                                                setOptimizedRoute(null);
                                                logEvent('Route Optimized List Applied');
                                            }}
                                        >
                                            Apply Order
                                        </button>
                                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOptimizedRoute(null)}>Dismiss</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {selectedTripId && (
                        addingActivityForDate === currentDateStr && (
                            <ActivityForm
                                tripId={selectedTripId}
                                date={currentDateStr}
                                nextOrder={dayViewActivities.length}
                                defaultCurrency={selectedTrip?.defaultCurrency}
                                onSave={(data) => handleSaveActivity(data, currentDateStr)}
                                onCancel={() => setAddingActivityForDate(null)}
                            />
                        )
                    )}
                    {dayViewActivities.length === 0 && !addingActivityForDate && (
                        <p className={styles['no-activities-cal']}>No activities planned for this day.</p>
                    )}
                    <DraggableList
                        items={dayViewActivities}
                        keyFn={a => a.id}
                        onReorder={handleReorderActivities}
                        disabled={editingActivityId !== null}
                        renderItem={(act, _idx) =>
                            editingActivityId === act.id ? (
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
                                        logEvent('Activity Deleted', { activity_title: act.title, category: act.category, source: 'calendar_day' });
                                        if (!activeScenario) {
                                            showToast(`"${act.title}" deleted`, () => {
                                                restoreActivity(act);
                                                logEvent('Activity Delete Undone', { activity_title: act.title });
                                            });
                                        }
                                    }}
                                />
                            ) : (
                                <div className={`${styles['day-detail-activity']} card`} style={{ ['--activity-color' as string]: getActivityColor(act) }}>
                                    <div className={styles['detail-header']}>
                                        <span className={styles['detail-emoji']}>{CATEGORY_EMOJIS[act.category || 'other']}</span>
                                        <div>
                                            <h4>{act.title}</h4>
                                            {act.time && <span className={styles['detail-time']}>{act.time}</span>}
                                        </div>
                                        <div className={styles['detail-actions']}>
                                            {(act.location || currentDayLocations[0]) && (
                                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReviewsActivityId(act.id)} aria-label="Reviews">📋 Reviews</button>
                                            )}
                                            {(act.location || currentDayLocations[0]) && (
                                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowNearbyRestaurantsForActivityId(act.id)} aria-label={getNearbyPlacesLabel(act.category).button}>
                                                    {getNearbyPlacesLabel(act.category).button}
                                                </button>
                                            )}
                                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingActivityId(act.id)} aria-label="Edit"><Pencil size={16} /></button>
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => {
                                                    if (selectedTripId && activeScenario) {
                                                        removeScenarioActivity(selectedTripId, activeScenario.id, act.id);
                                                    } else {
                                                        deleteActivity(act.id);
                                                    }
                                                    logEvent('Activity Deleted', { activity_title: act.title, category: act.category, source: 'calendar_card' });
                                                    if (!activeScenario) {
                                                        showToast(`"${act.title}" deleted`, () => {
                                                            restoreActivity(act);
                                                            logEvent('Activity Delete Undone', { activity_title: act.title });
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
                                    {act.cost != null && <p className={styles['detail-cost']}>💰 {act.currency || '$'}{act.cost.toFixed(2)}</p>}
                                    {act.notes && <Markdown className={styles['detail-notes']}>{act.notes}</Markdown>}
                                    {reviewsActivityId === act.id && (
                                        <div style={{ marginTop: '0.75rem' }}>
                                            <ActivityReviews
                                                activityTitle={act.title}
                                                activityLocation={act.location || currentDayLocations[0]}
                                                onClose={() => setReviewsActivityId(null)}
                                            />
                                        </div>
                                    )}
                                    {showNearbyRestaurantsForActivityId === act.id && (
                                        <div style={{ marginTop: '0.75rem' }}>
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
            )}
        </div>
    );
};

export default CalendarView;
