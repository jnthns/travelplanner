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
    type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './AuthContext';
import type { Trip, Activity, TransportRoute, Note } from './types';

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
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
            const q = query(collection(db, 'trips'), where('userId', '==', user.uid));
            unsub = onSnapshot(
                q,
                (snapshot) => {
                    const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Trip);
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

    const addTrip = useCallback(async (trip: Omit<Trip, 'id' | 'userId'>) => {
        if (!user) throw new Error('Not authenticated');
        const docRef = await addDoc(collection(db, 'trips'), stripUndefined({ ...trip, userId: user.uid }));
        return { ...trip, id: docRef.id, userId: user.uid } as Trip;
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

    return { trips, loading, addTrip, updateTrip, deleteTrip, restoreTrip };
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
            const q = query(collection(db, 'activities'), where('userId', '==', user.uid));
            unsub = onSnapshot(
                q,
                (snapshot) => {
                    const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Activity);
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

    const addActivity = useCallback(async (activity: Omit<Activity, 'id' | 'userId'>) => {
        if (!user) throw new Error('Not authenticated');
        const docRef = await addDoc(collection(db, 'activities'), stripUndefined({ ...activity, userId: user.uid }));
        return { ...activity, id: docRef.id, userId: user.uid } as Activity;
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
            const q = query(collection(db, 'transportRoutes'), where('userId', '==', user.uid));
            unsub = onSnapshot(
                q,
                (snapshot) => {
                    const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as TransportRoute);
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

    const addRoute = useCallback(async (route: Omit<TransportRoute, 'id' | 'userId'>) => {
        if (!user) throw new Error('Not authenticated');
        const docRef = await addDoc(collection(db, 'transportRoutes'), stripUndefined({ ...route, userId: user.uid }));
        return { ...route, id: docRef.id, userId: user.uid } as TransportRoute;
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
            const q = query(collection(db, 'notes'), where('userId', '==', user.uid));
            unsub = onSnapshot(
                q,
                (snapshot) => {
                    const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Note);
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

    const addNote = useCallback(async (note: Omit<Note, 'id' | 'userId'>) => {
        if (!user) throw new Error('Not authenticated');
        const docRef = await addDoc(collection(db, 'notes'), stripUndefined({ ...note, userId: user.uid }));
        return { ...note, id: docRef.id, userId: user.uid } as Note;
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
