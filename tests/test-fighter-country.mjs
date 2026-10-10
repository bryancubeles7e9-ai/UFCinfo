import assert from 'node:assert/strict';
import { additionalFighters } from '../assets/js/fighter-directory-data.js';
import { countryBadge, countryLabel } from '../assets/js/fighter-country.js';

assert.equal(countryBadge({birthplace: 'Brazil'}), '');
assert.equal(countryBadge({country: 'Brazil'}), '');
assert.ok(!countryBadge({}).includes('UFC'));
assert.equal(countryLabel({code: 'BR', country: 'Brazil', countrySource: 'official'}), 'Brasil');
assert.equal(countryLabel({code: 'EN', country: 'England', countrySource: 'official'}, 'ca'), 'Anglaterra');
assert.ok(countryBadge({code: 'ES · GE', country: 'España / Georgia'}).includes('ES · GE'));
for (const fighter of additionalFighters) {
  if (!fighter.code) continue;
  assert.match(fighter.countrySource, /^https:\/\/www\.ufc\.com\/event\//);
  assert.ok(fighter.countryConsulted);
  assert.ok(countryBadge(fighter).includes(fighter.code));
}
console.log(`PASS: country labels, languages, missing data and ${additionalFighters.filter(f => f.code).length} verified sources`);
