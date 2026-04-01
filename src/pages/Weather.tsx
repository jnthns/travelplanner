import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { CloudSun, RefreshCw, ChevronDown, ChevronUp, Pencil, Check } from 'lucide-react';
import { useTrips } from '../lib/store';
import { useWeatherForTrip, formatTemp, type WeatherRequestLog } from '../lib/weather';
import { getDatesMissingLocation, getEffectiveDayLocations } from '../lib/itinerary';
import { useSettings } from '../lib/settings';
import type { TempUnit } from '../lib/weather';

const MAX_DEBUG_LOGS = 80;

function formatTime(iso: string): string {
  if (!iso) return '—';
  try {
    const d = parseISO(iso.replace('Z', ''));
    if (isNaN(d.getTime())) return '—';
    return format(d, 'HH:mm');
  } catch {
    return '—';
  }
}

const Weather: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tripIdParam = searchParams.get('trip');
  const { trips, updateItineraryDay } = useTrips();
  const settings = useSettings();
  const tempUnit = settings.temperatureUnit as TempUnit;
  const hourlyStart = settings.hourlyForecastStartHour ?? 9;
  const hourlyEnd = settings.hourlyForecastEndHour ?? 21;

  const selectedTripId = tripIdParam && trips.some((t) => t.id === tripIdParam)
    ? tripIdParam
    : trips[0]?.id ?? null;
  const selectedTrip = trips.find((t) => t.id === selectedTripId);

  const [requestLogs, setRequestLogs] = useState<WeatherRequestLog[]>([]);
  const [debugOpen, setDebugOpen] = useState(false);
  const [editingLocationDate, setEditingLocationDate] = useState<string | null>(null);
  const [editLocationValue, setEditLocationValue] = useState('');

  const onRequestLog = useCallback((entry: WeatherRequestLog) => {
    setRequestLogs((prev) => [...prev.slice(-(MAX_DEBUG_LOGS - 1)), entry]);
  }, []);

  useEffect(() => {
    if (selectedTripId && selectedTripId !== tripIdParam) {
      setSearchParams({ trip: selectedTripId }, { replace: true });
    }
  }, [selectedTripId, tripIdParam, setSearchParams]);

  const { weatherByDate, loading: weatherLoading, refetch } = useWeatherForTrip(selectedTrip ?? null, { onRequestLog });
  const datesMissingLocation = getDatesMissingLocation(selectedTrip ?? null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const tripDaysRef = useRef<string[]>([]);

  const tripDays: string[] = React.useMemo(() => {
    if (!selectedTrip) return [];
    const out: string[] = [];
    try {
      const start = new Date(selectedTrip.startDate + 'T12:00:00Z');
      const end = new Date(selectedTrip.endDate + 'T12:00:00Z');
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        out.push(d.toISOString().slice(0, 10));
      }
    } catch { /* ignore */ }
    return out;
  }, [selectedTrip?.id, selectedTrip?.startDate, selectedTrip?.endDate]);

  useEffect(() => {
    if (tripDays.length > 0 && expandedDate === null) {
      setExpandedDate(tripDays[0]);
    }
    tripDaysRef.current = tripDays;
  }, [tripDays.join(',')]);

  if (trips.length === 0) {
    return (
      <div className="page-container animate-fade-in">
        <header className="page-header">
          <h1>Weather</h1>
          <p>Create a trip first to see weather forecasts.</p>
        </header>
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in">
      <header className="page-header" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CloudSun size={28} style={{ color: 'var(--primary-color)' }} />
          <div>
            <h1 style={{ margin: 0 }}>Weather</h1>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Forecast for your trip</p>
          </div>
        </div>
        <select
          className="input-field"
          value={selectedTripId ?? ''}
          onChange={(e) => {
            const id = e.target.value || null;
            setSearchParams(id ? { trip: id } : {}, { replace: true });
          }}
          style={{ minWidth: '200px' }}
        >
          {trips.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            refetch();
          }}
          disabled={weatherLoading}
          title="Sync latest weather"
        >
          <RefreshCw size={18} className={weatherLoading ? 'spin' : undefined} />
          {weatherLoading ? ' Updating…' : ' Sync weather'}
        </button>
      </header>

      {datesMissingLocation.length > 0 && (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            background: 'var(--border-light)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.9rem',
            color: 'var(--text-secondary)',
          }}
        >
          Add a city for {datesMissingLocation.length} day{datesMissingLocation.length === 1 ? '' : 's'} to see forecasts: set locations in Calendar or Spreadsheet.
        </div>
      )}

      {weatherLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
          {tripDays.map((dateStr) => (
            <div
              key={dateStr}
              style={{
                height: '56px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--border-light)',
                animation: 'weather-shimmer 1.5s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
          {tripDays.map((dateStr) => {
            const days = weatherByDate.get(dateStr) ?? [];
            const firstDay = days[0];
            const isExpanded = expandedDate === dateStr;
            const hasLocation = getEffectiveDayLocations(selectedTrip?.itinerary?.[dateStr], selectedTrip?.dayLocations?.[dateStr]).length > 0;
            const canExpand = days.length > 0 || hasLocation;

            return (
              <div
                key={dateStr}
                className="card"
                style={{
                  padding: 0,
                  overflow: 'hidden',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (!canExpand) return;
                    if (isExpanded) {
                      setExpandedDate(null);
                    } else {
                      setExpandedDate(dateStr);
                    }
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    border: 'none',
                    background: 'transparent',
                    color: 'inherit',
                    font: 'inherit',
                    cursor: canExpand ? 'pointer' : 'default',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ color: 'var(--text-primary)' }}>
                    {format(parseISO(dateStr), 'EEE MMM d')}
                    {' · '}
                    <span style={{ color: 'var(--text-secondary)' }}>
                      📍 {days.length > 0 ? days.map((d) => d.location).join(', ') : (getEffectiveDayLocations(selectedTrip?.itinerary?.[dateStr], selectedTrip?.dayLocations?.[dateStr]).join(', ') || '—')}
                    </span>
                  </span>
                  {firstDay?.isForecastAvailable ? (
                    <span>
                      {firstDay.emoji} {formatTemp(firstDay.tempMinC, tempUnit)}–{formatTemp(firstDay.tempMaxC, tempUnit)}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                  )}
                </button>

                {isExpanded && (
                  <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid var(--border-color)' }}>
                    {/* Per-day location edit: overwrites app-wide for this date */}
                    <div style={{ marginTop: '0.75rem', marginBottom: '0.5rem' }}>
                      {editingLocationDate === dateStr ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <input
                            type="text"
                            className="input-field"
                            value={editLocationValue}
                            onChange={(e) => setEditLocationValue(e.target.value)}
                            placeholder="City or cities (comma-separated)"
                            style={{ flex: '1 1 200px', minWidth: 0 }}
                            autoFocus
                          />
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => {
                              const raw = editLocationValue.trim();
                              const locations = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];
                              if (selectedTripId && locations.length > 0) {
                                updateItineraryDay(selectedTripId, dateStr, {
                                  location: locations[0],
                                  locations,
                                });
                              }
                              setEditingLocationDate(null);
                              setEditLocationValue('');
                            }}
                          >
                            <Check size={16} /> Save
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => {
                              setEditingLocationDate(null);
                              setEditLocationValue('');
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: '0.85rem' }}
                          onClick={() => {
                            const current = getEffectiveDayLocations(selectedTrip?.itinerary?.[dateStr], selectedTrip?.dayLocations?.[dateStr]).join(', ');
                            setEditLocationValue(current);
                            setEditingLocationDate(dateStr);
                          }}
                        >
                          <Pencil size={14} /> Edit location for this day
                        </button>
                      )}
                    </div>
                    {days.length === 0 ? (
                      <div style={{ paddingTop: '0.25rem', color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                        Add a location for this day to see forecast (use &quot;Edit location&quot; above or set in Calendar/Spreadsheet).
                      </div>
                    ) : (
                      days.map((day, idx) => (
                        <div key={day.location + idx} style={{ marginTop: idx > 0 ? '1.25rem' : '0.75rem' }}>
                          <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>📍 {day.location}</div>
                          {day.isForecastAvailable ? (
                            <>
                              <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
                                <div style={{ fontWeight: 600 }}>{day.emoji ?? '🌡'} {day.weatherLabel ?? '—'}</div>
                                <div>🌡 High {formatTemp(day.tempMaxC, tempUnit)} Low {formatTemp(day.tempMinC, tempUnit)}</div>
                                <div>🌧 Precip: {(day.precipitationMm ?? 0).toFixed(1)}mm · {day.precipitationProbabilityMax ?? 0}% chance</div>
                                <div>☀ UV Index: {day.uvIndexMax ?? '—'}</div>
                                <div>🌅 Sunrise {formatTime(day.sunriseIso ?? '')}</div>
                                <div>🌇 Sunset {formatTime(day.sunsetIso ?? '')}</div>
                              </div>
                              <div style={{ marginTop: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Hourly</div>
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                                  gap: '0.35rem',
                                  maxHeight: '280px',
                                  overflowY: 'auto',
                                  fontSize: '0.8rem',
                                  color: 'var(--text-secondary)',
                                }}
                              >
                                {(day.hours ?? []).filter((h) => h.hour >= hourlyStart && h.hour <= hourlyEnd).map((h) => (
                                  <div
                                    key={h.hour}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.35rem',
                                      padding: '0.25rem 0.4rem',
                                      background: 'var(--surface-color)',
                                      borderRadius: 'var(--radius-sm)',
                                    }}
                                  >
                                    <span style={{ color: 'var(--text-tertiary)', minWidth: '2.5rem' }}>
                                      [{String(h.hour).padStart(2, '0')}:00]
                                    </span>
                                    <span>{h.emoji}</span>
                                    <span>{formatTemp(h.tempC, tempUnit)}</span>
                                    <span>{h.precipitationMm.toFixed(1)}mm {h.precipitationProbability}%</span>
                                  </div>
                                ))}
                              </div>
                            </>
                          ) : (
                            <div style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                              Forecast not yet available
                              {dateStr < format(new Date(), 'yyyy-MM-dd') && (
                                <span style={{ display: 'block', marginTop: '0.25rem' }}>
                                  Forecast is only available for the next 16 days from today.
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Temporary debug panel: Open-Meteo request attempts (remove later) */}
      <div style={{ marginTop: '2rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <button
          type="button"
          onClick={() => setDebugOpen((o) => !o)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.5rem 0.75rem',
            background: 'var(--surface-color)',
            border: 'none',
            font: 'inherit',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}
        >
          <span>Debug: Open-Meteo requests ({requestLogs.length})</span>
          {debugOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {debugOpen && (
          <div style={{ padding: '0.75rem', background: 'var(--bg-color)', maxHeight: '320px', overflowY: 'auto', fontSize: '0.8rem', fontFamily: 'monospace' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: '0.75rem' }}
                onClick={() => setRequestLogs([])}
              >
                Clear logs
              </button>
            </div>
            {requestLogs.length === 0 ? (
              <div style={{ color: 'var(--text-tertiary)' }}>No requests yet. Select a trip with day locations and click Sync weather.</div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {requestLogs.map((log) => (
                  <li
                    key={log.id}
                    style={{
                      padding: '0.25rem 0',
                      borderBottom: '1px solid var(--border-light)',
                      color: log.ok ? 'var(--text-secondary)' : 'var(--error-color, #c00)',
                    }}
                  >
                    <span style={{ color: 'var(--text-tertiary)', marginRight: '0.5rem' }}>{log.time.slice(11, 19)}</span>
                    <span style={{ fontWeight: 600 }}>{log.type}</span>
                    {log.location != null && <span> {log.location}</span>}
                    {log.status != null && <span> HTTP {log.status}</span>}
                    {log.message != null && <span> — {log.message}</span>}
                    <div style={{ wordBreak: 'break-all', marginTop: '0.15rem', color: 'var(--text-tertiary)' }}>{log.url}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Weather;
