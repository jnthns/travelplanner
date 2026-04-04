// Purpose: Shared VITE_AI_PROXY_URL read, trim, and scheme validation for Cloudflare Worker clients.

/** Base URL of the AI proxy (no trailing slash). */
export function getProxyUrl(): string {
    const url = import.meta.env.VITE_AI_PROXY_URL as string | undefined;
    if (!url?.trim()) {
        throw new Error('AI proxy URL is not set. Add VITE_AI_PROXY_URL to your environment.');
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        throw new Error(
            `AI proxy URL must be an absolute address (e.g. https://your-worker.workers.dev). Currently set to: "${url}"`,
        );
    }
    return url.replace(/\/+$/, '');
}
