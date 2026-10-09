import { directoryFighters } from './fighter-directory.js';

const byId = new Map(directoryFighters.map(fighter => [fighter.id, fighter]));
export async function refreshFighterRecords() {
  try {
    const response = await fetch(new URL('../data/fighter-records.json', import.meta.url), { cache: 'no-store' });
    if (!response.ok) return false;
    const feed = await response.json();
    if (feed.schemaVersion !== 1 || feed.source !== 'UFC' ||
        !feed.records || typeof feed.records !== 'object' || Array.isArray(feed.records)) return false;
    const updates = Object.entries(feed.records);
    if (updates.some(([id, entry]) => !byId.has(id) || entry?.source !== 'UFC' ||
        !/^\d{1,3}-\d{1,3}-\d{1,3}$/.test(entry.record))) return false;
    for (const [id, entry] of updates) {
      byId.get(id).record = entry.record;
      byId.get(id).recordSource = 'UFC.com';
    }
    return updates.length > 0;
  } catch {
    return false;
  }
}
