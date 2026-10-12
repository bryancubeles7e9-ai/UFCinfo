import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { directoryFighterByName } from '../assets/js/fighter-directory.js';
import { synchronizeChampionships } from '../assets/js/fighter-championships.js';
import { refreshFighterPhotos, applyFighterPhotos } from '../assets/js/fighter-photos-feed.js';
const rankings = JSON.parse(await readFile(new URL('../assets/data/ufc-rankings.json', import.meta.url)));
const photos = JSON.parse(await readFile(new URL('../assets/data/fighter-photos.json', import.meta.url)));
synchronizeChampionships(rankings.categories, rankings);
globalThis.fetch = async () => ({ok:true,json:async()=>photos});
assert.equal(await refreshFighterPhotos(), true);
const natalia = directoryFighterByName('Natalia Silva'), valentina = directoryFighterByName('Valentina Shevchenko');
assert.equal(natalia.image, photos.photos.silva.champion.image || photos.photos.silva.champion.url);
assert.equal(valentina.image, photos.photos.shevchenko.regular.image || photos.photos.shevchenko.regular.url);
assert.equal(valentina.photoCredit, 'ESPN');
synchronizeChampionships([{id:'flyweight-women',champion:'Valentina Shevchenko'}], rankings);
applyFighterPhotos();
assert.equal(valentina.image, photos.photos.shevchenko.champion.image || photos.photos.shevchenko.champion.url);
assert.ok(!natalia.image.includes('BELT'));
synchronizeChampionships(rankings.categories, rankings);
applyFighterPhotos();
const before = natalia.image;
for (const url of ['https://evil.test/photo.png','javascript:alert(1)']) {
 const invalid=structuredClone(photos); invalid.photos.silva.champion.url=url;
 globalThis.fetch = async () => ({ok:true,json:async()=>invalid});
 assert.equal(await refreshFighterPhotos(),false);
 assert.equal(natalia.image,before);
}
globalThis.fetch = async () => {throw Error('offline');};
assert.equal(await refreshFighterPhotos(),false);
assert.equal(natalia.image,before);
console.log('PASS: champion/neutral photos follow rankings, regain title, valid sources, failure preservation');

// A BMF portrait is independent from the divisional ranking.
const max = directoryFighterByName('Max Holloway');
const bmfFeed = structuredClone(photos);
bmfFeed.photos[max.id] = {bmf: {url:'https://www.ufc.com/images/HOLLOWAY_BMF.png',source:'UFC',sourceUrl:max.source,consultedAt:'2026-10-12T00:00:00Z'}, regular:{url:'https://www.ufc.com/images/HOLLOWAY.png',source:'UFC',sourceUrl:max.source,consultedAt:'2026-10-12T00:00:00Z'}};
max.championships = [{name:'BMF',type:'special',status:'current'}];
globalThis.fetch = async () => ({ok:true,json:async()=>bmfFeed});
assert.equal(await refreshFighterPhotos(),true);
assert.match(max.image,/HOLLOWAY_BMF/);
max.championships[0].status='former';
applyFighterPhotos();
assert.match(max.image,/HOLLOWAY.png/);
const invalidPath=structuredClone(photos);
invalidPath.photos.silva.champion.image='assets/images/../../private.png';
globalThis.fetch = async () => ({ok:true,json:async()=>invalidPath});
assert.equal(await refreshFighterPhotos(),false);
console.log('PASS: BMF independent selection, neutral fallback, local path validation');
