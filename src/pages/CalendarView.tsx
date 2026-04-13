import React, { useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { format, isSameDay } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Info } from 'lucide-react';
import { CATEGORY_EMOJIS } from '../lib/types';
import ScenarioSwitcher from '../components/ScenarioSwitcher';
import WeatherBadge from '../components/WeatherBadge';
import { useCalendarViewController } from './useCalendarViewController';
import { setLastContext } from '../lib/lastContext';
import { getDefaultDayDateStr } from '../lib/tripDefaultDay';
import styles from './CalendarView.module.css';

const CalendarView: React.FC = () => {
    const navigate = useNavigate();

    const {
        trips,
        appSettings,
        currentDate,
        setCurrentDate,
        viewMode,
        setViewMode,
        selectedTripId,
        selectedTrip,
        accommodationEditDate,
        setAccommodationEditDate,
        accommodationCityInput,
        setAccommodationCityInput,
        accommodationNameInput,
        setAccommodationNameInput,
        conflictsExpandedDate,
        setConflictsExpandedDate,
        weatherByDate,
        weatherLoading,
        effectiveTrip,
        hasLocationForDate,
        effectiveActivities,
        handleSelectTrip,
        calendarDays,
        effectiveRoutes,
        getActivitiesForDate,
        tripDays,
        getActivityColor,
        planningConflicts,
        conflictCountsByDate,
        handleSaveAccommodationForDate,
        getEffectiveDayLocations,
    } = useCalendarViewController();

    useLayoutEffect(() => {
        setViewMode('trip');
    }, [setViewMode]);

    useEffect(() => {
        if (selectedTripId && selectedTrip) {
            setLastContext(selectedTripId, getDefaultDayDateStr(selectedTrip));
        }
    }, [selectedTripId, selectedTrip]);

    const goToDay = (day: Date, dateStr: string, conflictCount: number) => {
        if (!selectedTripId) return;
        navigate(`/trip/${selectedTripId}/day/${dateStr}`);
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
                <div>
                    <h1>Calendar</h1>
                    <p>Visualize your travel plans at a glance.</p>
                </div>
            </header>

            <div className={styles['calendar-controls']}>
                <select
                    className={`input-field ${styles['trip-select']}`}
                    value={selectedTripId || ''}
                    onChange={(e) => handleSelectTrip(e.target.value || null)}
                >
                    <option value="">Select a trip...</option>
                    {trips.map((t) => (
                        <option key={t.id} value={t.id}>
                            {t.name}
                        </option>
                    ))}
                </select>

                {selectedTrip && (
                    <ScenarioSwitcher trip={selectedTrip} activities={effectiveActivities} routes={effectiveRoutes} />
                )}

                {selectedTrip && calendarDays.length > 0 && viewMode === 'trip' && (
                    <div className={styles['day-nav-wrapper']}>
                        {tripDays.length > 0 && (
                            <>
                                <div className={styles['day-pills']}>
                                    {tripDays.map((day, idx) => {
                                        const dateStr = format(day, 'yyyy-MM-dd');
                                        const count = conflictCountsByDate[dateStr] || 0;
                                        return (
                                            <button
                                                key={idx}
                                                type="button"
                                                className={`${styles['day-pill']} ${isSameDay(day, currentDate) ? styles['active'] : ''} ${isSameDay(day, new Date()) ? styles['today'] : ''}`}
                                                onClick={() => goToDay(day, dateStr, count)}
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
                                {appSettings.showPlanningChecks &&
                                    conflictsExpandedDate &&
                                    (() => {
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
                            </>
                        )}
                    </div>
                )}
            </div>

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
                                    onClick={() => {
                                        if (!selectedTripId) return;
                                        navigate(`/trip/${selectedTripId}/day/${dateStr}`);
                                        setCurrentDate(day);
                                    }}
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
                                    {appSettings.showAccommodationOnTripCards &&
                                        (dayData?.accommodation ? (
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
                                            {dayActs.map((act) => (
                                                <div
                                                    key={act.id}
                                                    className={styles['cal-activity-chip']}
                                                    style={{ ['--activity-color' as string]: getActivityColor(act) }}
                                                >
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
                document.body,
            )}
        </div>
    );
};

export default CalendarView;
