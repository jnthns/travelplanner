import { useState, useEffect, useCallback } from 'react';
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Trip, Activity, TransportRoute } from './types';

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
    return Object.fromEntries(
        Object.entries(obj).filter(([, v]) => v !== undefined)
    ) as T;
}

// ---- Trips ----
export function useTrips() {
    const [trips, setTrips] = useState<Trip[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsub: Unsubscribe;
        try {
            unsub = onSnapshot(
                collection(db, 'trips'),
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
    }, []);

    const addTrip = useCallback(async (trip: Omit<Trip, 'id'>) => {
        const docRef = await addDoc(collection(db, 'trips'), stripUndefined(trip));
        return { ...trip, id: docRef.id } as Trip;
    }, []);

    const updateTrip = useCallback(async (id: string, updates: Partial<Trip>) => {
        await updateDoc(doc(db, 'trips', id), stripUndefined(updates));
    }, []);

    const deleteTrip = useCallback(async (id: string) => {
        await deleteDoc(doc(db, 'trips', id));
    }, []);

    return { trips, loading, addTrip, updateTrip, deleteTrip };
}

// ---- Activities ----
export function useActivities() {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsub: Unsubscribe;
        try {
            unsub = onSnapshot(
                collection(db, 'activities'),
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
    }, []);

    const addActivity = useCallback(async (activity: Omit<Activity, 'id'>) => {
        const docRef = await addDoc(collection(db, 'activities'), stripUndefined(activity));
        return { ...activity, id: docRef.id } as Activity;
    }, []);

    const updateActivity = useCallback(async (id: string, updates: Partial<Activity>) => {
        await updateDoc(doc(db, 'activities', id), stripUndefined(updates));
    }, []);

    const deleteActivity = useCallback(async (id: string) => {
        await deleteDoc(doc(db, 'activities', id));
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

    return { activities, loading, addActivity, updateActivity, deleteActivity, getActivitiesByDate, getActivitiesByTrip };
}

// ---- Transport Routes ----
export function useTransportRoutes() {
    const [routes, setRoutes] = useState<TransportRoute[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsub: Unsubscribe;
        try {
            unsub = onSnapshot(
                collection(db, 'transportRoutes'),
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
    }, []);

    const addRoute = useCallback(async (route: Omit<TransportRoute, 'id'>) => {
        const docRef = await addDoc(collection(db, 'transportRoutes'), stripUndefined(route));
        return { ...route, id: docRef.id } as TransportRoute;
    }, []);

    const updateRoute = useCallback(async (id: string, updates: Partial<TransportRoute>) => {
        await updateDoc(doc(db, 'transportRoutes', id), stripUndefined(updates));
    }, []);

    const deleteRoute = useCallback(async (id: string) => {
        await deleteDoc(doc(db, 'transportRoutes', id));
    }, []);

    const getRoutesByTrip = useCallback(
        (tripId: string) => routes.filter((r) => r.tripId === tripId).sort((a, b) => a.date.localeCompare(b.date)),
        [routes]
    );

    return { routes, loading, addRoute, updateRoute, deleteRoute, getRoutesByTrip };
}
