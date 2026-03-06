import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, auth } from './firebase';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export async function uploadNoteImage(tripId: string, noteId: string, file: File): Promise<string> {
    if (!auth.currentUser) throw new Error('Not authenticated');
    if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error(`Unsupported file type: ${file.type}. Use JPEG, PNG, GIF, or WebP.`);
    }
    if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 5 MB.`);
    }
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `notes/${auth.currentUser.uid}/${tripId}/${noteId}/${Date.now()}.${ext}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
}
