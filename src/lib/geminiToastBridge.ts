// Purpose: decouple `generateWithGemini` from React so the UI can register toast handlers.
export type GeminiRequestToastPayload =
  | { kind: 'success'; model: string }
  | { kind: 'error'; message: string; statusCode: number | null };

type Listener = (payload: GeminiRequestToastPayload) => void;

let listener: Listener | null = null;

export function setGeminiRequestToastListener(fn: Listener | null): void {
  listener = fn;
}

export function emitGeminiRequestToast(payload: GeminiRequestToastPayload): void {
  listener?.(payload);
}
