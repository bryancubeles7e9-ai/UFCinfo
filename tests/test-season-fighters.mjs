import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {directoryFighters, directoryFighterByName, fighterNameLink} from '../assets/js/fighter-directory.js';
import {renderExtendedFighterInfo} from '../assets/js/fighter-info.js';
const feed=JSON.parse(readFileSync(new URL('../assets/data/ufc-events.json',import.meta.url)));
const names=new Set(feed.events.filter(e=>e.status==='completed' && new Date(e.date).getUTCFullYear()===feed.year).flatMap(e=>e.bouts.flatMap(b=>[b.red,b.blue])));
for(const name of names){
 const f=directoryFighterByName(name);
 assert.ok(f,`Missing season participant: ${name}`);
 assert.ok(fighterNameLink(name).includes(`data-profile="${f.id}"`));
 assert.match(f.record,/^\d+-\d+-\d+$/);
 assert.match(f.source,/^https:\/\/www\.ufc\.com\/athlete\//);
 assert.ok(!/undefined|NaN/.test(renderExtendedFighterInfo(f)));
}
assert.equal(new Set(directoryFighters.map(f=>f.id)).size,directoryFighters.length);
console.log(`PASS: ${names.size} season names resolve to verified profiles; ${directoryFighters.length} unique profiles`);
