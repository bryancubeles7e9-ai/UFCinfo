import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
globalThis.localStorage = { getItem() {}, setItem() {} };
const { sortLegends, filterLegends, legendTagline, legendCard, legendsHallHeader, legendWing } = await import('../assets/js/legends-hall.js');
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

// Most recent inductees first; UFCinfo's own selection after the Hall of Fame.
const sorted = sortLegends(legends);
const years = sorted.map(f => f.hallOfFame?.inducted || 0).filter(Boolean);
assert.deepEqual(years, [...years].sort((a, b) => b - a));
assert.equal(legendWing(sorted.at(-1)), 'ufcinfo');
assert.equal(filterLegends(legends, 'pioneer').every(f => f.hallOfFame.wing === 'pioneer'), true);
assert.equal(filterLegends(legends, 'all').length, legends.length);

const gracie = byId.get('ufc-royce-gracie');
assert.equal(legendTagline(gracie), 'Salón de la Fama de UFC · Ala de pioneros · 2003');
assert.equal(legendTagline(byId.get('ufc-dustin-poirier')), 'Selección UFCinfo');
assert.equal(legendTagline(byId.get('ufc-robbie-lawler')), 'Salón de la Fama de UFC · Ala moderna');
const card = legendCard(byId.get('ufc-anderson-silva'));
assert.match(card, /data-profile="ufc-anderson-silva"/);
assert.match(card, /Peso medio/);
assert.match(card, /assets\/images\/legends\/ufc-anderson-silva\.jpg/);
const header = legendsHallHeader(legends, 'modern');
assert.match(header, /data-legend-wing="modern" aria-pressed="true"/);
assert.match(header, new RegExp(`<dd>${legends.length}</dd>`));
console.log(`PASS: ${legends.length} leyendas con foto, nota traducida, orden por año de ingreso y filtros por ala`);
