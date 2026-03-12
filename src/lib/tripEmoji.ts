const COUNTRY_FLAG_RULES: Array<{ emoji: string; keywords: string[] }> = [
    { emoji: '🇯🇵', keywords: ['japan'] },
    { emoji: '🇰🇷', keywords: ['south korea', 'korea'] },
    { emoji: '🇹🇼', keywords: ['taiwan'] },
    { emoji: '🇹🇭', keywords: ['thailand'] },
    { emoji: '🇻🇳', keywords: ['vietnam'] },
    { emoji: '🇸🇬', keywords: ['singapore'] },
    { emoji: '🇮🇩', keywords: ['indonesia'] },
    { emoji: '🇲🇾', keywords: ['malaysia'] },
    { emoji: '🇵🇭', keywords: ['philippines'] },
    { emoji: '🇨🇳', keywords: ['china'] },
    { emoji: '🇮🇳', keywords: ['india'] },
    { emoji: '🇦🇺', keywords: ['australia'] },
    { emoji: '🇳🇿', keywords: ['new zealand'] },
    { emoji: '🇬🇧', keywords: ['uk', 'united kingdom', 'england', 'scotland'] },
    { emoji: '🇫🇷', keywords: ['france'] },
    { emoji: '🇮🇹', keywords: ['italy'] },
    { emoji: '🇪🇸', keywords: ['spain'] },
    { emoji: '🇵🇹', keywords: ['portugal'] },
    { emoji: '🇩🇪', keywords: ['germany'] },
    { emoji: '🇳🇱', keywords: ['netherlands'] },
    { emoji: '🇨🇭', keywords: ['switzerland'] },
    { emoji: '🇦🇹', keywords: ['austria'] },
    { emoji: '🇬🇷', keywords: ['greece'] },
    { emoji: '🇹🇷', keywords: ['turkey', 'türkiye'] },
    { emoji: '🇦🇪', keywords: ['uae', 'united arab emirates'] },
    { emoji: '🇪🇬', keywords: ['egypt'] },
    { emoji: '🇲🇦', keywords: ['morocco'] },
    { emoji: '🇰🇪', keywords: ['kenya'] },
    { emoji: '🇿🇦', keywords: ['south africa'] },
    { emoji: '🇨🇦', keywords: ['canada'] },
    { emoji: '🇺🇸', keywords: ['usa', 'united states', 'america'] },
    { emoji: '🇲🇽', keywords: ['mexico'] },
    { emoji: '🇧🇷', keywords: ['brazil'] },
    { emoji: '🇦🇷', keywords: ['argentina'] },
];

const DESTINATION_RULES: Array<{ emoji: string; keywords: string[] }> = [
    { emoji: '🗼', keywords: ['tokyo', 'kyoto', 'osaka'] },
    { emoji: '🗽', keywords: ['new york'] },
    { emoji: '🎡', keywords: ['london'] },
    { emoji: '🗼', keywords: ['paris'] },
    { emoji: '🏛️', keywords: ['rome', 'athens'] },
    { emoji: '🏰', keywords: ['disneyland', 'disney world'] },
    { emoji: '🌋', keywords: ['iceland', 'hawaii'] },
    { emoji: '🏜️', keywords: ['dubai', 'abu dhabi'] },
    { emoji: '🏖️', keywords: ['bali', 'phuket', 'maldives'] },
    { emoji: '🏞️', keywords: ['banff', 'yosemite', 'alps'] },
    { emoji: '🚢', keywords: ['caribbean'] },
];

const FALLBACK_EMOJIS = ['✈️', '🧭', '🌍', '🗺️', '🎒', '🚆', '🚗', '🏞️', '🏕️', '🌇'];

function hashString(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
        hash = (hash * 31 + input.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}

export function getTripEmoji(tripName: string): string {
    const normalized = tripName.trim().toLowerCase();
    if (!normalized) return '✈️';

    // Prefer country flags when a country is explicitly mentioned.
    for (const rule of COUNTRY_FLAG_RULES) {
        if (rule.keywords.some((k) => normalized.includes(k))) {
            return rule.emoji;
        }
    }

    // Then use destination/city inference.
    for (const rule of DESTINATION_RULES) {
        if (rule.keywords.some((k) => normalized.includes(k))) {
            return rule.emoji;
        }
    }

    // Deterministic "random" fallback so the same title keeps the same emoji.
    const idx = hashString(normalized) % FALLBACK_EMOJIS.length;
    return FALLBACK_EMOJIS[idx];
}

