import { directoryFighters } from './fighter-directory.js';
const byId = new Map(directoryFighters.map(f => [f.id, f]));
const original = new Map(directoryFighters.map(f => [f.id, {image:f.image,
  champion:(f.championships || []).some(b => b.status === 'current' && b.type === 'undisputed')} ]));
let snapshot = null;
function validPhoto(photo) {
  if (!photo || !Number.isFinite(Date.parse(photo.consultedAt))) return false;
  try {
    const url = new URL(photo.url), source = new URL(photo.sourceUrl);
    return url.protocol === 'https:' && source.protocol === 'https:' &&
      (photo.source === 'UFC' ? url.hostname === 'www.ufc.com' && url.pathname.startsWith('/images/') &&
        source.hostname === 'www.ufc.com' && source.pathname.startsWith('/athlete/') :
       photo.source === 'ESPN' && url.hostname === 'a.espncdn.com' && /^\/i\/headshots\/mma\/players\/full\/\d+\.png$/.test(url.pathname) &&
        source.hostname === 'www.espn.com' && source.pathname.startsWith('/mma/fighter/'));
  } catch { return false; }
}
export function applyFighterPhotos() {
  if (!snapshot) return false;
  for (const [id, variants] of Object.entries(snapshot.photos)) {
    const fighter = byId.get(id);
    const champion = (fighter.championships || []).some(b => b.status === 'current' && b.type === 'undisputed');
    const photo = variants[champion ? 'champion' : 'regular'];
    if (photo) {
      fighter.image = photo.url;
      fighter.photoCredit = photo.source;
      fighter.photoConsultedAt = photo.consultedAt;
    } else {
      const fallback = original.get(id);
      fighter.image = !variants.pendingNeutral && fallback.champion === champion ? fallback.image : '';
      fighter.photoCredit = 'UFC';
    }
  }
  return true;
}
export async function refreshFighterPhotos() {
  try {
    const response = await fetch(new URL('../data/fighter-photos.json', import.meta.url), {cache:'no-store'});
    if (!response.ok) return false;
    const feed = await response.json();
    if (feed.schemaVersion !== 1 || !feed.photos || typeof feed.photos !== 'object' || Array.isArray(feed.photos)) return false;
    if (Object.entries(feed.photos).some(([id, variants]) => !byId.has(id) || !variants || (variants.pendingNeutral !== undefined && typeof variants.pendingNeutral !== 'boolean') ||
        typeof variants !== 'object' || Array.isArray(variants) ||
        ['champion', 'regular'].some(key => variants[key] !== undefined && !validPhoto(variants[key])))) return false;
    snapshot = feed;
    return applyFighterPhotos();
  } catch { return false; }
}
