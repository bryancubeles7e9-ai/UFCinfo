import assert from 'node:assert/strict';
import {automaticFeed,isBoxingPost} from '../scripts/rumor-auto-feed.mjs';
import {catalogMatchup} from '../scripts/rumor-fighter-names.mjs';
const sources=[{id:'test',name:'Test reporter',handle:'test',language:'en',profile:'https://x.com/test'}];
const now=new Date('2026-10-08T12:00:00Z');
let id=2200000000000000000n;
const candidate=text=>({id:String(id++),sourceId:'test',postUrl:'',publishedAt:'2026-10-08T08:00:00Z',language:'en',text});
function filter(text,previous) {
 const report=candidate(text);report.postUrl=`https://x.com/test/status/${report.id}`;
 return automaticFeed({checkedAt:now.toISOString(),candidates:[report]},sources,previous,now);
}
for (const text of ['ilia topuria vs max holloway is targeted','TOPURIA vs HOLLOWAY is targeted','Topuria vs Holloway is targeted for UFC','Ian Garry vs Michael Morales is targeted','Ilia Topuria is in talks for a fight against Max Holloway','Mansur Abdul-Malik vs Sean Strickland is targeted']) {
 const result=filter(text);
 assert.equal(result.added,1,text);
 assert.equal(result.feed.groups[0].official,null);
 assert.equal(result.feed.groups[0].eventDateHint,null);
}
assert.deepEqual(filter('topuria vs holloway is targeted').feed.groups[0].fighterNames,['Ilia Topuria','Max Holloway']);
assert.deepEqual(filter('Ian Garry vs Michael Morales is targeted').feed.groups[0].fighterNames,['Ian Machado Garry','Michael Morales']);
// Names not yet in the directory are retained only for an explicit prospective UFC report.
assert.equal(filter('Hecher Sosa vs Abdul Hussein is targeted for UFC on November 28').added,1);
for(const [text,reason] of [
 ['Random Person vs Another Person','unverified-fighters'],
 ['Hecher Sosa vs Abdul Hussein is targeted','unverified-fighters'],
 ['Breaking News vs Main Event is targeted for UFC','unverified-fighters'],
 ['Ilia Topuria vs Max Holloway: who wins?','opinion'],
 ['Ojalá Ilia Topuria vs Max Holloway','opinion'],
 ['Ilia Topuria vs Max Holloway highlights','past-result'],
 ['Ilia Topuria vs Max Holloway is targeted for PFL','other-promotion'],
 ['Ilia Topuria vs Max Holloway in a boxing match','boxing'],
 ['UFC announces Ilia Topuria vs Max Holloway','official-announcement'],
 ['Ilia Topuria vs Max Holloway confirmed by UFC','official-announcement'],
 ['Ilia Topuria vs Max Holloway is targeted for UFC on February 30, 2027','invalid-event-date'],
 ['Ilia Topuria vs Max Holloway is targeted for UFC on October 1, 2026','past-event'],
 ['Ilia Topuria vs Max Holloway is targeted for UFC on November 28, 2027','event-too-far-ahead'],
 ['Ilia Topuria vs Ilia Topuria','fighters-not-detected'],
 ['Ilia Topuria vs Max Holloway; Alex Pereira vs Sean Strickland','fighters-not-detected'],
]) {const result=filter(text);assert.equal(result.added,0,text);assert.ok(result.skipReasons[reason],`${reason}: ${text}`);}
assert.equal(catalogMatchup('Alex Pereira and Sean Strickland train together'),null);
// A mention of boxing as an MMA skill is not automatically a boxing event.
assert.equal(isBoxingPost('Ilia Topuria vs Max Holloway targeted for UFC: su boxeo será clave'),false);
assert.equal(isBoxingPost('UFC star Ilia Topuria vs Max Holloway in a boxing match'),true);
// Retain fighter statements as claims, never official announcements.
assert.equal(filter('Ian Garry reveals he agreed to a fight with Michael Morales').added,1);
assert.equal(filter('Ilia Topuria vs Max Holloway targeted; not confirmed by UFC').added,1);
assert.equal(filter('Ilia Topuria vs Max Holloway targeted; aún no está confirmado por UFC').added,1);
const first=filter('topuria vs holloway targeted for UFC on November 28');
const duplicate=filter('Ilia Topuria vs Max Holloway targeted for UFC on November 28',first.feed);
assert.equal(duplicate.feed.groups.length,1);
assert.equal(duplicate.feed.groups[0].reports.length,2);
assert.equal(filter('Ilia Topuria vs Max Holloway targeted for UFC on December 28',duplicate.feed).feed.groups.length,2);
console.log('PASS: canonical identities, aliases, prospects, ambiguity, wishes, results, other promotions, official announcements, dates and deduplication');
