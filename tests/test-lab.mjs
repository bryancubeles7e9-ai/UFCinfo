import assert from 'node:assert/strict';
import { directoryFighters, directoryFighterByName } from '../assets/js/fighter-directory.js';
import { comparisonGroups, renderComparison, initializeLab } from '../assets/js/lab.js';
import { fighterInfo } from '../assets/js/fighter-info-data.js';

const topuria = directoryFighterByName('Ilia Topuria');
const holloway = directoryFighterByName('Max Holloway');
const jack = directoryFighterByName('Jack Della Maddalena');
const van = directoryFighterByName('Joshua Van');
const groups = comparisonGroups(topuria, holloway);
assert.equal(groups.length, 5);
assert.equal(groups.flatMap(g => g.rows).length, 27);
const strike = groups.find(g => g.title === 'Golpeo').rows[0];
assert.equal(strike.red, '4,82');
assert.equal(strike.blue, new Intl.NumberFormat('es-ES').format(fighterInfo.holloway.strikesLanded));
const reversed = comparisonGroups(holloway, topuria).flatMap(g => g.rows);
groups.flatMap(g => g.rows).forEach((row, i) => {
  assert.equal(row.red, reversed[i].blue);
  assert.equal(row.blue, reversed[i].red);
});
const missing = comparisonGroups(jack, van).flatMap(g => g.rows);
assert.equal(missing.find(r => r.label.startsWith('Golpes significativos conectados')).red, 'No indicado');
assert.equal(missing.find(r => r.label.startsWith('Cinturones')).red, 'No documentado en esta ficha');
const zero = comparisonGroups({...van, info: {...van.info, strikesLanded: 0}}, topuria);
assert.equal(zero.find(g => g.title === 'Golpeo').rows[0].red, '0');
for (const fighter of directoryFighters) {
  const html = renderComparison(topuria, fighter);
  assert.ok(!html.includes('undefined') && !html.includes('NaN'));
  assert.equal((html.match(/scope="row"/g) || []).length, 27);
}

const elements = new Map();
for (const id of ['red-fighter','blue-fighter','swap-fighters','comparison-status','lab-fighter-summaries','comparison-tables','comparison-notes']) {
  elements.set('#'+id, {value:'', innerHTML:'', handlers:{}, addEventListener(event, fn) {this.handlers[event]=fn;}});
}
globalThis.document = {querySelector: selector => elements.get(selector), addEventListener() {}};
const lab = initializeLab();
assert.equal((elements.get('#red-fighter').innerHTML.match(/<option /g) || []).length, 165);
lab.compare(jack.id, van.id);
assert.ok(elements.get('#comparison-tables').innerHTML.includes('No indicado'));
elements.get('#swap-fighters').handlers.click();
assert.equal(elements.get('#red-fighter').value, van.id);
lab.compare(van.id, van.id);
assert.equal(elements.get('#comparison-tables').innerHTML, '');
assert.equal(elements.get('#comparison-notes').hidden, true);
lab.load({red:topuria.id, blue:holloway.id, weights:[60,60,60,60,60], note:'Old saved analysis'});
assert.equal(elements.get('#red-fighter').value, topuria.id);
assert.ok(elements.get('#comparison-tables').innerHTML.includes('Golpeo'));
console.log('PASS: 165 fighters, 27 official facts, missing and zero values, swapping, same-fighter prompt, historical comparisons');
