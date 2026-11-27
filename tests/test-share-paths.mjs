import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
globalThis.localStorage = { getItem() {}, setItem() {} };
const { shareUrl, pathSlug, fighterPath, fighterIdFromSlug, eventPath, rankingPath, parseSharePath } = await import('../assets/js/share-paths.js');
const { rankingCategories } = await import('../assets/js/rankings.js');
const { directoryFighters, directoryFighterByName } = await import('../assets/js/fighter-directory.js');
const { boutShareUrl } = await import('../assets/js/bout-links.js');

assert.equal(pathSlug('Joanna Jędrzejczyk'), 'joanna-jedrzejczyk');
assert.equal(pathSlug('  José   Aldo! '), 'jose-aldo');
assert.equal(fighterPath(directoryFighterByName('Ilia Topuria')), '/luchadores/ilia-topuria');
assert.equal(eventPath({ id: 'ufc-335' }), '/carteleras/ufc-335');
// Every fighter has a unique address that leads back to the same profile.
const paths = directoryFighters.map(fighterPath);
assert.equal(new Set(paths).size, directoryFighters.length);
for (const f of directoryFighters) assert.equal(fighterIdFromSlug(fighterPath(f).split('/').pop()), f.id);
assert.deepEqual(parseSharePath('/luchadores/ilia-topuria'), { kind: 'fighter', slug: 'ilia-topuria' });
assert.deepEqual(parseSharePath('/carteleras/ufc-335/'), { kind: 'event', slug: 'ufc-335' });
for (const bad of ['/', '/luchadores/', '/luchadores/Ilia', '/luchadores/a/b', '/otra/x', '/luchadores/<script>']) assert.equal(parseSharePath(bad), null, bad);
// Bout links always point at the home page, even when a profile address is open.
const url = boutShareUrl({ id: 'ufc-335' }, { red: 'Charles Oliveira', blue: 'Diego Lopes' }, 'https://ufcinfo.example/luchadores/ilia-topuria#luchadores');
assert.match(url, /^https:\/\/ufcinfo\.example\/#eventos\?evento=ufc-335&combate=/);
// The server's index covers every fighter address.
const index = JSON.parse(readFileSync(new URL('../assets/data/share-index.json', import.meta.url)));
assert.equal(Object.keys(index.fighters).length, directoryFighters.length);
assert.match(index.fighters['ilia-topuria'].title, /^Ilia Topuria/);
assert.ok(index.events['ufc-335'].image);
assert.deepEqual(parseSharePath('/rankings/peso-ligero'), { kind: 'ranking', slug: 'peso-ligero' });
const rankingPaths = rankingCategories.map(rankingPath);
assert.equal(new Set(rankingPaths).size, rankingCategories.length);
assert.ok(rankingPaths.includes('/rankings/peso-ligero') && rankingPaths.includes('/rankings/peso-paja-femenino') && rankingPaths.includes('/rankings/libra-por-libra-masculino'));
assert.equal(Object.keys(index.rankings).length, rankingCategories.length);
// Links shared from English or Catalan carry the language for their preview; Spanish ones stay clean.
assert.equal(shareUrl('/luchadores/ilia-topuria', 'es', 'https://ufcinfo.example'), 'https://ufcinfo.example/luchadores/ilia-topuria');
assert.equal(shareUrl('/luchadores/ilia-topuria', 'en', 'https://ufcinfo.example'), 'https://ufcinfo.example/luchadores/ilia-topuria?lang=en');
assert.equal(shareUrl('/rankings/peso-ligero', 'ca', 'https://ufcinfo.example'), 'https://ufcinfo.example/rankings/peso-ligero?lang=ca');
for (const section of ['fighters', 'events', 'rankings']) for (const [slug, entry] of Object.entries(index[section]))
  for (const lang of ['en', 'ca']) assert.ok(entry[lang]?.title && entry[lang]?.description, `${section}/${slug} ${lang}`);
console.log(`PASS: ${paths.length} direcciones de luchador únicas, veladas, rutas no válidas rechazadas y enlaces de combate en la portada`);
