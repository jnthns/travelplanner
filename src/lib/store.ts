import { useState, useEffect, useCallback } from 'react';
import type { Trip, Activity, TransportRoute } from './types';

const STORAGE_KEYS = {
    trips: 'wandertrack_trips',
    activities: 'wandertrack_activities',
    transport: 'wandertrack_transport',
};

function loadFromStorage<T>(key: string): T[] {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

function saveToStorage<T>(key: string, data: T[]): void {
    localStorage.setItem(key, JSON.stringify(data));
}

function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// ---- Trips ----
export function useTrips() {
    const [trips, setTrips] = useState<Trip[]>(() => loadFromStorage<Trip>(STORAGE_KEYS.trips));

    useEffect(() => {
        saveToStorage(STORAGE_KEYS.trips, trips);
    }, [trips]);

    const addTrip = useCallback((trip: Omit<Trip, 'id'>) => {
        const newTrip = { ...trip, id: generateId() };
        setTrips(prev => [...prev, newTrip]);
        return newTrip;
    }, []);

    const updateTrip = useCallback((id: string, updates: Partial<Trip>) => {
        setTrips(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    }, []);

    const deleteTrip = useCallback((id: string) => {
        setTrips(prev => prev.filter(t => t.id !== id));
    }, []);

    return { trips, addTrip, updateTrip, deleteTrip };
}

// ---- Activities ----
export function useActivities() {
    const [activities, setActivities] = useState<Activity[]>(() =>
        loadFromStorage<Activity>(STORAGE_KEYS.activities)
    );

    useEffect(() => {
        saveToStorage(STORAGE_KEYS.activities, activities);
    }, [activities]);

    const addActivity = useCallback((activity: Omit<Activity, 'id'>) => {
        const newActivity = { ...activity, id: generateId() };
        setActivities(prev => [...prev, newActivity]);
        return newActivity;
    }, []);

    const updateActivity = useCallback((id: string, updates: Partial<Activity>) => {
        setActivities(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    }, []);

    const deleteActivity = useCallback((id: string) => {
        setActivities(prev => prev.filter(a => a.id !== id));
    }, []);

    const getActivitiesByDate = useCallback(
        (date: string) => activities.filter(a => a.date === date).sort((a, b) => a.order - b.order),
        [activities]
    );

    const getActivitiesByTrip = useCallback(
        (tripId: string) => activities.filter(a => a.tripId === tripId).sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.order - b.order;
        }),
        [activities]
    );

    return { activities, addActivity, updateActivity, deleteActivity, getActivitiesByDate, getActivitiesByTrip };
}

// ---- Transport Routes ----
export function useTransportRoutes() {
    const [routes, setRoutes] = useState<TransportRoute[]>(() =>
        loadFromStorage<TransportRoute>(STORAGE_KEYS.transport)
    );

    useEffect(() => {
        saveToStorage(STORAGE_KEYS.transport, routes);
    }, [routes]);

    const addRoute = useCallback((route: Omit<TransportRoute, 'id'>) => {
        const newRoute = { ...route, id: generateId() };
        setRoutes(prev => [...prev, newRoute]);
        return newRoute;
    }, []);

    const updateRoute = useCallback((id: string, updates: Partial<TransportRoute>) => {
        setRoutes(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    }, []);

    const deleteRoute = useCallback((id: string) => {
        setRoutes(prev => prev.filter(r => r.id !== id));
    }, []);

    const getRoutesByTrip = useCallback(
        (tripId: string) => routes.filter(r => r.tripId === tripId).sort((a, b) => a.date.localeCompare(b.date)),
        [routes]
    );

    return { routes, addRoute, updateRoute, deleteRoute, getRoutesByTrip };
}
