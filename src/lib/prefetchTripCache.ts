import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Warms the Firestore persistent cache for a trip so day/calendar views can
 * often load offline after the user was online with this trip selected.
 */
export async function prefetchTripDocumentsForOfflineCache(tripId: string): Promise<void> {
    if (!tripId) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    try {
        await Promise.all([
            getDoc(doc(db, 'trips', tripId)),
            getDocs(query(collection(db, 'activities'), where('tripId', '==', tripId))),
            getDocs(query(collection(db, 'transportRoutes'), where('tripId', '==', tripId))),
        ]);
    } catch (e) {
        console.warn('[prefetchTripDocumentsForOfflineCache]', e);
    }
}
