import { officialEvents } from './official-events.js';

export const eventsFeed = {
  events: officialEvents,
  source: 'UFC',
  sourceUrl: 'https://www.ufc.com',
  synchronizedAt: '2026-10-05T00:00:00Z',
  automatic: false,
  unavailable: false,
  year: new Date().getUTCFullYear(),
};
let updating = false;

function validEvent(event, year) {
  return event && event.type === 'official' && ((Number.isInteger(event.number) && event.id === `ufc-${event.number}` && (!event.eventKind || event.eventKind === 'numbered')) || (event.number === null && event.eventKind === 'fight-night' && /^ufc-fight-night-[a-z]+-\d{2}-\d{4}$/.test(event.id)) || (event.number === null && event.eventKind === 'special' && event.id === 'ufc-freedom-250')) &&
    event.source === `https://www.ufc.com/event/${event.id}` &&
    ['title', 'subtitle', 'location', 'date', 'checkedAt'].every(k => typeof event[k] === 'string') &&
    Number.isFinite(Date.parse(event.date)) &&
    ['completed', 'announced', 'scheduled', 'live', 'cancelled', 'postponed'].includes(event.status || 'completed') &&
    ((event.status || 'completed') !== 'completed' || new Date(event.date).getUTCFullYear() === year) &&
    (event.poster == null || event.poster === `assets/images/events/${event.id}.jpg`) &&
    (event.posterAlt == null || typeof event.posterAlt === 'string') &&
    Array.isArray(event.bouts) && ((event.status || 'completed') !== 'completed' || event.bouts.length > 0) && event.bouts.length <= 30 &&
    event.bouts.every(b => b && ['red', 'blue', 'division', 'method', 'round', 'time'].every(k => typeof b[k] === 'string') && b.red && b.blue &&
      (b.winner === null || b.winner === b.red || b.winner === b.blue) &&
      (b.scheduledRounds == null || [3,5].includes(b.scheduledRounds)) &&
      (b.section == null || ['main', 'prelims', 'early-prelims'].includes(b.section)) &&
      (b.outcome == null || typeof b.outcome === 'string'));
}

export async function refreshEvents() {
  if (updating) return false;
  updating = true;
  let timer;
  try {
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(new URL('../data/ufc-events.json', import.meta.url), { cache:'no-cache', signal: controller.signal });
    if (!response.ok) throw new Error('Feed unavailable');
    const feed = await response.json();
    if (feed.schemaVersion !== 1 || !Number.isInteger(feed.year) || !Array.isArray(feed.events) || feed.events.length > 100 ||
        !['UFC', 'UFCalendar', 'Cito', 'Cito + UFCalendar'].includes(feed.source) ||
        feed.sourceUrl !== (feed.source.startsWith('Cito') ? 'https://citoapi.com/ufc-api/' : feed.source === 'UFCalendar' ? 'https://www.ufcalendar.com' : 'https://www.ufc.com') ||
        (feed.synchronizedAt !== null && (typeof feed.synchronizedAt !== 'string' || !Number.isFinite(Date.parse(feed.synchronizedAt)))) ||
        (feed.source !== 'UFC' && !feed.synchronizedAt) ||
        !feed.events.every(e => validEvent(e, feed.year)) || new Set(feed.events.map(e => e.id)).size !== feed.events.length) throw new Error('Invalid feed');
    // Keep inactive cards in the source archive, out of upcoming cards/Fight Lab.
    eventsFeed.events = feed.events.filter(e => !['cancelled', 'postponed'].includes(e.status));
    eventsFeed.year = feed.year;
    eventsFeed.source = feed.source;
    eventsFeed.sourceUrl = feed.sourceUrl;
    eventsFeed.synchronizedAt = feed.synchronizedAt || eventsFeed.synchronizedAt;
    eventsFeed.automatic = feed.source !== 'UFC' || Boolean(feed.scheduleVerification?.verifiedIds?.length);
    eventsFeed.unavailable = false;
    return true;
  } catch {
    eventsFeed.unavailable = true;
    return false;
  } finally {
    clearTimeout(timer);
    updating = false;
  }
}

// Past seasons (assets/data/ufc-events-archive.json, written by scripts/import-history-year.py).
// Loaded only when a visitor picks a past season in Carteleras or opens a link to one of its cards.
export const archiveSeasons = [2025];
const archivedById = new Map();
const archivedBySeason = new Map();
let archiveLoading = null;
export function loadEventArchive() {
  archiveLoading ??= fetch(new URL('../data/ufc-events-archive.json', import.meta.url), { cache: 'no-cache' })
    .then(response => (response.ok ? response.json() : null))
    .then(data => {
      if (data?.schemaVersion !== 1 || !data.seasons || typeof data.seasons !== 'object') throw new Error('Invalid archive');
      for (const [season, content] of Object.entries(data.seasons)) {
        const year = Number(season);
        const events = (Array.isArray(content?.events) ? content.events : []).filter(e => e?.status === 'completed' && validEvent(e, year));
        archivedBySeason.set(year, events.sort((a, b) => Date.parse(b.date) - Date.parse(a.date)));
        for (const event of events) archivedById.set(event.id, event);
      }
      return true;
    })
    .catch(() => { archiveLoading = null; return false; });
  return archiveLoading;
}
export const archiveLoaded = () => archivedBySeason.size > 0;
export const archivedEvents = year => archivedBySeason.get(year) || [];
export const archivedEvent = id => archivedById.get(id) || null;
