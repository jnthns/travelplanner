import { generateWithGemini } from './gemini';
import type { Activity } from './types';

const ACTIVITY_SCHEMA = {
    type: "ARRAY",
    items: {
        type: "OBJECT",
        properties: {
            date: { type: "STRING", description: "ISO Date YYYY-MM-DD" },
            time: { type: "STRING", description: "HH:mm format if applicable" },
            title: { type: "STRING" },
            location: { type: "STRING" },
            category: { type: "STRING" },
            notes: { type: "STRING" }
        },
        required: ["date", "title"]
    }
};

export async function generateDraftTrip(currentActivities: Activity[], noteContent: string): Promise<Partial<Activity>[]> {
    // 1. Minimize current data to fit token limits easily and reduce noise
    const minimizedItinerary = currentActivities
        .sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.order - b.order;
        })
        .map(a => ({
            date: a.date,
            time: a.time || '',
            title: a.title,
            location: a.location || '',
            category: a.category || 'other',
            notes: a.notes || ''
        }));

    const prompt = `You are an expert travel assistant. Modify the provided JSON itinerary based on the instructions inside the user's note. 
You may add new activities, remove cancelled activities, or edit times/locations of existing activities as requested.
Keep the output strictly to the requested schema. Ensure dates stay within the general window of the trip unless explicitly told to shift them.

Original Itinerary:
${JSON.stringify(minimizedItinerary, null, 2)}

User Note requesting changes:
${noteContent}`;

    const responseText = await generateWithGemini(prompt, {
        responseMimeType: 'application/json',
        responseSchema: ACTIVITY_SCHEMA
    });

    try {
        const parsed = JSON.parse(responseText) as Partial<Activity>[];
        if (!Array.isArray(parsed)) {
            throw new Error('AI did not return an array');
        }
        return parsed;
    } catch (err) {
        console.error('Failed to parse AI draft response', err);
        throw new Error('AI returned an invalid draft structure');
    }
}
