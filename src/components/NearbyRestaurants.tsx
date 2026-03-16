import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchNearbyPlaces } from '../lib/places';
import { logEvent } from '../lib/amplitude';
import type { PlaceResult } from '../lib/places';

function formatPlacesAsNote(places: PlaceResult[]): string {
  const heading = '**Nearby places**';
  const lines = places.map((p) => {
    const ratingPart = p.rating != null
      ? `${p.rating.toFixed(1)}${p.ratingCount != null ? ` (${p.ratingCount.toLocaleString()} reviews)` : ''}`
      : '';
    const parts = [`**${p.name}**`, p.primaryType ? `(${p.primaryType})` : '', ratingPart, p.address].filter(Boolean);
    return `- ${parts.join(' — ')}`;
  });
  return [heading, '', ...lines].join('\n');
}

export interface NearbyRestaurantsProps {
  location: string;
  category?: string;
  title?: string;
  label: string;
  onClose: () => void;
  onAddToNote?: (formattedText: string) => void;
}

const NearbyRestaurants: React.FC<NearbyRestaurantsProps> = ({ location, category, title, label, onClose, onAddToNote }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [places, setPlaces] = useState<PlaceResult[]>([]);

  useEffect(() => {
    logEvent('Nearby Places Opened', { location, category, label });
    setLoading(true);
    setError(null);
    fetchNearbyPlaces(location, category, title)
      .then(setPlaces)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load places'))
      .finally(() => setLoading(false));
  }, [location, category, title, label]);

  return (
    <div
      style={{
        background: 'var(--surface-color)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-md)',
        padding: '1rem',
        minWidth: '280px',
        maxWidth: '360px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>{label}</h3>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <Loader2 size={24} className="spin" style={{ color: 'var(--primary-color)' }} />
        </div>
      )}

      {error && (
        <p style={{ color: 'var(--error-color)', fontSize: '0.9rem', margin: 0 }}>{error}</p>
      )}

      {!loading && !error && places.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {places.map((p) => (
            <li
              key={p.id}
              style={{
                padding: '0.6rem 0',
                borderBottom: '1px solid var(--border-color)',
                cursor: 'pointer',
              }}
              onClick={() => logEvent('Nearby Places Result Clicked', { place_name: p.name, rating: p.rating ?? undefined, category, label })}
              onKeyDown={(e) => e.key === 'Enter' && logEvent('Nearby Places Result Clicked', { place_name: p.name, rating: p.rating ?? undefined, category, label })}
              role="button"
              tabIndex={0}
            >
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
              {p.primaryType && <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>{p.primaryType}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{p.priceLevel}</span>
                {p.rating != null && (
                  <span style={{ fontSize: '0.8rem' }}>⭐ {p.rating.toFixed(1)}{p.ratingCount != null ? ` (${p.ratingCount.toLocaleString()})` : ''}</span>
                )}
                {p.isOpenNow != null && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.1rem 0.4rem',
                      borderRadius: 'var(--radius-sm)',
                      background: p.isOpenNow ? 'color-mix(in srgb, var(--secondary-color) 20%, transparent)' : 'var(--border-light)',
                      color: p.isOpenNow ? 'var(--secondary-color)' : 'var(--text-tertiary)',
                    }}
                  >
                    {p.isOpenNow ? 'Open now' : 'Closed'}
                  </span>
                )}
              </div>
              {p.address && <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.2rem' }}>{p.address}</div>}
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && places.length === 0 && (
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', margin: 0 }}>No {label.toLowerCase()} found for this location.</p>
      )}

      {!loading && !error && places.length > 0 && onAddToNote && (
        <div style={{ marginTop: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              const text = formatPlacesAsNote(places);
              onAddToNote(text);
              logEvent('Nearby Places Added To Note', { count: places.length, category, label });
              onClose();
            }}
          >
            Add to activity note
          </button>
        </div>
      )}

      {!loading && (
        <p style={{ marginTop: '0.75rem', marginBottom: 0, fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
          Powered by Google
        </p>
      )}
    </div>
  );
};

export default NearbyRestaurants;
