// Recent form: last results, streaks and the permanent fight history.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
globalThis.localStorage = { getItem() {}, setItem() {} };
const { indexHistory, useHistory, recentForm, currentStreak, formChips, recentFormSection } = await import('../assets/js/recent-form.js');
const { boutResult } = await import('../scripts/fight-results.mjs');

// Results from the red corner's point of view.
assert.equal(boutResult({ red: 'A', blue: 'B', winner: 'A' }), 'red');
assert.equal(boutResult({ red: 'A', blue: 'B', winner: 'B' }), 'blue');
assert.equal(boutResult({ red: 'A', blue: 'B', outcome: 'Empate' }), 'draw');
assert.equal(boutResult({ red: 'A', blue: 'B', method: 'Could Not Continue' }), 'nc');
assert.equal(boutResult({ red: 'A', blue: 'B' }), null);

const bouts = [
  { date: '2026-01-10T00:00:00Z', event: 'e1', title: 'UFC 1', red: 'Ana', blue: 'Bea', result: 'red' },
  { date: '2026-03-10T00:00:00Z', event: 'e2', title: 'UFC 2', red: 'Cris', blue: 'Ana', result: 'blue' },
  { date: '2026-05-10T00:00:00Z', event: 'e3', title: 'UFC 3', red: 'Ana', blue: 'Dani', result: 'red' },
  { date: '2026-07-10T00:00:00Z', event: 'e4', title: 'UFC 4', red: 'Eva', blue: 'Ana', result: 'draw' },
  { date: '2026-09-10T00:00:00Z', event: 'e5', title: 'UFC 5', red: 'Ana', blue: 'Fer', result: 'blue' },
  { date: '2026-11-10T00:00:00Z', event: 'e6', title: 'UFC 6', red: 'Ana', blue: 'Gil', result: 'nc' },
];
const index = indexHistory(bouts, () => null);
const ana = index.get('name:ana');
assert.deepEqual(ana.map(item => item.result), ['NC', 'L', 'D', 'W', 'W', 'W']);
assert.deepEqual(index.get('name:bea').map(item => item.result), ['L']);

useHistory(bouts);
const fighter = { id: 'nope', first: 'Ana', last: '' };
assert.deepEqual(recentForm(fighter).map(item => item.result), ['NC', 'L', 'D', 'W', 'W']);
// Going into a fight only counts earlier results.
assert.deepEqual(recentForm(fighter, { before: '2026-07-10T00:00:00Z' }).map(item => item.result), ['W', 'W', 'W']);
assert.deepEqual(currentStreak(recentForm(fighter, { before: '2026-07-10T00:00:00Z' })), { result: 'W', count: 3 });
assert.equal(currentStreak(recentForm(fighter)), null);   // A no contest ends the streak.
const chips = formChips(recentForm(fighter, { before: '2026-07-10T00:00:00Z' }));
assert.match(chips, /aria-label="Forma reciente: Victoria, Victoria, Victoria"/);
assert.equal((chips.match(/class="is-win"/g) || []).length, 3);
assert.match(recentFormSection({ id: 'x', first: 'Ana', last: '' }), /Forma reciente/);
assert.match(recentFormSection({ id: 'y', first: 'Nadie', last: '' }), /Sin combates registrados/);
assert.equal(formChips([]), '');

// The published file covers every completed result in the events feed and never loses one.
const history = JSON.parse(readFileSync(new URL('../assets/data/fight-history.json', import.meta.url)));
const feed = JSON.parse(readFileSync(new URL('../assets/data/ufc-events.json', import.meta.url)));
const keys = new Set(history.bouts.map(bout => `${bout.event}|${bout.red}|${bout.blue}`));
for (const event of feed.events.filter(e => e.status === 'completed' && e.type === 'official'))
  for (const bout of event.bouts) if (boutResult(bout)) assert.ok(keys.has(`${event.id}|${bout.red}|${bout.blue}`), `${event.id}: ${bout.red} vs ${bout.blue}`);
console.log(`PASS: forma reciente, rachas y historial permanente (${history.bouts.length} combates)`);
