import { directoryFighters } from './fighter-directory.js';
import { fighterInfo } from './fighter-info-data.js';

const statKeys = new Set(['strikesLanded', 'strikesAbsorbed', 'takedownAverage', 'submissionAverage',
  'strikingDefense', 'takedownDefense', 'knockdownAverage', 'strikingAccuracy', 'takedownAccuracy',
  'koWins', 'submissionWins', 'firstRoundFinishes']);
const percentages = new Set(['strikingDefense', 'takedownDefense', 'strikingAccuracy', 'takedownAccuracy']);
function validStats(entry, fighter) {
  if (entry.info === undefined) return true;
  const info = entry.info;
  return info && typeof info === 'object' && !Array.isArray(info) &&
    info.statisticsSource === fighter.source && /^\d{4}-\d{2}-\d{2}$/.test(info.statisticsConsulted) &&
    ['strikesLanded', 'strikesAbsorbed', 'takedownAverage', 'submissionAverage'].every(key => Number.isFinite(info[key])) &&
    Object.entries(info).every(([key, value]) => ['statisticsSource', 'statisticsConsulted'].includes(key) ||
      (statKeys.has(key) && typeof value === 'number' && Number.isFinite(value) && value >= 0 && (!percentages.has(key) || value <= 100)));
}

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
        !/^\d{1,3}-\d{1,3}-\d{1,3}$/.test(entry.record) || !validStats(entry, byId.get(id)) || !Number.isFinite(Date.parse(entry.updatedAt)))) return false;
    for (const [id, entry] of updates) {
      byId.get(id).record = entry.record;
      byId.get(id).recordSource = 'UFC.com';
      byId.get(id).recordConsultedAt = entry.updatedAt;
      if (entry.info) {
        const fighter = byId.get(id);
        const info = fighter.info || fighterInfo[id] || {};
        Object.assign(info, entry.info);
        fighter.info = info;
        if (fighterInfo[id]) Object.assign(fighterInfo[id], entry.info);
      }
    }
    return updates.length > 0;
  } catch {
    return false;
  }
}
