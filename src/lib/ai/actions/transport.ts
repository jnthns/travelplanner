import { getCachedAiText } from '../cache';
import { generateWithGemini } from '../../gemini';

export async function suggestTransportOptions(args: {
  from: string;
  to: string;
}): Promise<string> {
  const from = args.from.trim();
  const to = args.to.trim();

  const prompt = `From "${from}" to "${to}", list the 2-3 most practical transport options. 

For each option use a bullet with:
- Sub-bullets: approximate duration, typical cost range, popularity (e.g. common/niche), and one line description.
- Include a booking or info URL (real link if you know one, or a placeholder like https://example.com) for each option.

Format: short bullet list only. Maximum 200 words. Be direct and factual; avoid superlatives.`;

  return getCachedAiText({
    namespace: 'transport-suggestions',
    cacheKey: JSON.stringify({ from, to }),
    producer: () => generateWithGemini(prompt),
    ttlMs: 24 * 60 * 60 * 1000,
  });
}
