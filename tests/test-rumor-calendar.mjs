import assert from 'node:assert/strict';
import {confirmedCalendar} from '../scripts/confirmed-rumor-matchups.mjs';
import {automaticFeed,isRematchReport} from '../scripts/rumor-auto-feed.mjs';
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
const completed=structuredClone(feed);
completed.events[0].status='completed';
const mixedReports={...record,publishedAt:'2026-12-13T03:42:13Z',reports:[{publishedAt:'2026-12-10T22:44:51Z'},{publishedAt:'2026-12-13T03:42:13Z'}]};
assert.ok(confirmedCalendar(completed).match(mixedReports));
assert.ok(confirmedCalendar(completed).match({...record,publishedAt:'2026-12-14T08:00:00Z'}));
assert.ok(confirmedCalendar(completed).match({...record,publishedAt:'2026-12-20T08:00:00Z'}));
assert.equal(confirmedCalendar(completed).match({...record,publishedAt:'2026-12-20T08:00:00Z',rematch:true}),null);
assert.ok(confirmedCalendar(completed).match({...record,publishedAt:'2026-12-10T08:00:00Z',rematch:true}));
assert.equal(confirmedCalendar(completed).match({...mixedReports,eventDateHint:'2027-02-01'}),null);
const ufc332=structuredClone(completed);
ufc332.events[0]={id:'ufc-332',type:'official',status:'completed',source:'https://www.ufc.com/event/ufc-332',date:'2026-10-04T00:00:00+00:00',bouts:[{red:'King Green',blue:'Esteban Ribovics',winner:'Esteban Ribovics'}]};
assert.ok(confirmedCalendar(ufc332).match({fighterNames:['Esteban Ribovics','King Green'],publishedAt:'2026-10-04T03:42:13Z',eventDateHint:null,reports:[{publishedAt:'2026-10-01T22:44:51Z'},{publishedAt:'2026-10-04T03:42:13Z'}]}));
const kingPair=['King Green','Esteban Ribovics'];
for (const text of ['King Green vs Esteban Ribovics 2 is targeted','Green vs Ribovics II in talks','Revancha: Green vs Ribovics','King Green vs Ribovics rematch','King Green vs Ribovics, segunda pelea']) assert.ok(isRematchReport(text,kingPair),text);
for (const text of ['King Green vs Ribovics at UFC 2','King Green vs Ribovics in 2 days','King Green vs Ribovics fight 2 rounds']) assert.equal(isRematchReport(text,kingPair),false,text);
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
const finishedGroup={...original.feed,groups:[{...original.feed.groups[0],publishedAt:mixedReports.publishedAt,reports:[{...original.feed.groups[0].reports[0],publishedAt:mixedReports.reports[0].publishedAt},{...original.feed.groups[0].reports[0],id:'2200000000000000002',postUrl:'https://x.com/test/status/2200000000000000002',publishedAt:mixedReports.reports[1].publishedAt}]}]};
assert.equal(automaticFeed({candidates:[]},sources,finishedGroup,new Date('2026-12-15T12:00:00Z'),completed).removedConfirmed,1);
const kingPost=(id,text)=>({id,sourceId:'test',postUrl:`https://x.com/test/status/${id}`,text,publishedAt:'2026-10-08T08:00:00Z',language:'en'});
const kingPayload=post=>({candidates:[post]});
const oldFight=automaticFeed(kingPayload(kingPost('2200000000000000003','King Green vs Esteban Ribovics is targeted for UFC')),sources,undefined,now,ufc332);
assert.equal(oldFight.added,0);
assert.equal(oldFight.skipReasons['confirmed-in-calendar'],1);
for (const [id,text] of [['2200000000000000008','King Green vs Esteban Ribovics 2 at UFC 332'],['2200000000000000009','King Green vs Esteban Ribovics rematch at UFC 332'],['2200000000000000010','King Green vs Esteban Ribovics at UFC 2']]) {
  assert.equal(automaticFeed(kingPayload(kingPost(id,text)),sources,undefined,now,ufc332).added,0,text);
}
for (const [id,text] of [['2200000000000000004','King Green vs Esteban Ribovics 2 is targeted for UFC'],['2200000000000000005','King Green vs Esteban Ribovics rematch is targeted for UFC'],['2200000000000000006','Revancha: King Green vs Esteban Ribovics is targeted for UFC']]) {
  const secondFight=automaticFeed(kingPayload(kingPost(id,text)),sources,undefined,now,ufc332);
  assert.equal(secondFight.added,1,text);
  assert.equal(secondFight.feed.groups[0].rematch,true);
  assert.ok(secondFight.feed.groups[0].summary.es.includes('revancha'));
}
const separate=automaticFeed({candidates:[kingPost('2200000000000000003','King Green vs Esteban Ribovics is targeted for UFC'),kingPost('2200000000000000004','King Green vs Esteban Ribovics 2 is targeted for UFC')]},sources,undefined,now,null);
assert.equal(separate.feed.groups.length,2);
assert.notEqual(separate.feed.groups[0].matchupKey,separate.feed.groups[1].matchupKey);
const futureRematch=structuredClone(ufc332);
futureRematch.events.push({id:'ufc-336',type:'official',status:'announced',source:'https://www.ufc.com/event/ufc-336',date:'2026-12-13T00:00:00Z',bouts:[{red:'King Green',blue:'Esteban Ribovics'}]});
assert.equal(automaticFeed(kingPayload(kingPost('2200000000000000007','King Green vs Esteban Ribovics 2 is targeted for UFC')),sources,undefined,now,futureRematch).skipReasons['confirmed-in-calendar'],1);
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
