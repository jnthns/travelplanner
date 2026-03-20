/**
 * AI generation facade. Import from here instead of `../gemini` in app/feature code
 * so proxy and throttling stay behind one module boundary.
 */
export { DEFAULT_GEMINI_MODEL, generateWithGemini } from '../gemini';
