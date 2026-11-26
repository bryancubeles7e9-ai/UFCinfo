import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { directoryFighters, additionalFighters, directoryFighterByName, fighterNameLink } from '../assets/js/fighter-directory.js';
import { renderExtendedFighterInfo } from '../assets/js/fighter-info.js';

const rankings = JSON.parse(await readFile(new URL('../assets/data/ufc-rankings.json', import.meta.url)));
const events = JSON.parse(await readFile(new URL('../assets/data/ufc-events.json', import.meta.url)));
const names = [...rankings.categories.flatMap(c => [c.champion, ...c.names]), ...events.events.flatMap(e => e.bouts.flatMap(b => [b.red, b.blue]))].filter(Boolean);
for (const name of names) {
  const profile = directoryFighterByName(name);
  assert.ok(profile, `Missing profile: ${name}`);
  assert.ok(fighterNameLink(name).includes(`data-profile="${profile.id}"`));
}
assert.equal(new Set(directoryFighters.map(f => f.id)).size, directoryFighters.length);
assert.equal(directoryFighterByName("Lone’er Kavanagh"), directoryFighterByName("Lone'er Kavanagh"));
assert.equal(directoryFighterByName('Jiří Procházka'), directoryFighterByName('Jiri Prochazka'));
assert.equal(directoryFighterByName('Maurício Ruffy'), directoryFighterByName('Mauricio Ruffy'));
for (const f of additionalFighters) {
  assert.match(f.source, /^https:\/\/www\.ufc\.com\/athlete\//);
  assert.equal(f.consulted, f.info.consulted);
  assert.ok(f.record && f.division);
  // Automatic imports use the official UFC image; older profiles keep a local PNG copy.
  if (/^https:/.test(f.image)) assert.match(f.image, /^https:\/\/www\.ufc\.com\/images\//);
  else {
    const image = await readFile(new URL('../' + f.image, import.meta.url));
    // Local PNG portraits, or the Hall of Fame JPEG photo for legends without a UFC portrait.
    if (f.image.startsWith('assets/images/legends/')) assert.deepEqual([...image.subarray(0, 3)], [255, 216, 255]);
    // Official UFC photos stored on this site by scripts/localize-photos.py.
    else if (f.image.endsWith('.webp')) assert.equal(image.subarray(8, 12).toString(), 'WEBP');
    else assert.deepEqual([...image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  }
  for (const key of ['strikingDefense', 'takedownDefense', 'strikingAccuracy', 'takedownAccuracy']) {
    assert.ok(f.info[key] === null || (f.info[key] >= 0 && f.info[key] <= 100));
  }
  const rendered = renderExtendedFighterInfo(f);
  assert.ok(!rendered.includes('undefined') && !rendered.includes('NaN'));
}
const missing = directoryFighterByName('Jack Della Maddalena');
assert.equal(missing.info.strikesLanded, null);
assert.ok(renderExtendedFighterInfo(missing).includes('No indicado'));
assert.ok(renderExtendedFighterInfo({first: 'Prueba', info: {strikesLanded: 0, consulted: '2026-10-06', source: 'https://www.ufc.com'}}).includes('<dd>0</dd>'));
console.log(`PASS: ${directoryFighters.length} profiles, all rankings and event names linked, aliases, local or official photos, missing and zero values`);
