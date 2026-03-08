import React, { useState } from 'react';
import { X, UserPlus, Loader2, Trash2 } from 'lucide-react';
import { collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useTrips } from '../lib/store';
import type { Trip } from '../lib/types';
import { useToast } from './Toast';
import { logEvent } from '../lib/amplitude';

interface ShareModalProps {
    trip: Trip;
    onClose: () => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ trip, onClose }) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { updateTrip } = useTrips();
    const { showToast } = useToast();

    // Prevent closing when clicking inside the modal
    const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

    const handleAddCollaborator = async (e: React.FormEvent) => {
        e.preventDefault();
        const targetEmail = email.trim().toLowerCase();
        if (!targetEmail) return;

        if (trip.sharedWithEmails?.includes(targetEmail)) {
            setError('User is already a collaborator on this trip.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // 1. Look up user by email in the /users directory
            const q = query(collection(db, 'users'), where('email', '==', targetEmail));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setError(`No account found for ${targetEmail}. Have they signed in to the app before?`);
                setLoading(false);
                return;
            }

            const targetUserDoc = querySnapshot.docs[0];
            const targetUid = targetUserDoc.data().uid;

            // 2. Update the Trip's members and sharedWithEmails array
            const newMembers = [...(trip.members || [trip.userId]), targetUid];
            const newShared = [...(trip.sharedWithEmails || []), targetEmail];

            // Only update the trip doc here, not the child docs immediately
            await updateTrip(trip.id, {
                members: newMembers,
                sharedWithEmails: newShared
            });

            // 3. Batch update the denormalized `tripMembers` array on all activities, notes, and routes for this trip
            // This is required so the tight security rules work without `get()` calls.
            const batch = writeBatch(db);
            const collectionsToUpdate = ['activities', 'notes', 'transportRoutes', 'chat_history'];

            for (const collName of collectionsToUpdate) {
                // Query by tripId only - isMember() in firestore.rules handles auth with isOwner() fallback
                const subQ = query(
                    collection(db, collName),
                    where('tripId', '==', trip.id)
                );
                const subSnapshot = await getDocs(subQ);
                subSnapshot.forEach((docSnap) => {
                    batch.update(docSnap.ref, { tripMembers: newMembers });
                });
            }

            await batch.commit();

            logEvent('Collaborator Added', { trip_id: trip.id });
            showToast(`${targetEmail} can now collaborate on this trip!`);
            setEmail('');
        } catch (err) {
            console.error('Failed to add collaborator:', err);
            setError('An error occurred while adding the collaborator.');
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveCollaborator = async (emailToRemove: string) => {
        setLoading(true);
        try {
            // 1. Lookup the UID for this email to remove it
            const q = query(collection(db, 'users'), where('email', '==', emailToRemove));
            const querySnapshot = await getDocs(q);
            let uidToRemove = null;
            if (!querySnapshot.empty) {
                uidToRemove = querySnapshot.docs[0].data().uid;
            }

            // 2. Filter out arrays
            const newShared = (trip.sharedWithEmails || []).filter(e => e !== emailToRemove);
            let newMembers = trip.members || [trip.userId];
            if (uidToRemove) {
                newMembers = newMembers.filter(uid => uid !== uidToRemove);
            }

            // 3. Update trip
            await updateTrip(trip.id, {
                members: newMembers,
                sharedWithEmails: newShared
            });

            // 4. Update children
            const batch = writeBatch(db);
            const collectionsToUpdate = ['activities', 'notes', 'transportRoutes', 'chat_history'];
            for (const collName of collectionsToUpdate) {
                // Query by tripId only - isMember() in firestore.rules handles auth with isOwner() fallback
                const subQ = query(
                    collection(db, collName),
                    where('tripId', '==', trip.id)
                );
                const subSnapshot = await getDocs(subQ);
                subSnapshot.forEach((docSnap) => {
                    batch.update(docSnap.ref, { tripMembers: newMembers });
                });
            }
            await batch.commit();

            logEvent('Collaborator Removed', { trip_id: trip.id });
            showToast(`${emailToRemove} removed.`);
        } catch (err) {
            console.error('Failed to remove collaborator:', err);
            setError('Could not remove collaborator.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
            style={{
                backgroundColor: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(4px)',
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0
            }}
            onClick={onClose}
        >
            <div className="card w-full animate-slide-up" style={{ maxWidth: '440px', margin: 'auto', padding: '1.5rem', zIndex: 51, position: 'relative' }} onClick={stopPropagation}>
                <div className="flex justify-between items-center mb-md">
                    <h2 className="text-lg">Share Trip</h2>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                <div className="mb-lg">
                    <p className="text-sm text-secondary mb-md">
                        Invite friends to collaborate on <strong>{trip.name}</strong>. They will be able to add, edit, and delete activities and notes.
                    </p>

                    <form onSubmit={handleAddCollaborator} className="flex gap-sm">
                        <input
                            type="email"
                            className="input-field flex-1"
                            placeholder="friend@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading}
                            required
                        />
                        <button type="submit" className="btn btn-primary" disabled={loading || !email.trim()}>
                            {loading ? <Loader2 size={16} className="spin" /> : <UserPlus size={16} />}
                            Invite
                        </button>
                    </form>
                    {error && <p className="text-xs text-danger mt-xs">{error}</p>}
                </div>

                <div className="border-t pt-md" style={{ borderColor: 'var(--border-color)' }}>
                    <h3 className="text-sm font-medium mb-sm">Collaborators</h3>

                    <div className="flex flex-col gap-xs">
                        <div className="flex justify-between items-center p-sm rounded-md bg-surface-1 border">
                            <span className="text-sm text-secondary">You (Owner)</span>
                        </div>

                        {(trip.sharedWithEmails || []).length === 0 ? (
                            <p className="text-xs text-tertiary italic p-sm">No one else has access yet.</p>
                        ) : (
                            (trip.sharedWithEmails || []).map((sharedEmail) => (
                                <div key={sharedEmail} className="flex justify-between items-center p-sm rounded-md bg-surface-1 border">
                                    <span className="text-sm truncate w-3/4">{sharedEmail}</span>
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-sm text-danger p-1"
                                        onClick={() => handleRemoveCollaborator(sharedEmail)}
                                        disabled={loading}
                                        title="Remove access"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShareModal;
