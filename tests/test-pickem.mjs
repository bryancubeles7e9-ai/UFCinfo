import assert from 'node:assert/strict';
import {closingTime,nextPickEvent,pickKey,picksFor,isClosed,readPicks,pickResult,pickSummary,pickPoints,countdownText} from '../assets/js/pickem-model.js';
const bout = {red:'A',blue:'B',section:'main'}, other = {red:'C',blue:'D',section:'prelims'};
const event = {id:'test',type:'official',status:'scheduled',date:'2026-10-24T18:00:00Z',source:'official',bouts:[bout,other]};
event.sectionSchedule = {eventDate:event.date,source:event.source,starts:{main:event.date,prelims:'2026-10-24T16:00:00Z', 'early-prelims':'2026-10-24T14:00:00Z'}};
assert.equal(closingTime(event),Date.parse('2026-10-24T14:00:00Z'));
assert.equal(isClosed(event,closingTime(event)-1),false);
assert.equal(isClosed(event,closingTime(event)),true);
assert.equal(isClosed({...event,status:'live'},0),true);
assert.equal(isClosed({...event,status:'cancelled'},0),true);
const picks = {[pickKey(bout)]:'A'};
assert.deepEqual(picksFor({...event,bouts:[other,bout]},picks),picks);
assert.deepEqual(picksFor({...event,bouts:[{red:'B',blue:'A'}]},picks),picks);
assert.deepEqual(picksFor({...event,bouts:[{red:'A',blue:'E'}]},picks),{});
assert.deepEqual(picksFor(event,{[pickKey(bout)]:'outsider'}),{});
assert.equal(closingTime({...event,sectionSchedule:null}),Date.parse(event.date)-4*3600000);
assert.equal(closingTime({...event,date:'2026-10-25T18:00:00Z'}),Date.parse('2026-10-25T14:00:00Z'));
const later={...event,id:'later',date:'2026-10-31T18:00:00Z'};
const now=Date.parse('2026-10-23T12:00:00Z');
assert.equal(nextPickEvent([later,event],now).id,'test');
assert.equal(nextPickEvent([{...event,status:'cancelled'},later],now).id,'later');
assert.equal(nextPickEvent([event,later],Date.parse('2026-10-25T12:00:00Z')).id,'later');
assert.equal(nextPickEvent([],now),null);
const storage={getItem:()=>JSON.stringify({test:picks})};
assert.deepEqual(readPicks(storage).test,picks);
assert.deepEqual(readPicks({getItem(){throw Error('blocked')}}),{});
assert.deepEqual(readPicks({getItem:()=>'{broken'}),{});
assert.deepEqual(readPicks({getItem:()=> '[]'}),{});
console.log('PASS Pick’em: persistence, invalid storage, card reorder/replacement, closing, rescheduling and event rollover');

const resolved = {red:'A', blue:'B', winner:'A'};
const saved = {[pickKey(resolved)]:'A'};
assert.equal(pickResult(resolved,saved),'correct');
assert.equal(pickResult(resolved,{[pickKey(resolved)]:'B'}),'wrong');
assert.equal(pickResult(resolved,{}),'unpicked');
assert.equal(pickResult({...resolved,winner:null},saved),'pending');
assert.equal(pickResult({...resolved,winner:'unverified'},saved),'pending');
for(const outcome of ['Empate','Sin resultado (No contest)','draw','cancelled'])
  assert.equal(pickResult({...resolved,outcome},saved),'void');
assert.equal(pickResult({...resolved,_void:true},saved),'void');
assert.deepEqual(pickSummary({bouts:[resolved,{...resolved,winner:'B'},
  {red:'C',blue:'D',winner:'C'},{red:'E',blue:'F',winner:null},
  {...resolved,_void:true}]},saved),{correct:1,wrong:1,unpicked:1,pending:1,void:1});
assert.deepEqual(pickSummary({bouts:[]},saved),{correct:0,wrong:0,unpicked:0,pending:0,void:0});
console.log('PASS Pick’em results: correct, wrong, unpicked, pending and void bouts stay distinct');

const cases=JSON.parse(await (await import('node:fs/promises')).readFile(new URL('./fixtures/pickem-methods.json',import.meta.url),'utf8'));
for(const test of cases){
  const picks={[pickKey(test.bout)]:test.pick};
  assert.equal(pickResult(test.bout,picks),test.status,test.name);
  assert.equal(pickPoints(test.bout,picks),test.points,test.name);
  assert.deepEqual(picksFor({bouts:[test.bout]},picks),picks,test.name);
}
assert.deepEqual(picksFor({bouts:[bout]},{[pickKey(bout)]:{winner:'A',method:'bonus'}}),{});
console.log('PASS Pick’em shared scoring fixtures: general, methods, draws, unknown methods and legacy picks');

assert.equal(countdownText(1000,0),'00:00:01');
assert.equal(countdownText(1000,999),'00:00:01');
assert.equal(countdownText(1000,1000),null);
assert.equal(countdownText(1000,1001),null);
assert.equal(countdownText(NaN,0),null);
assert.equal(countdownText(90061000,0),'1d 01:01:01');
assert.equal(countdownText(Date.parse('2026-10-25T02:00:00Z'),Date.parse('2026-10-25T00:00:00Z')),'02:00:00');
console.log('PASS countdown: seconds, days, deadline, invalid timestamps and DST-independent elapsed time');
