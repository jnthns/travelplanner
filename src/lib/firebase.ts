import { initializeApp } from 'firebase/app';
import {
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

function normalizeStorageBucket(rawBucket: string, projectId: string): string {
    const trimmed = (rawBucket || '').trim();
    const fromEnv = trimmed
        .replace(/^gs:\/\//i, '')
        .replace(/^https?:\/\/firebasestorage\.googleapis\.com\/v0\/b\//i, '')
        .replace(/\/.*$/, '');

    if (!fromEnv) {
        return projectId ? `${projectId}.appspot.com` : '';
    }

    // Firebase Web Storage SDK upload endpoints are most reliable with appspot bucket IDs.
    if (fromEnv.endsWith('.firebasestorage.app')) {
        return `${fromEnv.replace(/\.firebasestorage\.app$/, '')}.appspot.com`;
    }

    return fromEnv;
}

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || '';
const storageBucket = normalizeStorageBucket(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '', projectId);

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId,
    storageBucket,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const storage = storageBucket ? getStorage(app, `gs://${storageBucket}`) : getStorage(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export default app;
