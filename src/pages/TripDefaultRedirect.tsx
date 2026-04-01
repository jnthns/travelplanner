import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTrips } from '../lib/store';
import { getDefaultDayDateStr } from '../lib/tripDefaultDay';

/** Redirects /trip/:tripId → /trip/:tripId/day/:defaultDate */
const TripDefaultRedirect: React.FC = () => {
    const { tripId } = useParams<{ tripId: string }>();
    const { trips, loading } = useTrips();

    if (!tripId) {
        return <Navigate to="/spreadsheet" replace />;
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <Loader2 size={28} className="spin" style={{ color: 'var(--primary-color)' }} />
            </div>
        );
    }

    const trip = trips.find((t) => t.id === tripId);
    if (!trip) {
        return <Navigate to="/spreadsheet" replace />;
    }

    const dateStr = getDefaultDayDateStr(trip);
    return <Navigate to={`/trip/${tripId}/day/${dateStr}`} replace />;
};

export default TripDefaultRedirect;
