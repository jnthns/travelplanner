import React, { useState } from 'react';
import { Info } from 'lucide-react';
import type { WeatherDay, TempUnit } from '../lib/weather';
import { formatTemp } from '../lib/weather';

export interface WeatherBadgeProps {
  day: WeatherDay | undefined;
  hasLocation: boolean;
  loading: boolean;
  tempUnit: TempUnit;
  compact?: boolean;
}

const WeatherBadge: React.FC<WeatherBadgeProps> = ({
  day,
  hasLocation,
  loading,
  tempUnit,
  compact = false,
}) => {
  const [tooltipVisible, setTooltipVisible] = useState(false);

  if (loading) {
    return (
      <span
        style={{
          display: 'inline-block',
          width: '60px',
          height: '20px',
          borderRadius: 'var(--radius-full)',
          background: 'var(--border-light)',
          animation: 'weather-shimmer 1.5s ease-in-out infinite',
        }}
        aria-hidden
      />
    );
  }

  if (!hasLocation) {
    return (
      <span
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          gap: compact ? 0 : '2px',
          border: '1px dashed var(--border-color)',
          background: 'transparent',
          color: 'var(--text-tertiary)',
          borderRadius: 'var(--radius-full)',
          padding: compact ? '2px 5px' : '2px 6px',
        }}
        onMouseEnter={() => setTooltipVisible(true)}
        onMouseLeave={() => setTooltipVisible(false)}
        onFocus={() => setTooltipVisible(true)}
        onBlur={() => setTooltipVisible(false)}
        tabIndex={0}
        role="img"
        aria-label="Add a location to this day to see weather"
      >
        <Info size={compact ? 10 : 12} />
        {!compact && <span>?</span>}
        {tooltipVisible && (
          <div
            role="tooltip"
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '4px',
              zIndex: 10,
              background: 'var(--surface-color)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-md)',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              padding: '0.4rem 0.6rem',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            Add a location to this day to see weather
          </div>
        )}
      </span>
    );
  }

  if (day === undefined || !day.isForecastAvailable) {
    return null;
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px',
        background: 'color-mix(in srgb, var(--primary-color) 8%, transparent)',
        border: '1px solid color-mix(in srgb, var(--primary-color) 30%, transparent)',
        borderRadius: 'var(--radius-full)',
        padding: compact ? '1px 5px' : '2px 8px',
        fontSize: compact ? '0.7rem' : '0.75rem',
        color: 'var(--text-primary)',
      }}
    >
      <span>{day.emoji}</span>
      <span>
        {formatTemp(day.tempMinC, tempUnit)}–{formatTemp(day.tempMaxC, tempUnit)}
      </span>
    </span>
  );
};

export default WeatherBadge;
