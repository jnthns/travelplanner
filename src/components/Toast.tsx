import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import './Toast.css';

const TOAST_DURATION = 5000;

interface ToastItem {
    id: number;
    message: string;
    onUndo?: () => void;
    timeoutId: ReturnType<typeof setTimeout>;
}

interface ToastContextValue {
    /** Optional third argument: duration in ms (default 5000). Use `undefined` for onUndo when passing duration only. */
    showToast: (message: string, onUndo?: () => void, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const idRef = useRef(0);

    const dismiss = useCallback((id: number) => {
        setToasts(prev => {
            const toast = prev.find(t => t.id === id);
            if (toast) clearTimeout(toast.timeoutId);
            return prev.filter(t => t.id !== id);
        });
    }, []);

    const showToast = useCallback((message: string, onUndo?: () => void, durationMs?: number) => {
        const id = ++idRef.current;
        const duration = durationMs ?? TOAST_DURATION;
        const timeoutId = setTimeout(() => dismiss(id), duration);
        setToasts(prev => [...prev, { id, message, onUndo, timeoutId }]);
    }, [dismiss]);

    const handleUndo = useCallback((toast: ToastItem) => {
        toast.onUndo?.();
        dismiss(toast.id);
    }, [dismiss]);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {toasts.length > 0 && (
                <div className="toast-container">
                    {toasts.map(toast => (
                        <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} onUndo={handleUndo} />
                    ))}
                </div>
            )}
        </ToastContext.Provider>
    );
};

const ToastItem: React.FC<{
    toast: ToastItem;
    onDismiss: (id: number) => void;
    onUndo: (toast: ToastItem) => void;
}> = ({ toast, onDismiss, onUndo }) => {
    const [exiting, setExiting] = useState(false);
    const [progress, setProgress] = useState(100);
    const startRef = useRef(Date.now());

    useEffect(() => {
        const interval = setInterval(() => {
            const elapsed = Date.now() - startRef.current;
            const remaining = Math.max(0, 100 - (elapsed / TOAST_DURATION) * 100);
            setProgress(remaining);
            if (remaining <= 0) clearInterval(interval);
        }, 50);
        return () => clearInterval(interval);
    }, []);

    const handleDismiss = () => {
        setExiting(true);
        setTimeout(() => onDismiss(toast.id), 200);
    };

    return (
        <div className={`toast ${exiting ? 'toast-exit' : 'toast-enter'}`}>
            <div className="toast-content">
                <span className="toast-message">{toast.message}</span>
                <div className="toast-actions">
                    {toast.onUndo && (
                        <button className="toast-undo-btn" onClick={() => onUndo(toast)}>
                            Undo
                        </button>
                    )}
                    <button className="toast-dismiss-btn" onClick={handleDismiss} aria-label="Dismiss">
                        ×
                    </button>
                </div>
            </div>
            {toast.onUndo && (
                <div className="toast-progress-track">
                    <div className="toast-progress-bar" style={{ width: `${progress}%` }} />
                </div>
            )}
        </div>
    );
};
