import React, { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { TriangleAlert } from 'lucide-react';
import { ToastContext, type ToastVariant } from './toastContext';
import './Toast.css';

const TOAST_DURATION = 5000;

interface ToastItem {
    id: number;
    message: string;
    onUndo?: () => void;
    timeoutId: ReturnType<typeof setTimeout>;
    durationMs: number;
    variant: ToastVariant;
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

    const showToast = useCallback(
        (message: string, onUndo?: () => void, durationMs?: number, variant: ToastVariant = 'default') => {
        const id = ++idRef.current;
        const duration = durationMs ?? TOAST_DURATION;
        const timeoutId = setTimeout(() => dismiss(id), duration);
        setToasts(prev => [
            ...prev,
            { id, message, onUndo, timeoutId, durationMs: duration, variant },
        ]);
    },
    [dismiss]
);

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
    const startRef = useRef<number | null>(null);

    useLayoutEffect(() => {
        startRef.current = Date.now();
    }, []);

    useEffect(() => {
        const duration = toast.durationMs;
        const interval = setInterval(() => {
            const start = startRef.current;
            if (start == null) return;
            const elapsed = Date.now() - start;
            const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
            setProgress(remaining);
            if (remaining <= 0) clearInterval(interval);
        }, 50);
        return () => clearInterval(interval);
    }, [toast.durationMs]);

    const handleDismiss = () => {
        setExiting(true);
        setTimeout(() => onDismiss(toast.id), 200);
    };

    const isError = toast.variant === 'error';

    return (
        <div
            className={`toast ${isError ? 'toast--error' : ''} ${
                exiting ? 'toast-exit' : 'toast-enter'
            }`}
            role="status"
            aria-live={isError ? 'assertive' : 'polite'}
        >
            <div className="toast-content">
                {isError && (
                    <TriangleAlert className="toast-icon toast-icon--warning" size={20} aria-hidden />
                )}
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
