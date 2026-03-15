import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { resolvePlaceId, fetchPlaceDetails, generateProsCons } from '../lib/places';
import { logEvent } from '../lib/amplitude';
import type { PlaceDetails, PlaceProsCons } from '../lib/places';

export interface ActivityReviewsProps {
  activityTitle: string;
  activityLocation: string | undefined;
  onClose: () => void;
}

const ActivityReviews: React.FC<ActivityReviewsProps> = ({
  activityTitle,
  activityLocation,
  onClose,
}) => {
  const [step, setStep] = useState<'resolve' | 'details' | 'done' | 'error'>('resolve');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [details, setDetails] = useState<PlaceDetails | null>(null);
  const [prosCons, setProsCons] = useState<PlaceProsCons | null>(null);
  const [prosConsLoading, setProsConsLoading] = useState(false);

  const location = activityLocation ?? activityTitle;

  useEffect(() => {
    logEvent('Activity Reviews Opened', { activity_title: activityTitle, has_location: Boolean(activityLocation) });
  }, [activityTitle, activityLocation]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const placeId = await resolvePlaceId(activityTitle, location);
        if (cancelled) return;
        if (!placeId) {
          setStep('error');
          setErrorMessage('No Google Places data found for this activity.');
          logEvent('Activity Reviews Failed', { activity_title: activityTitle, step: 'resolve' });
          return;
        }

        const d = await fetchPlaceDetails(placeId);
        if (cancelled) return;
        setDetails(d);
        setStep('done');
        logEvent('Activity Reviews Loaded', { place_name: d.name, rating: d.rating ?? undefined, review_count: d.ratingCount ?? undefined });

        setProsConsLoading(true);
        generateProsCons(d.name, d.reviews, placeId)
          .then((pc) => { if (!cancelled) setProsCons(pc); })
          .catch(() => { /* hide pros/cons on failure */ })
          .finally(() => { if (!cancelled) setProsConsLoading(false); });
      } catch (e) {
        if (cancelled) return;
        setStep('error');
        setErrorMessage(e instanceof Error ? e.message : 'Failed to load reviews');
        logEvent('Activity Reviews Failed', { activity_title: activityTitle, step: 'details' });
      }
    })();

    return () => { cancelled = true; };
  }, [activityTitle, location]);

  if (step === 'resolve' || (step === 'done' && !details)) {
    return (
      <div style={{ padding: '1rem', minWidth: '320px', maxWidth: '420px', background: 'var(--surface-color)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>📋 Reviews</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <Loader2 size={28} className="spin" style={{ color: 'var(--primary-color)' }} />
        </div>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div style={{ padding: '1rem', minWidth: '320px', background: 'var(--surface-color)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>📋 Reviews</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">×</button>
        </div>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{errorMessage}</p>
      </div>
    );
  }

  const d = details!;

  return (
    <div style={{ padding: '1rem', minWidth: '320px', maxWidth: '420px', background: 'var(--surface-color)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', maxHeight: '80vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>📋 Reviews</h3>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{d.name}</div>
      {(d.rating != null || d.ratingCount != null) && (
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
          ⭐ {d.rating?.toFixed(1) ?? '—'} {d.ratingCount != null ? `(${d.ratingCount.toLocaleString()} reviews)` : ''}
        </div>
      )}

      <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.75rem 0' }} />

      <div style={{ fontSize: '0.85rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>📋 Overview</div>
        {d.reviewSummary && <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{d.reviewSummary}</p>}
        {d.reviewSummaryDisclosure && <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{d.reviewSummaryDisclosure}</p>}
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.75rem 0' }} />

      {(prosConsLoading || prosCons) && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>✅ Pros</div>
              {prosConsLoading && !prosCons && <Loader2 size={14} className="spin" />}
              {prosCons?.pros.map((p, i) => <div key={i} style={{ color: 'var(--text-secondary)' }}>• {p}</div>)}
            </div>
            <div>
              <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>❌ Cons</div>
              {prosConsLoading && !prosCons && <Loader2 size={14} className="spin" />}
              {prosCons?.cons.map((c, i) => <div key={i} style={{ color: 'var(--text-secondary)' }}>• {c}</div>)}
            </div>
          </div>
          {prosCons?.verdict && <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>💬 {prosCons.verdict}</p>}
          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.75rem 0' }} />
        </>
      )}

      <div style={{ fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.85rem' }}>💬 Recent Reviews</div>
      {d.reviews.slice(0, 5).map((r, i) => (
        <div key={i} style={{ marginBottom: '0.6rem', padding: '0.5rem', background: 'var(--bg-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
          <div style={{ color: 'var(--text-tertiary)' }}>{r.authorName} · {r.relativeTime} · {r.rating}★</div>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{r.text}</p>
        </div>
      ))}

      <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
        Powered by Google
        {d.reviewsUri && (
          <a href={d.reviewsUri} target="_blank" rel="noopener noreferrer" style={{ marginLeft: '0.5rem', color: 'var(--primary-color)' }}>
            See all reviews →
          </a>
        )}
      </div>
    </div>
  );
};

export default ActivityReviews;
