/**
 * Open-Meteo weather service. No API key; call directly from frontend.
 * Geocode + weather caches are module-level (session-scoped).
 */

import * as React from 'react';
import type { Trip } from './types';
import { getEffectiveDayLocations } from './itinerary';

export type TempUnit = 'C' | 'F';

export interface WeatherHour {
  hour: number; // 0–23
  tempC: number;
  precipitationMm: number;
  precipitationProbability: number; // 0–100
  weatherCode: number;
  weatherLabel: string;
  emoji: string;
}

export interface WeatherDay {
  date: string; // ISO YYYY-MM-DD
  location: string;
  locationIsFallback: boolean;
  tempMinC: number;
  tempMaxC: number;
  precipitationMm: number;
  precipitationProbabilityMax: number; // 0–100
  uvIndexMax: number;
  sunriseIso: string;
  sunsetIso: string;
  weatherCode: number;
  weatherLabel: string;
  emoji: string;
  hours: WeatherHour[]; // 24 entries, indices 0–23
  isForecastAvailable: boolean;
}

const WMO_CODES: Record<number, { label: string; emoji: string }> = {
  0: { label: 'Clear', emoji: '☀' },
  1: { label: 'Mainly clear', emoji: '🌤' },
  2: { label: 'Partly cloudy', emoji: '⛅' },
  3: { label: 'Overcast', emoji: '☁' },
  45: { label: 'Fog', emoji: '🌫' },
  48: { label: 'Depositing rime fog', emoji: '🌫' },
  51: { label: 'Light drizzle', emoji: '🌧' },
  53: { label: 'Moderate drizzle', emoji: '🌧' },
  55: { label: 'Dense drizzle', emoji: '🌧' },
  56: { label: 'Light freezing drizzle', emoji: '🌧' },
  57: { label: 'Dense freezing drizzle', emoji: '🌧' },
  61: { label: 'Slight rain', emoji: '🌧' },
  63: { label: 'Moderate rain', emoji: '🌧' },
  65: { label: 'Heavy rain', emoji: '🌧' },
  66: { label: 'Light freezing rain', emoji: '🌧' },
  67: { label: 'Heavy freezing rain', emoji: '🌧' },
  71: { label: 'Slight snow', emoji: '❄' },
  73: { label: 'Moderate snow', emoji: '❄' },
  75: { label: 'Heavy snow', emoji: '❄' },
  77: { label: 'Snow grains', emoji: '❄' },
  80: { label: 'Slight rain showers', emoji: '🌦' },
  81: { label: 'Moderate rain showers', emoji: '🌦' },
  82: { label: 'Violent rain showers', emoji: '🌦' },
  85: { label: 'Slight snow showers', emoji: '🌨' },
  86: { label: 'Heavy snow showers', emoji: '🌨' },
  95: { label: 'Thunderstorm', emoji: '⛈' },
  96: { label: 'Thunderstorm with slight hail', emoji: '⛈' },
  99: { label: 'Thunderstorm with heavy hail', emoji: '⛈' },
};

function wmoToLabelEmoji(code: number): { label: string; emoji: string } {
  return WMO_CODES[code] ?? { label: 'Unknown', emoji: '🌡' };
}

const geocodeCache = new Map<string, { lat: number; lng: number } | null>();
const weatherCache = new Map<string, WeatherDay[]>();

/** One Open-Meteo request attempt (geocode or forecast) for the debug panel. */
export interface WeatherRequestLog {
  id: string;
  time: string; // ISO
  type: 'geocode' | 'forecast';
  location?: string;
  url: string;
  status?: number;
  ok: boolean;
  message?: string;
}

/** Clear geocode and weather caches so the next fetch uses fresh data. */
export function clearWeatherCaches(): void {
  geocodeCache.clear();
  weatherCache.clear();
}

function nextLogId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function geocodeLocation(
  location: string,
  options?: { onLog?: (entry: WeatherRequestLog) => void }
): Promise<{ lat: number; lng: number } | null> {
  const key = location.trim();
  if (!key) return null;
  const cached = geocodeCache.get(key);
  if (cached !== undefined) return cached;

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(key)}&count=1&language=en&format=json`;
  options?.onLog?.({
    id: nextLogId(),
    time: new Date().toISOString(),
    type: 'geocode',
    location: key,
    url,
    ok: true,
    message: 'request start',
  });

  try {
    const res = await fetch(url);
    const data = (await res.json()) as { results?: Array<{ latitude: number; longitude: number }> };
    const coords = data.results?.[0];
    const result = coords ? { lat: coords.latitude, lng: coords.longitude } : null;
    geocodeCache.set(key, result);
    options?.onLog?.({
      id: nextLogId(),
      time: new Date().toISOString(),
      type: 'geocode',
      location: key,
      url,
      status: res.status,
      ok: !!result,
      message: result ? `lat=${result.lat} lng=${result.lng}` : 'no results',
    });
    return result;
  } catch (e) {
    geocodeCache.set(key, null);
    options?.onLog?.({
      id: nextLogId(),
      time: new Date().toISOString(),
      type: 'geocode',
      location: key,
      url,
      ok: false,
      message: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

export async function fetchWeatherForDates(
  params: {
    location: string;
    locationIsFallback: boolean;
    dates: string[];
  },
  options?: { onLog?: (entry: WeatherRequestLog) => void }
): Promise<WeatherDay[]> {
  const { location, locationIsFallback, dates } = params;
  if (dates.length === 0) return [];

  const sorted = [...dates].sort();
  const startDate = sorted[0];
  const endDate = sorted[sorted.length - 1];
  const cacheKey = `${location}:${startDate}:${endDate}`;
  const cached = weatherCache.get(cacheKey);
  if (cached) return cached;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxForecastDate = new Date(today);
  maxForecastDate.setDate(maxForecastDate.getDate() + 16);

  const parseDate = (s: string) => {
    const d = new Date(s + 'T12:00:00Z');
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const isBeyondWindow = (dateStr: string) => parseDate(dateStr) > maxForecastDate;
  if (dates.every(isBeyondWindow)) {
    const entries: WeatherDay[] = dates.map((date) => ({
      date,
      location,
      locationIsFallback,
      tempMinC: 0,
      tempMaxC: 0,
      precipitationMm: 0,
      precipitationProbabilityMax: 0,
      uvIndexMax: 0,
      sunriseIso: '',
      sunsetIso: '',
      weatherCode: 0,
      weatherLabel: 'Unknown',
      emoji: '🌡',
      hours: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        tempC: 0,
        precipitationMm: 0,
        precipitationProbability: 0,
        weatherCode: 0,
        weatherLabel: 'Unknown',
        emoji: '🌡',
      })),
      isForecastAvailable: false,
    }));
    return entries;
  }

  const coords = await geocodeLocation(location, { onLog: options?.onLog });
  if (!coords) {
    const entries: WeatherDay[] = dates.map((date) => ({
      date,
      location,
      locationIsFallback,
      tempMinC: 0,
      tempMaxC: 0,
      precipitationMm: 0,
      precipitationProbabilityMax: 0,
      uvIndexMax: 0,
      sunriseIso: '',
      sunsetIso: '',
      weatherCode: 0,
      weatherLabel: 'Unknown',
      emoji: '🌡',
      hours: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        tempC: 0,
        precipitationMm: 0,
        precipitationProbability: 0,
        weatherCode: 0,
        weatherLabel: 'Unknown',
        emoji: '🌡',
      })),
      isForecastAvailable: false,
    }));
    return entries;
  }

  // Use forecast_days instead of start_date/end_date so we never send past dates (API returns 400 for past ranges).
  const dailyUrl = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&forecast_days=16&timezone=auto&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weathercode,uv_index_max,sunrise,sunset`;
  const hourlyUrl = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&forecast_days=16&timezone=auto&hourly=temperature_2m,precipitation,precipitation_probability,weathercode`;

  options?.onLog?.({
    id: nextLogId(),
    time: new Date().toISOString(),
    type: 'forecast',
    location,
    url: dailyUrl,
    ok: true,
    message: 'daily request start',
  });
  options?.onLog?.({
    id: nextLogId(),
    time: new Date().toISOString(),
    type: 'forecast',
    location,
    url: hourlyUrl,
    ok: true,
    message: 'hourly request start',
  });

  const [dailyRes, hourlyRes] = await Promise.all([fetch(dailyUrl), fetch(hourlyUrl)]);

  options?.onLog?.({
    id: nextLogId(),
    time: new Date().toISOString(),
    type: 'forecast',
    location,
    url: dailyUrl,
    status: dailyRes.status,
    ok: dailyRes.ok,
    message: dailyRes.ok ? 'daily OK' : `daily ${dailyRes.status}`,
  });
  options?.onLog?.({
    id: nextLogId(),
    time: new Date().toISOString(),
    type: 'forecast',
    location,
    url: hourlyUrl,
    status: hourlyRes.status,
    ok: hourlyRes.ok,
    message: hourlyRes.ok ? 'hourly OK' : `hourly ${hourlyRes.status}`,
  });

  if (!dailyRes.ok || !hourlyRes.ok) {
    const fallbacks = dates.map((date) => ({
      date,
      location,
      locationIsFallback,
      tempMinC: 0,
      tempMaxC: 0,
      precipitationMm: 0,
      precipitationProbabilityMax: 0,
      uvIndexMax: 0,
      sunriseIso: '',
      sunsetIso: '',
      weatherCode: 0,
      weatherLabel: 'Unknown',
      emoji: '🌡',
      hours: Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        tempC: 0,
        precipitationMm: 0,
        precipitationProbability: 0,
        weatherCode: 0,
        weatherLabel: 'Unknown',
        emoji: '🌡',
      })),
      isForecastAvailable: false,
    }));
    return fallbacks;
  }

  const dailyData = (await dailyRes.json()) as {
    daily?: {
      time?: string[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      precipitation_sum?: number[];
      precipitation_probability_max?: number[];
      weathercode?: number[];
      uv_index_max?: number[];
      sunrise?: string[];
      sunset?: string[];
    };
  };
  const hourlyData = (await hourlyRes.json()) as {
    hourly?: {
      time?: string[];
      temperature_2m?: number[];
      precipitation?: number[];
      precipitation_probability?: number[];
      weathercode?: number[];
    };
  };

  const daily = dailyData.daily;
  const hourly = hourlyData.hourly;
  if (!daily?.time || !hourly?.time) {
    const fallbacks = dates.map((date) => ({
      date,
      location,
      locationIsFallback,
      tempMinC: 0,
      tempMaxC: 0,
      precipitationMm: 0,
      precipitationProbabilityMax: 0,
      uvIndexMax: 0,
      sunriseIso: '',
      sunsetIso: '',
      weatherCode: 0,
      weatherLabel: 'Unknown',
      emoji: '🌡',
      hours: Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        tempC: 0,
        precipitationMm: 0,
        precipitationProbability: 0,
        weatherCode: 0,
        weatherLabel: 'Unknown',
        emoji: '🌡',
      })),
      isForecastAvailable: false,
    }));
    return fallbacks;
  }

  const dayIndexByDate = new Map<string, number>();
  daily.time.forEach((t, i) => {
    const datePart = t.includes('T') ? t.slice(0, 10) : t;
    dayIndexByDate.set(datePart, i);
  });

  const hourlyTime = hourly.time ?? [];
  const hourlyTemp = hourly.temperature_2m ?? [];
  const hourlyPrecip = hourly.precipitation ?? [];
  const hourlyPrecipProb = hourly.precipitation_probability ?? [];
  const hourlyCode = hourly.weathercode ?? [];

  const result: WeatherDay[] = dates.map((date) => {
    const beyond = isBeyondWindow(date);
    const idx = dayIndexByDate.get(date);
    if (beyond || idx === undefined) {
      return {
        date,
        location,
        locationIsFallback,
        tempMinC: 0,
        tempMaxC: 0,
        precipitationMm: 0,
        precipitationProbabilityMax: 0,
        uvIndexMax: 0,
        sunriseIso: '',
        sunsetIso: '',
        weatherCode: 0,
        weatherLabel: 'Unknown',
        emoji: '🌡',
        hours: Array.from({ length: 24 }, (_, h) => ({
          hour: h,
          tempC: 0,
          precipitationMm: 0,
          precipitationProbability: 0,
          weatherCode: 0,
          weatherLabel: 'Unknown',
          emoji: '🌡',
        })),
        isForecastAvailable: false,
      };
    }

    const sunriseIso = daily.sunrise?.[idx] ?? '';
    const sunsetIso = daily.sunset?.[idx] ?? '';
    const weatherCode = daily.weathercode?.[idx] ?? 0;
    const { label: weatherLabel, emoji } = wmoToLabelEmoji(weatherCode);

    const dayHourStart = hourlyTime.findIndex((t) => (t.includes('T') ? t.slice(0, 10) : t) === date);
    const hours: WeatherHour[] = Array.from({ length: 24 }, (_, h) => {
      const i = dayHourStart >= 0 ? dayHourStart + h : h;
      const code = hourlyCode[i] ?? 0;
      const he = wmoToLabelEmoji(code);
      return {
        hour: h,
        tempC: hourlyTemp[i] ?? 0,
        precipitationMm: hourlyPrecip[i] ?? 0,
        precipitationProbability: hourlyPrecipProb[i] ?? 0,
        weatherCode: code,
        weatherLabel: he.label,
        emoji: he.emoji,
      };
    });

    return {
      date,
      location,
      locationIsFallback,
      tempMinC: daily.temperature_2m_min?.[idx] ?? 0,
      tempMaxC: daily.temperature_2m_max?.[idx] ?? 0,
      precipitationMm: daily.precipitation_sum?.[idx] ?? 0,
      precipitationProbabilityMax: daily.precipitation_probability_max?.[idx] ?? 0,
      uvIndexMax: daily.uv_index_max?.[idx] ?? 0,
      sunriseIso,
      sunsetIso,
      weatherCode,
      weatherLabel,
      emoji,
      hours,
      isForecastAvailable: true,
    };
  });

  weatherCache.set(cacheKey, result);
  return result;
}

export function convertTemp(celsius: number, unit: TempUnit): number {
  if (unit === 'F') return (celsius * 9) / 5 + 32;
  return celsius;
}

export function formatTemp(celsius: number, unit: TempUnit): string {
  const value = convertTemp(celsius, unit);
  const rounded = Math.round(value);
  return unit === 'F' ? `${rounded}°F` : `${rounded}°C`;
}

export function useWeatherForTrip(
  trip: Trip | null | undefined,
  hookOptions?: { onRequestLog?: (entry: WeatherRequestLog) => void }
): {
  weatherByDate: Map<string, WeatherDay[]>;
  loading: boolean;
  refetch: () => void;
} {
  const [weatherByDate, setWeatherByDate] = React.useState<Map<string, WeatherDay[]>>(new Map());
  const [loading, setLoading] = React.useState(false);
  const [refetchTrigger, setRefetchTrigger] = React.useState(0);
  const onRequestLogRef = React.useRef(hookOptions?.onRequestLog);
  onRequestLogRef.current = hookOptions?.onRequestLog;

  const refetch = React.useCallback(() => {
    clearWeatherCaches();
    setRefetchTrigger((t) => t + 1);
  }, []);

  React.useEffect(() => {
    if (!trip?.id) {
      setWeatherByDate(new Map());
      setLoading(false);
      return;
    }

    const dates: string[] = [];
    try {
      const start = new Date(trip.startDate + 'T12:00:00Z');
      const end = new Date(trip.endDate + 'T12:00:00Z');
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().slice(0, 10));
      }
    } catch {
      setWeatherByDate(new Map());
      setLoading(false);
      return;
    }

    // Build (location -> dates[]) using day locations only; no trip.name fallback.
    const locationDates = new Map<string, string[]>();
    for (const date of dates) {
      const locs = getEffectiveDayLocations(
        trip.itinerary?.[date],
        trip.dayLocations?.[date]
      );
      for (const loc of locs) {
        const key = loc.trim();
        if (!key) continue;
        const arr = locationDates.get(key) ?? [];
        arr.push(date);
        locationDates.set(key, arr);
      }
    }

    const locationIsFallback = false; // we no longer use trip.name fallback
    setLoading(true);
    const onLog = (entry: WeatherRequestLog) => onRequestLogRef.current?.(entry);
    const entries = Array.from(locationDates.entries()).map(([loc, dateList]) =>
      fetchWeatherForDates(
        {
          location: loc,
          locationIsFallback,
          dates: dateList,
        },
        { onLog }
      )
    );

    if (entries.length === 0) {
      setWeatherByDate(new Map());
      setLoading(false);
      return;
    }

    Promise.all(entries)
      .then((results) => {
        const map = new Map<string, WeatherDay[]>();
        for (const day of results.flat()) {
          const arr = map.get(day.date) ?? [];
          arr.push(day);
          map.set(day.date, arr);
        }
        setWeatherByDate(map);
      })
      .catch(() => {
        setWeatherByDate(new Map());
      })
      .finally(() => {
        setLoading(false);
      });
  }, [
    trip?.id,
    trip?.startDate,
    trip?.endDate,
    trip?.itinerary,
    trip?.dayLocations,
    refetchTrigger,
  ]);

  return { weatherByDate, loading, refetch };
}
