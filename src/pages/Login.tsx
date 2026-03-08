import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Loader2 } from 'lucide-react';

const Login: React.FC = () => {
    const { signInWithGoogle, signInAnonymously } = useAuth();
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const handle = async (fn: () => Promise<void>) => {
        setError(null);
        setBusy(true);
        try {
            await fn();
        } catch (err) {
            console.error('Auth error:', err);
            setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex items-center justify-center p-md bg-surface-2" style={{ minHeight: '100vh' }}>
            <div className="card w-full text-center" style={{ maxWidth: '380px', padding: '2.5rem 2rem' }}>
                <div className="mb-sm" style={{ fontSize: '3rem', lineHeight: 1 }}>✈️</div>
                <h1 className="text-xl mb-xs">TravelPlanner</h1>
                <p className="text-sm text-secondary mb-xl">Plan, organize, and track your trips in one place.</p>

                {error && <div className="text-sm p-sm rounded-md mb-md" style={{ color: 'var(--error-color)', backgroundColor: 'color-mix(in srgb, var(--error-color) 12%, transparent)' }}>{error}</div>}

                <div className="flex flex-col gap-sm">
                    <button
                        className="btn btn-primary w-full justify-center text-sm"
                        style={{ padding: '0.65rem 1rem' }}
                        onClick={() => handle(signInWithGoogle)}
                        disabled={busy}
                    >
                        {busy ? <Loader2 size={18} className="spin" /> : <GoogleIcon />}
                        Sign in with Google
                    </button>

                    <div className="flex items-center gap-md text-xs text-tertiary my-xs">
                        <div className="flex-1" style={{ height: '1px', backgroundColor: 'var(--border-color)' }}></div>
                        <span>or</span>
                        <div className="flex-1" style={{ height: '1px', backgroundColor: 'var(--border-color)' }}></div>
                    </div>

                    <button
                        className="btn btn-outline w-full justify-center text-sm"
                        style={{ padding: '0.65rem 1rem' }}
                        onClick={() => handle(signInAnonymously)}
                        disabled={busy}
                    >
                        Continue as guest
                    </button>
                </div>

                <p className="text-tertiary leading-relaxed" style={{ marginTop: '1.25rem', fontSize: '0.72rem' }}>
                    Guest accounts are temporary and cannot share trips. Sign in with Google to save your data and collaborate with friends.
                </p>
            </div>
        </div>
    );
};

function GoogleIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
    );
}

export default Login;
