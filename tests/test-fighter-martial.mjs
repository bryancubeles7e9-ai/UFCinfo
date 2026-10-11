import assert from 'node:assert/strict';
import { directoryFighters, additionalFighters } from '../assets/js/fighter-directory.js';
import { additionalFighters as originals } from '../assets/js/fighter-directory-data.js';
import { fighterMartialBases } from '../assets/js/fighter-martial-data.js';
import { martialDetails, compactMartialInfo, renderMartialDetails } from '../assets/js/fighter-martial.js';

assert.equal(additionalFighters[0], originals[0]);
for (const [id, data] of Object.entries(fighterMartialBases)) {
  const fighter = directoryFighters.find(f => f.id === id);
  assert.ok(fighter, `Unknown identity: ${id}`);
  assert.equal(martialDetails(fighter).label, data.martialBase);
  assert.match(data.martialBaseSource, /^https:\/\/www\.ufc\.com\/(athlete|news)\//);
  assert.ok(data.martialBaseNote.length > 20);
  assert.match(data.martialBaseConsulted, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(renderMartialDetails(fighter).includes(data.martialBaseSource));
  assert.ok(renderMartialDetails(fighter).includes(data.martialBaseConsulted));
  assert.ok(!compactMartialInfo(fighter).includes('undefined'));
}
for (const officialStyle of ['MMA', 'Freestyle', 'Brawler', 'Striker', null]) {
  assert.equal(martialDetails({ officialStyle }).kind, 'unknown');
}
assert.equal(martialDetails({ officialStyle: 'Boxing' }).label, 'Boxeo');
assert.ok(!renderMartialDetails({ martialBase: '<script>', martialBaseSource: 'javascript:bad' }).includes('<script>'));
assert.ok(!renderMartialDetails({ martialBase: 'Boxeo', martialBaseSource: 'javascript:bad' }).includes('href='));
const documented = directoryFighters.filter(f => martialDetails(f).kind !== 'unknown');
assert.equal(documented.length, 156);
console.log(`PASS: ${documented.length}/${directoryFighters.length} perfiles con formación o disciplina documentada`);
