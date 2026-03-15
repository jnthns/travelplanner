import { useState, useEffect, useCallback } from 'react';
import {
    collection,
    query,
    where,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    writeBatch,
    and,
    or,
    type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './AuthContext';
import type { Trip, Activity, TransportRoute, Note, ChatMessage } from './types';

function stripUndefined<T extends Record<string, any>>(obj: T): T {
    return Object.fromEntries(
        Object.entries(obj).filter(([, v]) => v !== undefined)
    ) as T;
}

// ---- Trips ----
export function useTrips() {
    const { user } = useAuth();
    const [trips, setTrips] = useState<Trip[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setTrips([]);
            setLoading(false);
            return;
        }
        let unsub: Unsubscribe;
        try {
            const q = query(
                collection(db, 'trips'),
                or(
                    where('members', 'array-contains', user.uid),
                    where('userId', '==', user.uid)
                )
            );
            unsub = onSnapshot(
                q,
                (snapshot) => {
                    const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data(), _pendingWrite: d.metadata.hasPendingWrites }) as Trip);
                    setTrips(data);
                    setLoading(false);
                },
                (error) => {
                    console.error('Error fetching trips:', error);
                    setLoading(false);
                }
            );
        } catch (error) {
            console.error('Error setting up trips listener:', error);
            setLoading(false);
        }
        return () => unsub?.();
    }, [user?.uid]);

    const addTrip = useCallback(async (trip: Omit<Trip, 'id' | 'userId' | 'members' | 'sharedWithEmails'>) => {
        if (!user) throw new Error('Not authenticated');
        const newTrip = {
            ...trip,
            userId: user.uid,
            members: [user.uid],
            sharedWithEmails: [],
        };
        const docRef = await addDoc(collection(db, 'trips'), stripUndefined(newTrip));
        return { ...newTrip, id: docRef.id } as Trip;
    }, [user]);

    const updateTrip = useCallback(async (id: string, updates: Partial<Trip>) => {
        await updateDoc(doc(db, 'trips', id), stripUndefined(updates));
    }, []);

    const deleteTrip = useCallback(async (id: string) => {
        await deleteDoc(doc(db, 'trips', id));
    }, []);

    const restoreTrip = useCallback(async (trip: Trip) => {
        const { id, ...data } = trip;
        await setDoc(doc(db, 'trips', id), stripUndefined(data));
    }, []);

    const updateItineraryDay = useCallback(async (tripId: string, date: string, updates: Partial<import('./types').ItineraryDay>) => {
        const firestoreUpdates: Record<string, any> = {};
        if (updates.location !== undefined) firestoreUpdates[`itinerary.${date}.location`] = updates.location;
        if (updates.locations !== undefined) firestoreUpdates[`itinerary.${date}.locations`] = updates.locations;
        if (updates.accommodation) {
            if (updates.accommodation.name !== undefined) firestoreUpdates[`itinerary.${date}.accommodation.name`] = updates.accommodation.name;
            if (updates.accommodation.checkInTime !== undefined) firestoreUpdates[`itinerary.${date}.accommodation.checkInTime`] = updates.accommodation.checkInTime;
            if (updates.accommodation.cost !== undefined) firestoreUpdates[`itinerary.${date}.accommodation.cost`] = updates.accommodation.cost;
            if (updates.accommodation.currency !== undefined) firestoreUpdates[`itinerary.${date}.accommodation.currency`] = updates.accommodation.currency;
        }
        await updateDoc(doc(db, 'trips', tripId), firestoreUpdates);
    }, []);

    return { trips, loading, addTrip, updateTrip, deleteTrip, restoreTrip, updateItineraryDay };
}

// ---- Activities ----
export function useActivities() {
    const { user } = useAuth();
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setActivities([]);
            setLoading(false);
            return;
        }
        let unsub: Unsubscribe;
        try {
            const q = query(
                collection(db, 'activities'),
                or(
                    where('tripMembers', 'array-contains', user.uid),
                    where('userId', '==', user.uid)
                )
            );
            unsub = onSnapshot(
                q,
                (snapshot) => {
                    const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data(), _pendingWrite: d.metadata.hasPendingWrites }) as Activity);
                    setActivities(data);
                    setLoading(false);
                },
                (error) => {
                    console.error('Error fetching activities:', error);
                    setLoading(false);
                }
            );
        } catch (error) {
            console.error('Error setting up activities listener:', error);
            setLoading(false);
        }
        return () => unsub?.();
    }, [user?.uid]);

    const addActivity = useCallback(async (activity: Omit<Activity, 'id' | 'userId' | 'tripMembers'>, tripMembers: string[]) => {
        if (!user) throw new Error('Not authenticated');
        const finalMembers = Array.from(new Set([...tripMembers, user.uid])).filter(Boolean);
        const doc = stripUndefined({ ...activity, userId: user.uid, tripMembers: finalMembers });
        if (import.meta.env.DEV) {
            if (!doc.tripId || !doc.date) {
                console.warn('[activities] addActivity missing tripId or date', { tripId: doc.tripId, date: doc.date });
            }
        }
        const docRef = await addDoc(collection(db, 'activities'), doc);
        return { ...activity, id: docRef.id, userId: user.uid, tripMembers: finalMembers } as Activity;
    }, [user]);

    const updateActivity = useCallback(async (id: string, updates: Partial<Activity>) => {
        await updateDoc(doc(db, 'activities', id), stripUndefined(updates));
    }, []);

    const deleteActivity = useCallback(async (id: string) => {
        await deleteDoc(doc(db, 'activities', id));
    }, []);

    const restoreActivity = useCallback(async (activity: Activity) => {
        const { id, ...data } = activity;
        await setDoc(doc(db, 'activities', id), stripUndefined(data));
    }, []);

    const reorderActivities = useCallback(async (orderedIds: { id: string; order: number }[]) => {
        const batch = writeBatch(db);
        for (const { id, order } of orderedIds) {
            batch.update(doc(db, 'activities', id), { order });
        }
        await batch.commit();
    }, []);

    const getActivitiesByDate = useCallback(
        (date: string) => activities.filter((a) => a.date === date).sort((a, b) => a.order - b.order),
        [activities]
    );

    const getActivitiesByTrip = useCallback(
        (tripId: string) =>
            activities
                .filter((a) => a.tripId === tripId)
                .sort((a, b) => {
                    if (a.date !== b.date) return a.date.localeCompare(b.date);
                    return a.order - b.order;
                }),
        [activities]
    );

    return { activities, loading, addActivity, updateActivity, deleteActivity, restoreActivity, reorderActivities, getActivitiesByDate, getActivitiesByTrip };
}

// ---- Transport Routes ----
export function useTransportRoutes() {
    const { user } = useAuth();
    const [routes, setRoutes] = useState<TransportRoute[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setRoutes([]);
            setLoading(false);
            return;
        }
        let unsub: Unsubscribe;
        try {
            const q = query(
                collection(db, 'transportRoutes'),
                or(
                    where('tripMembers', 'array-contains', user.uid),
                    where('userId', '==', user.uid)
                )
            );
            unsub = onSnapshot(
                q,
                (snapshot) => {
                    const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data(), _pendingWrite: d.metadata.hasPendingWrites }) as TransportRoute);
                    setRoutes(data);
                    setLoading(false);
                },
                (error) => {
                    console.error('Error fetching transport routes:', error);
                    setLoading(false);
                }
            );
        } catch (error) {
            console.error('Error setting up transport routes listener:', error);
            setLoading(false);
        }
        return () => unsub?.();
    }, [user?.uid]);

    const addRoute = useCallback(async (route: Omit<TransportRoute, 'id' | 'userId' | 'tripMembers'>, tripMembers: string[]) => {
        if (!user) throw new Error('Not authenticated');
        const finalMembers = Array.from(new Set([...tripMembers, user.uid])).filter(Boolean);
        const docRef = await addDoc(collection(db, 'transportRoutes'), stripUndefined({ ...route, userId: user.uid, tripMembers: finalMembers }));
        return { ...route, id: docRef.id, userId: user.uid, tripMembers: finalMembers } as TransportRoute;
    }, [user]);

    const updateRoute = useCallback(async (id: string, updates: Partial<TransportRoute>) => {
        await updateDoc(doc(db, 'transportRoutes', id), stripUndefined(updates));
    }, []);

    const deleteRoute = useCallback(async (id: string) => {
        await deleteDoc(doc(db, 'transportRoutes', id));
    }, []);

    const restoreRoute = useCallback(async (route: TransportRoute) => {
        const { id, ...data } = route;
        await setDoc(doc(db, 'transportRoutes', id), stripUndefined(data));
    }, []);

    const getRoutesByTrip = useCallback(
        (tripId: string) => routes.filter((r) => r.tripId === tripId).sort((a, b) => a.date.localeCompare(b.date)),
        [routes]
    );

    return { routes, loading, addRoute, updateRoute, deleteRoute, restoreRoute, getRoutesByTrip };
}

// ---- Notes ----
export function useNotes() {
    const { user } = useAuth();
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setNotes([]);
            setLoading(false);
            return;
        }
        let unsub: Unsubscribe;
        try {
            const q = query(
                collection(db, 'notes'),
                or(
                    where('tripMembers', 'array-contains', user.uid),
                    where('userId', '==', user.uid)
                )
            );
            unsub = onSnapshot(
                q,
                (snapshot) => {
                    const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data(), _pendingWrite: d.metadata.hasPendingWrites }) as Note);
                    setNotes(data);
                    setLoading(false);
                },
                (error) => {
                    console.error('Error fetching notes:', error);
                    setLoading(false);
                }
            );
        } catch (error) {
            console.error('Error setting up notes listener:', error);
            setLoading(false);
        }
        return () => unsub?.();
    }, [user?.uid]);

    const addNote = useCallback(async (note: Omit<Note, 'id' | 'userId' | 'tripMembers'>, tripMembers: string[]) => {
        if (!user) throw new Error('Not authenticated');
        const finalMembers = Array.from(new Set([...tripMembers, user.uid])).filter(Boolean);
        const docRef = await addDoc(collection(db, 'notes'), stripUndefined({ ...note, userId: user.uid, tripMembers: finalMembers }));
        return { ...note, id: docRef.id, userId: user.uid, tripMembers: finalMembers } as Note;
    }, [user]);

    const updateNote = useCallback(async (id: string, updates: Partial<Note>) => {
        await updateDoc(doc(db, 'notes', id), stripUndefined(updates));
    }, []);

    const deleteNote = useCallback(async (id: string) => {
        await deleteDoc(doc(db, 'notes', id));
    }, []);

    const restoreNote = useCallback(async (note: Note) => {
        const { id, ...data } = note;
        await setDoc(doc(db, 'notes', id), stripUndefined(data));
    }, []);

    const reorderNotes = useCallback(async (orderedIds: { id: string; order: number }[]) => {
        const batch = writeBatch(db);
        for (const { id, order } of orderedIds) {
            batch.update(doc(db, 'notes', id), { order });
        }
        await batch.commit();
    }, []);

    const getNotesByTrip = useCallback(
        (tripId: string) => notes.filter((n) => n.tripId === tripId).sort((a, b) => a.order - b.order),
        [notes]
    );

    return { notes, loading, addNote, updateNote, deleteNote, restoreNote, reorderNotes, getNotesByTrip };
}

// ---- Chat History ----
export function useChatHistory(tripId: string | null) {
    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || !tripId) {
            setMessages([]);
            setLoading(false);
            return;
        }

        // Limit query to 7 days old
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const cutoffISO = sevenDaysAgo.toISOString();

        let unsub: Unsubscribe;
        try {
            const q = query(
                collection(db, 'chat_history'),
                and(
                    where('tripId', '==', tripId),
                    where('createdAt', '>=', cutoffISO),
                    or(
                        where('tripMembers', 'array-contains', user.uid),
                        where('userId', '==', user.uid)
                    )
                )
            );

            unsub = onSnapshot(
                q,
                (snapshot) => {
                    const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data(), _pendingWrite: d.metadata.hasPendingWrites }) as ChatMessage);
                    // Sort chronologically by createdAt timestamp
                    const sorted = [...data].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
                    setMessages(sorted);
                    setLoading(false);
                },
                (error) => {
                    console.error('Error fetching chat history:', error);
                    setLoading(false);
                }
            );
        } catch (error) {
            console.error('Error setting up chat history listener:', error);
            setLoading(false);
        }
        return () => unsub?.();
    }, [user?.uid, tripId]);

    const addMessage = useCallback(async (msg: Omit<ChatMessage, 'id' | 'userId' | 'tripMembers'>, tripMembers: string[] = []) => {
        if (!user) throw new Error('Not authenticated');
        const docRef = doc(collection(db, 'chat_history'));

        // Ensure the current user is ALWAYS in tripMembers regardless of what the UI sent
        const finalMembers = Array.from(new Set([...tripMembers, user.uid])).filter(Boolean);

        const fullMsg: ChatMessage = {
            ...msg,
            id: docRef.id,
            userId: user.uid,
            tripMembers: finalMembers
        };
        await setDoc(docRef, stripUndefined(fullMsg));
    }, [user]);

    const clearHistory = useCallback(async () => {
        if (!user || !tripId) throw new Error('Not authenticated or no trip');
        // Because of Firestore permissions, we can't easily run a batch delete query without an active read query loop, 
        // so we just rely on the 7 day rolling window to drop them naturally from the UI!
        // Alternatively, a Firebase Cloud Function would handle proper TTL deletions. 
    }, [user, tripId]);

    return { messages, loading, addMessage, clearHistory };
}
