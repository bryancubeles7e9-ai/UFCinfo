import { officialEvents } from './official-events.js';

export const eventsFeed = {
  events: officialEvents,
  source: 'UFC',
  sourceUrl: 'https://www.ufc.com',
  synchronizedAt: '2026-10-05T00:00:00Z',
  automatic: false,
  unavailable: false,
};
let updating = false;

function validEvent(event, year) {
  return event && event.type === 'official' && ((Number.isInteger(event.number) && event.id === `ufc-${event.number}` && (!event.eventKind || event.eventKind === 'numbered')) || (event.number === null && event.eventKind === 'fight-night' && /^ufc-fight-night-[a-z]+-\d{2}-\d{4}$/.test(event.id)) || (event.number === null && event.eventKind === 'special' && event.id === 'ufc-freedom-250')) &&
    event.source === `https://www.ufc.com/event/${event.id}` &&
    ['title', 'subtitle', 'location', 'date', 'checkedAt'].every(k => typeof event[k] === 'string') &&
    Number.isFinite(Date.parse(event.date)) &&
    ['completed', 'announced', 'scheduled', 'live'].includes(event.status || 'completed') &&
    ((event.status || 'completed') !== 'completed' || new Date(event.date).getUTCFullYear() === year) &&
    (event.poster == null || event.poster === `assets/images/events/${event.id}.jpg`) &&
    (event.posterAlt == null || typeof event.posterAlt === 'string') &&
    Array.isArray(event.bouts) && ((event.status || 'completed') !== 'completed' || event.bouts.length > 0) && event.bouts.length <= 30 &&
    event.bouts.every(b => b && ['red', 'blue', 'division', 'method', 'round', 'time'].every(k => typeof b[k] === 'string') && b.red && b.blue &&
      (b.winner === null || b.winner === b.red || b.winner === b.blue) &&
      (b.outcome == null || typeof b.outcome === 'string'));
}

export async function refreshEvents() {
  if (updating) return false;
  updating = true;
  let timer;
  try {
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(new URL('../data/ufc-events.json', import.meta.url), { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error('Feed unavailable');
    const feed = await response.json();
    if (feed.schemaVersion !== 1 || !Number.isInteger(feed.year) || !Array.isArray(feed.events) || feed.events.length > 100 ||
        !['UFC', 'UFCalendar'].includes(feed.source) ||
        feed.sourceUrl !== (feed.source === 'UFCalendar' ? 'https://www.ufcalendar.com' : 'https://www.ufc.com') ||
        (feed.synchronizedAt !== null && (typeof feed.synchronizedAt !== 'string' || !Number.isFinite(Date.parse(feed.synchronizedAt)))) ||
        (feed.source === 'UFCalendar' && !feed.synchronizedAt) ||
        !feed.events.every(e => validEvent(e, feed.year)) || new Set(feed.events.map(e => e.id)).size !== feed.events.length) throw new Error('Invalid feed');
    eventsFeed.events = feed.events;
    eventsFeed.source = feed.source;
    eventsFeed.sourceUrl = feed.sourceUrl;
    eventsFeed.synchronizedAt = feed.synchronizedAt || eventsFeed.synchronizedAt;
    eventsFeed.automatic = feed.source === 'UFCalendar';
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
