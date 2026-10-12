import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { directoryFighterByName, directoryFighters } from '../assets/js/fighter-directory.js';
import { synchronizeChampionships, matchesChampionship } from '../assets/js/fighter-championships.js';
import { championshipBadge, renderChampionships } from '../assets/js/fighter-details.js';
const feed = JSON.parse(await readFile(new URL('../assets/data/ufc-rankings.json', import.meta.url)));
const bmf = directoryFighters.flatMap(f => (f.championships || []).filter(b => b.name === 'BMF'));
const beforeBMF = JSON.stringify(bmf);
synchronizeChampionships(feed.categories, feed);
const natalia = directoryFighterByName('Natalia Silva');
const valentina = directoryFighterByName('Valentina Shevchenko');
assert.ok(matchesChampionship(natalia, 'current'));
assert.ok(!matchesChampionship(valentina, 'current'));
assert.ok(matchesChampionship(valentina, 'former'));
assert.match(championshipBadge(natalia), /Campeona UFC/);
assert.match(championshipBadge(valentina), /Excampeona UFC/);
assert.match(renderChampionships(natalia), /Rankings oficiales UFC/);
for (const category of feed.categories.filter(c => !c.id.startsWith('p4p'))) {
 const champion = directoryFighterByName(category.champion);
 assert.ok(champion, category.champion);
 assert.ok(matchesChampionship(champion, 'current'), category.champion);
 assert.match(championshipBadge(champion), /Campe[oó]n/);
}
assert.equal(JSON.stringify(bmf), beforeBMF);
const previous = JSON.stringify(directoryFighters.map(f => f.championships));
synchronizeChampionships(feed.categories, feed);
assert.equal(JSON.stringify(directoryFighters.map(f => f.championships)), previous);
synchronizeChampionships([{id:'flyweight-women', champion:'Unknown athlete'}], feed);
assert.equal(JSON.stringify(directoryFighters.map(f => f.championships)), previous);
// A rematch changes current ownership without duplicating the historical belt.
synchronizeChampionships([{id:'flyweight-women', champion:'Valentina Shevchenko'}], feed);
assert.ok(matchesChampionship(valentina, 'current'));
assert.ok(!matchesChampionship(natalia, 'current'));
synchronizeChampionships(feed.categories, feed);
assert.equal(JSON.stringify(directoryFighters.map(f => f.championships)), previous);
console.log('PASS: 11 champions, Natalia/Valentina, supplemental badges, rematches, BMF preservation and idempotency');
