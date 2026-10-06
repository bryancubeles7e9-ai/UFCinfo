import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { directoryFighterByName, fighterNameLink } from '../assets/js/fighter-directory.js';
import { escapeHTML } from '../assets/js/utils.js';
globalThis.rankingDirectory = { directoryFighterByName, fighterNameLink };
let code = await readFile(new URL('../assets/js/rankings.js', import.meta.url), 'utf8');
code = code.replace(/^import .*;\n/gm, '').replace("new URL('../data/ufc-rankings.json', import.meta.url)", "new URL('https://example.test/rankings.json')");
code = "const {directoryFighterByName, fighterNameLink} = globalThis.rankingDirectory; const getLocale = () => 'es-ES'; const fighters = []; const esc = s => s; const $ = s => globalThis.rankingElements.get(s); const document = {addEventListener() {}}; const setInterval = () => {};\n" + code;
const { refreshRankings, rankingCategories, rankingSnapshot, initializeRankings } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const feed = JSON.parse(await readFile(new URL('../assets/data/ufc-rankings.json', import.meta.url)));
let options;
globalThis.fetch = async (_, opts) => { options = opts; return {ok: true, json: async () => feed}; };
assert.equal(await refreshRankings(), true);
assert.equal(options.cache, 'no-store');
assert.equal(rankingSnapshot.synchronizedAt, feed.synchronizedAt);
const previous = JSON.stringify(rankingCategories);
for (const mutate of [f => f.categories.pop(), f => f.categories[0].names[0] = '', f => f.categories[0].ranks[0] = 99, f => f.categories[0].ranks[1] = 5, f => f.source = 'https://example.test', f => f.synchronizedAt = 'invalid']) {
  const invalid = structuredClone(feed); mutate(invalid);
  globalThis.fetch = async () => ({ok: true, json: async () => invalid});
  assert.equal(await refreshRankings(), false);
  assert.equal(JSON.stringify(rankingCategories), previous);
}
globalThis.fetch = async () => { throw Error('Unavailable'); };
assert.equal(await refreshRankings(), false);
assert.equal(JSON.stringify(rankingCategories), previous);
const changed = structuredClone(feed);
changed.categories[0].names[0] = 'New leader';
globalThis.fetch = async () => ({ok: true, json: async () => changed});
assert.equal(await refreshRankings(), true);
assert.equal(rankingCategories[0].names[0], 'New leader');
console.log('PASS: rankings refresh, validation, preservation on failure, recovery');

assert.equal(rankingCategories.length, 13);
assert.equal(rankingCategories.filter(c => !c.id.startsWith('p4p-')).length, 11);
const elements = new Map();
globalThis.rankingElements = elements;
for (const selector of ['#ranking-category', '#ranking-source-date', '#ranking-search', '#ranking-local-only', '#ranking-category-title', '#ranking-category-description', '#ranking-leader', '#ranking-result-count', '#ranking-table-body', '#ranking-table', '#ranking-empty', '#ranking-clear']) {
  elements.set(selector, {value: '', checked: false, listeners: {}, addEventListener(type, callback) { this.listeners[type] = callback; }});
}
initializeRankings();
assert.equal((elements.get('#ranking-category').innerHTML.match(/<option /g) || []).length, 13);
for (const category of rankingCategories) {
  elements.get('#ranking-category').value = category.id;
  elements.get('#ranking-category').listeners.change();
  assert.equal(elements.get('#ranking-category-title').textContent, category.label);
  assert.equal(elements.get('#ranking-table').hidden, false);
  for (const name of category.names) assert.ok(elements.get('#ranking-table-body').innerHTML.includes(escapeHTML(name)));
}
assert.equal((elements.get('#ranking-table-body').innerHTML.match(/>03<\/span>/g) || []).length, 2);
console.log('PASS: all 13 dropdown categories render, including official tied positions');
