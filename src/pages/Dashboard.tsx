// Purpose: Dashboard landing page — Sakura Mist redesign with hero, journey timeline, AI preview, and quick links.

import { useMemo, useState, type ReactElement } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { format, parseISO, differenceInDays } from 'date-fns';
import { Send, ArrowRight, MessageSquare } from 'lucide-react';
import { useTrips, useActivities, useChatHistory } from '../lib/store';
import { getLastContext } from '../lib/lastContext';
import { getDefaultDayDateStr } from '../lib/tripDefaultDay';
import { deriveDashboardJourney } from '../lib/dashboard-journey';
import type { Trip, ChatMessage } from '../lib/types';
import type { DashboardJourneyStop } from '../lib/dashboard-journey';
import { PageTransition, StaggerGroup, SakuraSkeleton } from '../components/ui/animations';
import styles from './Dashboard.module.css';

/* ── Helpers ── */

function formatTripRange(trip: Trip): string {
  try {
    const start = format(parseISO(trip.startDate), 'MMM d');
    const end = format(parseISO(trip.endDate), 'MMM d, yyyy');
    const days = differenceInDays(parseISO(trip.endDate), parseISO(trip.startDate)) + 1;
    return `${start} – ${end} · ${days} days`;
  } catch {
    return `${trip.startDate} – ${trip.endDate}`;
  }
}

function pickHeroTrip(trips: Trip[]): Trip | undefined {
  if (trips.length === 0) return undefined;
  const ctx = getLastContext();
  if (ctx) {
    const match = trips.find((t) => t.id === ctx.tripId);
    if (match) return match;
  }
  return trips[0];
}

/* ── Sub-components ── */

function HeroSection({ trip, cityCount }: { trip: Trip; cityCount: number }): ReactElement {
  const navigate = useNavigate();
  const focusDate = getDefaultDayDateStr(trip);
  const days = differenceInDays(parseISO(trip.endDate), parseISO(trip.startDate)) + 1;
  const travelers = trip.members.length;

  return (
    <div className={styles.heroCard}>
      <div className={styles.heroEmoji}>🌍</div>
      <h1 className={`${styles.heroTripName} font-display`}>{trip.name}</h1>
      <span className={styles.heroDates}>{formatTripRange(trip)}</span>

      <div className={styles.heroStats}>
        <div className={styles.heroStat}>
          <span className={styles.heroStatNumber}>{cityCount}</span>
          <span className={styles.heroStatLabel}>CITIES</span>
        </div>
        <div className={styles.heroStat}>
          <span className={styles.heroStatNumber}>{days}</span>
          <span className={styles.heroStatLabel}>DAYS</span>
        </div>
        <div className={styles.heroStat}>
          <span className={styles.heroStatNumber}>{travelers}</span>
          <span className={styles.heroStatLabel}>TRAVELERS</span>
        </div>
      </div>

      <button
        className={styles.heroCta}
        onClick={() => navigate(`/trip/${trip.id}/day/${focusDate}`)}
        type="button"
      >
        Continue Planning →
      </button>
    </div>
  );
}

interface OtherTripsStripProps {
  trips: Trip[];
}

function OtherTripsStrip({ trips }: OtherTripsStripProps): ReactElement | null {
  const navigate = useNavigate();
  if (trips.length === 0) return null;

  return (
    <div className={styles.otherTripsSection}>
      <h3 className={styles.sectionTitle}>Other trips</h3>
      <div className={styles.otherTripsList}>
        {trips.map((t) => {
          const focusDate = getDefaultDayDateStr(t);
          return (
            <button
              key={t.id}
              type="button"
              className={styles.otherTripCard}
              onClick={() => navigate(`/trip/${t.id}/day/${focusDate}`)}
            >
              <span className={styles.otherTripName}>{t.name}</span>
              <span className={styles.otherTripRange}>{formatTripRange(t)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function JourneyTimeline({ stops }: { stops: DashboardJourneyStop[] }): ReactElement {
  if (stops.length === 0) {
    return (
      <div className={styles.journeySection}>
        <h2 className={`${styles.journeySectionTitle} font-display`}>Your Journey</h2>
        <p className={styles.journeyEmpty}>
          No cities to show yet — set each day&apos;s location in your itinerary, or add activities other than
          accommodation.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.journeySection}>
      <h2 className={`${styles.journeySectionTitle} font-display`}>Your Journey</h2>
      <div className={styles.timeline}>
        {stops.map((stop, i) => (
          <div key={`${stop.location}-${stop.dateLabel}-${i}`} className={styles.timelineItem}>
            <div className={styles.timelineMarker}>
              <span className={styles.timelineEmoji}>{stop.emoji}</span>
            </div>
            <div className={styles.timelineContent}>
              <span className={styles.timelineCity}>{stop.location}</span>
              <span className={styles.timelineDate}>{stop.dateLabel}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AiPreviewSection({ tripId }: { tripId: string }): ReactElement {
  const { messages } = useChatHistory(tripId);
  const [draft, setDraft] = useState('');
  const navigate = useNavigate();

  const lastModelMessage: ChatMessage | undefined = useMemo(() => {
    return [...messages].reverse().find((m) => m.role === 'model');
  }, [messages]);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    const text = draft.trim();
    navigate('/assistant', {
      state: {
        initialPrompt: text,
        tripId,
        autoSend: text.length > 0,
      },
    });
    setDraft('');
  };

  return (
    <div className={styles.aiPreview}>
      <div className={styles.aiHeader}>
        <span>✨</span>
        <span className={styles.aiTitle}>AI Assistant</span>
      </div>

      {lastModelMessage ? (
        <div className={styles.aiQuote}>
          &ldquo;{lastModelMessage.content.length > 200
            ? lastModelMessage.content.slice(0, 200) + '…'
            : lastModelMessage.content}&rdquo;
        </div>
      ) : (
        <p className={styles.aiEmptyText}>Ask anything about your trip</p>
      )}

      <form className={styles.aiInputRow} onSubmit={handleSubmit}>
        <input
          className={styles.aiInput}
          type="text"
          placeholder="Ask about your trip…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className={styles.aiSendBtn} type="submit" aria-label="Open assistant">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}

/* ── Quick Links ── */

const QUICK_LINKS: { to: string; emoji: string; label: string; subtitle: string }[] = [
  { to: '/transportation', emoji: '🚆', label: 'Transportation', subtitle: 'Routes & passes' },
  { to: '/budget', emoji: '💰', label: 'Budget', subtitle: 'Track spending' },
  { to: '/notes', emoji: '📝', label: 'Notes', subtitle: 'Trip notes' },
  { to: '/packing', emoji: '🎒', label: 'Packing', subtitle: 'Checklist' },
  { to: '/weather', emoji: '⛅', label: 'Weather', subtitle: 'Forecasts' },
  { to: '/import', emoji: '📥', label: 'Import', subtitle: 'Add activities' },
];

function QuickLinksGrid(): ReactElement {
  return (
    <div>
      <h3 className={styles.sectionTitle}>QUICK LINKS</h3>
      <div className={styles.quickLinks}>
        {QUICK_LINKS.map(({ to, emoji, label, subtitle }) => (
          <Link key={to} to={to} className={styles.quickLinkCard}>
            <span className={styles.quickLinkEmoji}>{emoji}</span>
            <div className={styles.quickLinkText}>
              <span className={styles.quickLinkLabel}>{label}</span>
              <span className={styles.quickLinkSubtitle}>{subtitle}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── Skeleton / Loading ── */

function DashboardSkeleton(): ReactElement {
  return (
    <div className={`${styles.dashboard} font-body`}>
      <div className={styles.dashboardGrid}>
        <div className={styles.tripColumn}>
          <div className={styles.skeletonHero}>
            <SakuraSkeleton width={48} height={48} rounded="full" />
            <SakuraSkeleton width="60%" height="2rem" />
            <SakuraSkeleton width="50%" height="1rem" />
            <div className={styles.heroStats}>
              <SakuraSkeleton width={80} height={48} rounded="0.75rem" />
              <SakuraSkeleton width={80} height={48} rounded="0.75rem" />
              <SakuraSkeleton width={80} height={48} rounded="0.75rem" />
            </div>
            <SakuraSkeleton height={48} rounded="var(--radius-full, 9999px)" />
          </div>
        </div>
        <div className={styles.mainColumn}>
          <div className={styles.skeletonAi}>
            <SakuraSkeleton width="45%" height="1.25rem" />
            <SakuraSkeleton width="100%" height="4rem" rounded="var(--radius-md)" />
            <SakuraSkeleton height={44} rounded="9999px" />
          </div>
          <SakuraSkeleton width="40%" height="1.5rem" />
          <div className={styles.quickLinks}>
            <SakuraSkeleton height={72} rounded="var(--radius-lg)" />
            <SakuraSkeleton height={72} rounded="var(--radius-lg)" />
          </div>
          <SakuraSkeleton width="35%" height="1.5rem" />
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.skeletonTimelineRow}>
              <SakuraSkeleton width={32} height={32} rounded="full" />
              <div className={styles.skeletonTimelineText}>
                <SakuraSkeleton width="60%" height="1rem" />
                <SakuraSkeleton width="30%" height="0.75rem" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Empty state ── */

function EmptyState(): ReactElement {
  return (
    <div className={styles.emptyState}>
      <MessageSquare size={48} className={styles.emptyIcon} />
      <h2 className={`${styles.emptyTitle} font-display`}>No trips yet</h2>
      <p className={styles.emptySubtitle}>Create your first trip to get started</p>
      <Link to="/spreadsheet" className={styles.emptyLink}>
        Create a trip <ArrowRight size={18} />
      </Link>
    </div>
  );
}

/* ── Page component ── */

export default function Dashboard(): ReactElement {
  const { trips, loading: tripsLoading } = useTrips();
  const { activities, loading: activitiesLoading } = useActivities();

  const heroTrip = useMemo(() => pickHeroTrip(trips), [trips]);

  const otherTrips = useMemo(
    () => (heroTrip ? trips.filter((t) => t.id !== heroTrip.id) : []),
    [trips, heroTrip],
  );

  const { stops: journeyStops, cityCount } = useMemo(
    () => (heroTrip ? deriveDashboardJourney(heroTrip, activities) : { stops: [], cityCount: 0 }),
    [heroTrip, activities],
  );

  if (tripsLoading || activitiesLoading) {
    return <DashboardSkeleton />;
  }

  if (!heroTrip) {
    return (
      <PageTransition>
        <div className={`${styles.dashboard} font-body`}>
          <EmptyState />
          <QuickLinksGrid />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className={`${styles.dashboard} font-body`}>
        <div className={styles.dashboardGrid}>
          <aside className={styles.tripColumn}>
            <StaggerGroup baseDelay={200} stagger={120}>
              <HeroSection trip={heroTrip} cityCount={cityCount} />
              <OtherTripsStrip trips={otherTrips} />
            </StaggerGroup>
          </aside>
          <div className={styles.mainColumn}>
            <StaggerGroup baseDelay={280} stagger={100} className={styles.mainStack}>
              <AiPreviewSection tripId={heroTrip.id} />
              <QuickLinksGrid />
              <JourneyTimeline stops={journeyStops} />
            </StaggerGroup>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
