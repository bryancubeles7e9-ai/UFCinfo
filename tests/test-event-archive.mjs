// Past seasons in Carteleras: the archive loads on demand and only accepts valid finished cards.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
globalThis.localStorage = { getItem() {}, setItem() {} };
const card = (id, number, date, extra = {}) => ({ id, number, eventKind: number ? 'numbered' : 'fight-night', title: number ? `UFC ${number}` : 'UFC Fight Night',
  subtitle: 'A vs B', status: 'completed', date, location: 'Arena, City Country', type: 'official', source: `https://www.ufc.com/event/${id}`,
  checkedAt: '2026-11-27', poster: null, posterAlt: null,
  bouts: [{ red: 'A', blue: 'B', section: 'main', division: 'Lightweight Bout', winner: 'A', outcome: null, method: 'KO/TKO', round: '1', time: '1:00' }], ...extra });
const fixture = { schemaVersion: 1, source: 'UFC', seasons: { 2025: { events: [
  card('ufc-311', 311, '2025-01-18T23:00:00+00:00'),
  card('ufc-fight-night-march-08-2025', null, '2025-03-08T23:00:00+00:00'),
  card('ufc-312', 312, '2026-02-08T23:00:00+00:00'),                       // Wrong season: rejected.
  card('ufc-313', 313, '2025-03-08T23:00:00+00:00', { status: 'announced' }), // Not finished: rejected.
] } } };
let requests = 0;
globalThis.fetch = async () => { requests++; return { ok: true, json: async () => fixture }; };
const feed = await import('../assets/js/events-feed.js');
assert.equal(feed.archiveLoaded(), false);
assert.equal(requests, 0, 'Nothing is downloaded until a past season is needed');
assert.equal(await feed.loadEventArchive(), true);
await feed.loadEventArchive();
assert.equal(requests, 1, 'Loaded once');
assert.deepEqual(feed.archivedEvents(2025).map(e => e.id), ['ufc-fight-night-march-08-2025', 'ufc-311']);
assert.equal(feed.archivedEvent('ufc-311').title, 'UFC 311');
assert.equal(feed.archivedEvent('ufc-312'), null);
assert.ok(feed.archiveSeasons.includes(2025));

// The published archive (written by scripts/import-history-year.py) passes the same checks.
const path = new URL('../assets/data/ufc-events-archive.json', import.meta.url);
if (existsSync(path)) {
  const archive = JSON.parse(readFileSync(path));
  for (const [year, season] of Object.entries(archive.seasons)) {
    assert.ok(feed.archiveSeasons.includes(Number(year)), `Season ${year} listed in archiveSeasons`);
    assert.ok(season.events.length >= 30, `${year}: ${season.events.length} cards`);
    for (const event of season.events) assert.equal(new Date(event.date).getUTCFullYear(), Number(year), event.id);
  }
}
console.log('PASS: archivo de temporadas anteriores bajo demanda y validado');
