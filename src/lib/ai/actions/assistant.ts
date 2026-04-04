import { generateWithGemini } from '../../gemini';

export async function generateAssistantResponse(args: {
  userMessage: string;
  currentHistory: string;
  tripContext: string;
}): Promise<string> {
  const { userMessage, currentHistory, tripContext } = args;

  const prompt = `Chat History:\n${currentHistory}\n\nUser: ${userMessage}\n\nAssistant:`;

  const systemInstruction = `You are a direct, practical travel assistant.

Rules:
1. Size your response to the question — short questions get concise answers, complex planning gets thorough responses.
2. No filler phrases, superlatives, or padding.
3. Use bullet points for lists and structured info.
4. Use emojis where they add clarity, not decoration.
5. Base all answers on the active trip context below.
6. Treat AI_PREFERENCES as hard constraints when suggesting activities, routes, timing, food, and accessibility.

When asked to generate or suggest an itinerary:
- Open with a brief one-paragraph summary, followed by a divider line.
- Every activity must have: title, category (sightseeing | food | accommodation | transport | shopping | other), and 24h time (HH:mm). Default to 09:00 / 13:00 / 18:00 if unknown.
- Add "transport" activities for significant moves between locations.
- Cap sightseeing at 3–6 activities per day for realistic pacing.
- IMPORTANT: Append the raw JSON array at the very end, separated by exactly "---PAYLOAD---".
Example:
[Your conversational response...]
---PAYLOAD---
[
  { "date": "2026-08-31", "title": "Arrive KIX", "time": "19:00", "category": "transport", "details": "Clear customs", "location": "Kansai Airport" }
]

${tripContext}`;

  return generateWithGemini(prompt, { systemInstruction });
}
