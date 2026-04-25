// Purpose: React context and hook for toasts, separate from the provider (fast refresh / lint).
/* eslint react-refresh/only-export-components: "off" -- hook + context live here, not a visual component. */
import { createContext, useContext } from 'react';

export type ToastVariant = 'default' | 'error';

export interface ToastContextValue {
  /**
   * @param onUndo - Optional undo callback; if omitted, pass `durationMs` in this slot when you only need duration.
   * @param durationMs - How long the toast stays visible.
   * @param variant - `error` shows warning styling and icon (e.g. AI failures).
   */
  showToast: (message: string, onUndo?: () => void, durationMs?: number, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export { ToastContext };

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
