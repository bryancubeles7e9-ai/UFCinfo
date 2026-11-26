import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
globalThis.localStorage = { getItem() {}, setItem() {} };
const { sortLegends, filterLegends, legendTagline, legendCard, legendsHallHeader, legendWing, dailyLegends } = await import('../assets/js/legends-hall.js');
const { directoryFighters } = await import('../assets/js/fighter-directory.js');
const { isLegend } = await import('../assets/js/fighter-legacy.js');
const { legendNotes } = await import('../assets/js/i18n/legend-notes.js');

// Every reviewed legend is in the catalogue as a retired legend with its note, photo and translations.
const reviewed = JSON.parse(readFileSync(new URL('../docs/legends.json', import.meta.url)));
const byId = new Map(directoryFighters.map(f => [f.id, f]));
for (const legend of reviewed) {
  const fighter = byId.get(legend.id);
  assert.ok(fighter, `Falta en el catálogo: ${legend.name}`);
  assert.ok(isLegend(fighter), `${legend.name} no aparece como leyenda retirada`);
  assert.equal(fighter.legacyNote, legend.note);
  assert.equal(fighter.hallOfFame.wing, legend.wing);
  assert.ok(!/placeholder/.test(fighter.image), `${legend.name} no tiene foto`);
  assert.ok(legendNotes.en[legend.note] && legendNotes.ca[legend.note], `Falta traducir la nota de ${legend.name}`);
}
const legends = directoryFighters.filter(isLegend);
assert.ok(legends.length >= 40);

// UFCinfo's recent retirements first, then the Hall of Fame by induction year.
const sorted = sortLegends(legends);
const years = sorted.map(f => f.hallOfFame?.inducted || 0).filter(Boolean);
assert.deepEqual(years, [...years].sort((a, b) => b - a));
assert.equal(legendWing(sorted[0]), 'ufcinfo');
assert.ok(sorted.slice(0, 2).every(f => legendWing(f) === 'ufcinfo'));
assert.equal(filterLegends(legends, 'pioneer').every(f => f.hallOfFame.wing === 'pioneer'), true);
assert.equal(filterLegends(legends, 'all').length, legends.length);

const gracie = byId.get('ufc-royce-gracie');
assert.equal(legendTagline(gracie), 'Salón de la Fama de UFC · Ala de pioneros · 2003');
assert.equal(legendTagline(byId.get('ufc-dustin-poirier')), 'Selección UFCinfo · Retiro en 2025');
const jones = byId.get('ufc-jon-jones');
assert.ok(isLegend(jones) && jones.championships.length === 2);
assert.match(legendCard(jones), /Campeón más joven de la historia de UFC/);
assert.equal(legendTagline(byId.get('ufc-robbie-lawler')), 'Salón de la Fama de UFC · Ala moderna');
const card = legendCard(byId.get('ufc-anderson-silva'));
assert.match(card, /data-profile="ufc-anderson-silva"/);
assert.match(card, /Peso medio/);
assert.match(card, /assets\/images\/legends\/ufc-anderson-silva\.jpg/);
const header = legendsHallHeader(legends, 'modern');
assert.match(header, /data-legend-wing="modern" aria-pressed="true"/);
assert.match(header, new RegExp(`<dd>${legends.length}</dd>`));
// Home page: three different legends per day, the same all day, and a different set the next day.
const today = dailyLegends(legends, new Date(2026, 10, 26, 9)), later = dailyLegends(legends, new Date(2026, 10, 26, 23));
assert.equal(new Set(today.map(f => f.id)).size, 3);
assert.deepEqual(today.map(f => f.id), later.map(f => f.id));
assert.notDeepEqual(dailyLegends(legends, new Date(2026, 10, 27, 9)).map(f => f.id), today.map(f => f.id));
console.log(`PASS: ${legends.length} leyendas con foto, nota traducida, orden por año de ingreso y filtros por ala`);
