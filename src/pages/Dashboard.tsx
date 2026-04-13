// Purpose: Dashboard landing page — shows the last-viewed trip hero, AI preview, other trips strip, and quick links.

import { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  Map,
  Wallet,
  StickyNote,
  Backpack,
  CloudSun,
  Upload,
  Bot,
  Calendar,
  Table,
  ArrowRight,
  Send,
  MessageSquare,
} from 'lucide-react';

import { useTrips, useActivities, useChatHistory } from '../lib/store';
import { getLastContext } from '../lib/lastContext';
import { getDefaultDayDateStr } from '../lib/tripDefaultDay';
import type { Trip, Activity, ChatMessage } from '../lib/types';

import styles from './Dashboard.module.css';

/* ── Helpers ── */

function formatTripRange(trip: Trip): string {
  try {
    const start = format(parseISO(trip.startDate), 'MMM d');
    const end = format(parseISO(trip.endDate), 'MMM d, yyyy');
    return `${start} – ${end}`;
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

interface HeroProps {
  trip: Trip;
  activities: Activity[];
}

function HeroSection({ trip, activities }: HeroProps): JSX.Element {
  const navigate = useNavigate();
  const focusDate = getDefaultDayDateStr(trip);

  const dayActivities = useMemo(
    () =>
      activities
        .filter((a) => a.tripId === trip.id && a.date === focusDate)
        .sort((a, b) => a.order - b.order),
    [activities, trip.id, focusDate],
  );

  const nextActivity = dayActivities[0];

  return (
    <div
      className={`${styles.heroCard} ${styles.section}`}
      style={trip.color ? { borderLeftColor: trip.color } : undefined}
    >
      <div className={styles.heroHeader}>
        <h2 className={styles.heroTripName}>{trip.name}</h2>
        <span className={styles.heroDates}>{formatTripRange(trip)}</span>
      </div>

      <div className={styles.heroMeta}>
        <span>{dayActivities.length} activit{dayActivities.length === 1 ? 'y' : 'ies'} on {format(parseISO(focusDate), 'MMM d')}</span>
      </div>

      {nextActivity && (
        <span className={styles.heroNextActivity}>
          Next up: {nextActivity.time ? `${nextActivity.time} — ` : ''}{nextActivity.title}
        </span>
      )}

      <button
        className={styles.heroCta}
        onClick={() => navigate(`/trip/${trip.id}/day/${focusDate}`)}
        type="button"
      >
        Continue planning
        <ArrowRight size={18} />
      </button>

      <div className={styles.heroSecondary}>
        <Link to="/spreadsheet" className={styles.heroSecondaryLink}>
          <Table size={16} /> Spreadsheet
        </Link>
        <Link to="/calendar" className={styles.heroSecondaryLink}>
          <Calendar size={16} /> Calendar
        </Link>
      </div>
    </div>
  );
}

interface AiPreviewProps {
  tripId: string;
}

function AiPreviewSection({ tripId }: AiPreviewProps): JSX.Element {
  const { messages } = useChatHistory(tripId);
  const [draft, setDraft] = useState('');
  const navigate = useNavigate();

  const lastMessages: ChatMessage[] = useMemo(() => {
    if (messages.length === 0) return [];
    const tail = messages.slice(-2);
    return tail;
  }, [messages]);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    navigate('/assistant');
  };

  return (
    <div className={`${styles.aiPreview} ${styles.section}`}>
      <div className={styles.aiHeader}>
        <Bot size={16} />
        <span>AI Assistant</span>
      </div>

      {lastMessages.length > 0 ? (
        <div className={styles.aiBubbles}>
          {lastMessages.map((msg) => (
            <div
              key={msg.id}
              className={msg.role === 'user' ? styles.aiBubbleUser : styles.aiBubbleModel}
            >
              {msg.content}
            </div>
          ))}
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

      <Link to="/assistant" className={styles.aiFullLink}>
        Open full assistant <ArrowRight size={14} style={{ verticalAlign: 'middle' }} />
      </Link>
    </div>
  );
}

interface TripStripProps {
  trips: Trip[];
}

function OtherTripsStrip({ trips }: TripStripProps): JSX.Element | null {
  const navigate = useNavigate();

  if (trips.length === 0) return null;

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Other trips</h3>
      <div className={styles.tripStrip}>
        {trips.map((trip) => {
          const defaultDate = getDefaultDayDateStr(trip);
          return (
            <div
              key={trip.id}
              className={styles.tripCard}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/trip/${trip.id}/day/${defaultDate}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(`/trip/${trip.id}/day/${defaultDate}`);
                }
              }}
            >
              <div className={styles.tripCardHeader}>
                <span
                  className={styles.tripColorDot}
                  style={{ backgroundColor: trip.color ?? 'var(--primary-color)' }}
                />
                <span className={styles.tripCardName}>{trip.name}</span>
              </div>
              <span className={styles.tripCardDates}>{formatTripRange(trip)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const QUICK_LINKS: { to: string; icon: React.ElementType; label: string }[] = [
  { to: '/transportation', icon: Map, label: 'Transportation' },
  { to: '/budget', icon: Wallet, label: 'Budget' },
  { to: '/notes', icon: StickyNote, label: 'Notes' },
  { to: '/packing', icon: Backpack, label: 'Packing' },
  { to: '/weather', icon: CloudSun, label: 'Weather' },
  { to: '/import', icon: Upload, label: 'Import' },
];

function QuickLinksGrid(): JSX.Element {
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Quick links</h3>
      <div className={styles.quickLinks}>
        {QUICK_LINKS.map(({ to, icon: Icon, label }) => (
          <Link key={to} to={to} className={styles.quickLinkCard}>
            <Icon size={20} className={styles.quickLinkIcon} />
            <span className={styles.quickLinkLabel}>{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function EmptyState(): JSX.Element {
  return (
    <div className={`${styles.emptyState} ${styles.section}`}>
      <MessageSquare size={48} className={styles.emptyIcon} />
      <h2 className={styles.emptyTitle}>No trips yet</h2>
      <p className={styles.emptySubtitle}>Create your first trip to get started</p>
      <Link to="/spreadsheet" className={styles.emptyLink}>
        Create a trip
        <ArrowRight size={18} />
      </Link>
    </div>
  );
}

/* ── Page component ── */

export default function Dashboard(): JSX.Element {
  const { trips, loading: tripsLoading } = useTrips();
  const { activities, loading: activitiesLoading } = useActivities();

  const heroTrip = useMemo(() => pickHeroTrip(trips), [trips]);
  const otherTrips = useMemo(
    () => (heroTrip ? trips.filter((t) => t.id !== heroTrip.id) : []),
    [trips, heroTrip],
  );

  if (tripsLoading || activitiesLoading) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (!heroTrip) {
    return (
      <div className={styles.dashboard}>
        <EmptyState />
        <QuickLinksGrid />
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <HeroSection trip={heroTrip} activities={activities} />
      <AiPreviewSection tripId={heroTrip.id} />
      <OtherTripsStrip trips={otherTrips} />
      <QuickLinksGrid />
    </div>
  );
}
