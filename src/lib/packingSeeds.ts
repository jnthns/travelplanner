import type { PackingItem } from './types';

/** Default essentials for new trips and one-off backfills (listGroup: essential). */
export const ESSENTIAL_PACKING_SEEDS: Array<Pick<PackingItem, 'title' | 'category'>> = [
    { title: 'Passport', category: 'documents' },
    { title: 'Battery pack', category: 'electronics' },
    { title: 'Charging cables', category: 'electronics' },
    { title: 'Underwear', category: 'clothing' },
    { title: 'Shirts', category: 'clothing' },
    { title: 'Pants', category: 'clothing' },
    { title: 'Jackets', category: 'clothing' },
];
