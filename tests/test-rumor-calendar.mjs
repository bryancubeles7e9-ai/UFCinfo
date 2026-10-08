import assert from 'node:assert/strict';
import {confirmedCalendar} from '../scripts/confirmed-rumor-matchups.mjs';
import {automaticFeed} from '../scripts/rumor-auto-feed.mjs';
import {syncRumors} from '../scripts/sync-rumors.mjs';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const feed={schemaVersion:1,source:'UFCalendar',sourceUrl:'https://www.ufcalendar.com',synchronizedAt:'2026-10-08T10:00:00Z',events:[{id:'ufc-335',type:'official',status:'announced',source:'https://www.ufc.com/event/ufc-335',date:'2026-12-13T02:00:00Z',bouts:[{red:'Ilia Topuria',blue:'Max Holloway'},{red:'Ian Garry',blue:'Michael Morales'}]}]};
const record={fighterNames:['Max Holloway','Ilia Topuria'],publishedAt:'2026-10-08T08:00:00Z',eventDateHint:null};
const calendar=confirmedCalendar(feed);
assert.equal(calendar.match(record).eventId,'ufc-335');
assert.ok(calendar.match({...record,fighterNames:['Ian Machado Garry','Michael Morales']}));
assert.ok(calendar.match({...record,fighterNames:['topuria','holloway']}));
assert.equal(calendar.match({...record,fighterNames:['Ilia Topuria','Michael Morales']}),null);
assert.equal(calendar.match({...record,publishedAt:'2027-01-01T00:00:00Z'}),null);
assert.equal(calendar.match({...record,eventDateHint:'2026-11-21'}),null);
assert.ok(calendar.match({...record,eventDateHint:'2026-12-12'}));
assert.equal(calendar.match({...record,eventDateHint:'2026-02-30'}),null);
assert.equal(calendar.match({...record,eventId:'ufc-336'}),null);
assert.equal(calendar.match({...record,publishedAt:'invalid'}),null);
for(const mutate of [f=>f.events[0].type='demo',f=>f.events[0].source='https://example.com',f=>f.events[0].date='invalid',f=>f.sourceUrl='https://example.com',f=>f.events[0].bouts[0].red='',f=>f.events.push(structuredClone(f.events[0]))]) {
 const invalid=structuredClone(feed);mutate(invalid);assert.equal(confirmedCalendar(invalid).available,false);assert.equal(confirmedCalendar(invalid).match(record),null);
}
const cancelled=structuredClone(feed);cancelled.events[0].bouts[0].status='cancelled';
assert.equal(confirmedCalendar(cancelled).match(record),null);
const cancelledEvent=structuredClone(feed);cancelledEvent.events[0].status='cancelled';
assert.equal(confirmedCalendar(cancelledEvent).match(record),null);
const sources=[{id:'test',name:'Reporter',handle:'test',language:'en',profile:'https://x.com/test'}];
const now=new Date('2026-10-08T12:00:00Z');
const payload={candidates:[{id:'2200000000000000001',sourceId:'test',postUrl:'https://x.com/test/status/2200000000000000001',text:'Ilia Topuria vs Max Holloway is targeted',publishedAt:record.publishedAt,language:'en'}]};
const original=automaticFeed(payload,sources,undefined,now);
const excluded=automaticFeed(payload,sources,undefined,now,feed);
assert.equal(excluded.added,0);assert.equal(excluded.skipReasons['confirmed-in-calendar'],1);
assert.equal(excluded.calendarChecked,true);
const cleaned=automaticFeed({candidates:[]},sources,original.feed,now,feed);
assert.equal(cleaned.removedConfirmed,1);assert.equal(cleaned.feed.groups.length,0);
assert.equal(automaticFeed({candidates:[]},sources,original.feed,now,null).feed.groups.length,1);
const rematch=structuredClone(payload);rematch.candidates[0].text+=' for UFC on November 21';
assert.equal(automaticFeed(rematch,sources,undefined,now,feed).added,1);
const root=await mkdtemp(join(tmpdir(),'ufcinfo-calendar-test-'));
try {
 await mkdir(join(root,'assets/data'),{recursive:true});
 await writeFile(join(root,'assets/data/ufc-rumors.json'),JSON.stringify({sources}));
 await writeFile(join(root,'assets/data/ufc-events.json'),JSON.stringify(feed));
 await writeFile(join(root,'candidates.json'),JSON.stringify(payload));
 const result=await syncRumors({projectRoot:root,configOverride:{},fromFile:join(root,'candidates.json'),now,fetchImpl:()=>assert.fail('No paid queries')});
 assert.equal(result.feed.groups.length,0);assert.equal(result.calendarChecked,true);assert.equal(result.requests,0);
} finally {await rm(root,{recursive:true,force:true});}
console.log('PASS: calendar opponents, aliases, chronology, local date, cancellations, invalid snapshots, existing rumors and offline sync wiring');
