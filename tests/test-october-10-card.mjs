import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { directoryFighterByName, fighterNameLink } from '../assets/js/fighter-directory.js';

const names = ['Brendan Allen', 'Christian Leroy Duncan', 'Matheus Camilo', 'Jai Herbert', 'Loopy Godinez', 'Ketlen Souza', 'Andre Fili', 'Kai Kamaka III', 'Malcolm Wellmaker', 'Otari Tanzilovi'];
const ids = new Set();
for (const name of names) {
  const fighter = directoryFighterByName(name);
  assert.ok(fighter, `Missing profile: ${name}`);
  ids.add(fighter.id);
  assert.match(fighter.record, /^\d+-\d+-\d+$/);
  assert.match(fighter.source, /^https:\/\/www\.ufc\.com\/athlete\//);
  assert.ok(fighterNameLink(name).includes(`data-profile="${fighter.id}"`));
  const photo = await readFile(new URL('../' + fighter.image, import.meta.url));
  assert.deepEqual([...photo.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  for (const key of ['strikesLanded', 'strikesAbsorbed', 'takedownAverage', 'submissionAverage']) {
    assert.ok(Number.isFinite(fighter.info[key]), `${name}: ${key}`);
  }
}
assert.equal(ids.size, 10);
console.log('PASS: all 10 main-card fighters have unique profiles, photos, records, sources and core statistics');
