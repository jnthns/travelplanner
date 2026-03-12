import { getCachedAiText } from '../cache';
import { generateWithGemini } from '../../gemini';

export async function generateActivityGuide(title: string): Promise<string> {
  const normalizedTitle = title.trim();

  const prompt = `For this activity: "${normalizedTitle}".

Write a highly detailed and useful guide (maximum 100 words) in bullet point format with newlines for formatting, structured in this order:
1. Start with specific, practical travel tips to optimize the experience — best time of the week/time of day to visit, how to avoid crowds, money-saving strategies, local etiquette, and efficiency tips for getting the most out of the visit.
2. Include any culinary recommendations for the area.
3. Then include lesser-known tips or details that a typical tourist might miss (nearby gems worth combining into the visit).
4. End with a brief but rich historical, cultural, or geographical description of the location/activity.

Prioritize actionable advice over general description. Use engaging but factual language. Output only the guide paragraphs, no headings or labels or ad recommendations. Use emojis for each point. Start with a newline and an underline line divider in your response. Apply markdown formatting to the response.`;

  return getCachedAiText({
    namespace: 'activity-guide',
    cacheKey: normalizedTitle,
    producer: () =>
      generateWithGemini(prompt, {
        systemInstruction: 'You are an expert travel assistant.',
      }),
    ttlMs: 7 * 24 * 60 * 60 * 1000,
  });
}

export async function generateTripAutofillSuggestion(args: {
  name: string;
  startDate?: string;
  endDate?: string;
}): Promise<string> {
  const name = args.name.trim();
  const dateRange = args.startDate && args.endDate ? ` from ${args.startDate} to ${args.endDate}` : '';
  const prompt = `For a trip to "${name}"${dateRange}, suggest popular activities and highlights.

Include:
- Must-see attractions and landmarks
- Local food and dining experiences
- Cultural or seasonal events worth attending
- Neighborhoods or areas to explore
- Day-trip options nearby

Format as a concise bullet list. Maximum 200 words. Be specific and practical.`;

  return getCachedAiText({
    namespace: 'trip-autofill',
    cacheKey: JSON.stringify({ name, startDate: args.startDate || '', endDate: args.endDate || '' }),
    producer: () =>
      generateWithGemini(prompt, {
        systemInstruction: 'You are an expert travel planner.',
      }),
    ttlMs: 7 * 24 * 60 * 60 * 1000,
  });
}
