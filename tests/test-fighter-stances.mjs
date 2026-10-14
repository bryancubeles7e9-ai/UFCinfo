import assert from 'node:assert/strict';
import { additionalFighters, directoryFighters } from '../assets/js/fighter-directory.js';
import { additionalFighters as raw } from '../assets/js/fighter-directory-data.js';
import { matchesStance, renderStanceDetails, stanceNames } from '../assets/js/fighter-details.js';

assert.equal(additionalFighters.length, raw.length);
assert.equal(additionalFighters[0], raw[0], 'refreshes must retain shared objects');
for (const fighter of additionalFighters) {
  if (!fighter.stance) {
    assert.match(renderStanceDetails(fighter), /No indicada/);
    assert.ok(!renderStanceDetails(fighter).includes("href="));
    continue;
  }
  assert.ok(stanceNames[fighter.stance], fighter.name);
  assert.ok(fighter.stanceSource.startsWith('https://'), fighter.name);
  const html = renderStanceDetails(fighter);
  assert.ok(html.includes(fighter.stanceSource));
  assert.ok(!html.includes('undefined'));
}
for (const stance of Object.keys(stanceNames)) {
  const matches = directoryFighters.filter(f => matchesStance(f, stance));
  assert.ok(matches.some(f => f.supplemental), stance);
  assert.ok(matches.every(f => f.stance === stance));
}
assert.match(renderStanceDetails({}), /No indicada/);
assert.ok(!renderStanceDetails({}).includes('href'));
assert.equal(matchesStance({}, 'Orthodox'), false);
assert.equal(matchesStance({}, 'all'), true);
assert.ok(!renderStanceDetails({stance:'Southpaw', stanceSource:'javascript:alert(1)'}).includes('href'));
console.log(`Guardias verificadas en ${directoryFighters.length} fichas; filtros y fuentes correctos.`);
