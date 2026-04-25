// Purpose: show Gemini API request success/error toasts without coupling `gemini.ts` to React.
import { useEffect } from 'react';
import { setGeminiRequestToastListener } from '../lib/geminiToastBridge';
import { useToast } from './toastContext';

export function GeminiAiToastBridge(): null {
  const { showToast } = useToast();

  useEffect(() => {
    setGeminiRequestToastListener((payload) => {
      if (payload.kind === 'success') {
        const name = payload.model.trim() || 'model';
        showToast(`AI request completed · ${name}`, undefined, 4000, 'default');
        return;
      }
      const code = payload.statusCode != null ? ` · HTTP ${payload.statusCode}` : '';
      showToast(`${payload.message}${code}`, undefined, 8000, 'error');
    });
    return () => {
      setGeminiRequestToastListener(null);
    };
  }, [showToast]);

  return null;
}
