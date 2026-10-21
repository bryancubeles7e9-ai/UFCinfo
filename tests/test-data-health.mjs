import assert from 'node:assert/strict';
import {assessFeed,renderHealthItem} from '../assets/js/data-health.js';
const now=Date.parse('2026-10-13T17:30:00Z');
assert.equal(assessFeed('rumors',{lastSearchedAt:'2026-10-13T17:01:00Z'},now).status,'recent');
assert.equal(assessFeed('rumors',{lastSearchedAt:'2026-10-13T15:00:00Z'},now).status,'delayed');
assert.equal(assessFeed('events',{synchronizedAt:'2026-10-12T12:00:00Z'},now).status,'delayed');
assert.equal(assessFeed('records',{lastSync:{checkedAt:'2026-10-13T16:55:00Z'},pendingProfileIds:['fighter']},now).status,'partial');
assert.equal(assessFeed('rankings',{synchronizedAt:'2026-10-14T12:00:00Z'},now).status,'unknown');
assert.equal(assessFeed('rumors',{},now).status,'unknown');
console.log('PASS: freshness, partial failures, missing and future timestamps');

assert.equal(assessFeed('records',{lastSync:{checkedAt:'2026-10-13T16:55:00Z'},unmatchedEventFighters:{event:['Missing']}},now).status,'partial');
assert.equal(assessFeed('events',{synchronizedAt:'2026-10-13T16:55:00Z',resultsVerification:{failedIds:['event']}},now).status,'partial');

const feed={lastSync:{checkedAt:'2026-10-13T16:00:00Z'},records:{}};
const job={attemptedAt:'2026-10-13T17:00:00Z',finishedAt:'2026-10-13T17:01:00Z',status:'failed',lastSuccessAt:'2026-10-13T12:00:00Z',pending:0};
const failure=assessFeed('records',feed,now,job);
assert.equal(failure.status,'failed');
assert.equal(failure.attemptStamp,job.attemptedAt);
assert.equal(failure.successStamp,job.lastSuccessAt);
const partial=assessFeed('records',{...feed,pendingProfileIds:['a'],profileReview:{a:{}}},now,{...job,status:'partial',pending:1});
assert.equal(partial.pending,1);
assert.equal(partial.successStamp,job.lastSuccessAt);
assert.equal(assessFeed('records',{lastSync:{checkedAt:'2026-10-13T17:15:00Z'}},now,job).status,'recent');
assert.equal(assessFeed('records',{lastSync:{checkedAt:'2026-10-13T17:15:00Z'}},now,job).successStamp,'2026-10-13T17:15:00Z');
assert.equal(assessFeed('rankings',{},now,{...job,status:'running',attemptedAt:'2026-10-13T17:20:00Z',finishedAt:undefined}).status,'running');
assert.equal(assessFeed('rankings',{},now,{...job,status:'running',attemptedAt:'2026-10-13T16:00:00Z',finishedAt:undefined}).status,'interrupted');
assert.equal(assessFeed('records',{lastSync:{checkedAt:'2026-10-13T17:00:00Z'},pendingProfileIds:['a']},now).successStamp,null);
assert.equal(assessFeed('results',{resultsVerification:{checkedAt:'2026-10-13T17:00:00Z',failedIds:['e']}},now).status,'partial');
for (const [locale,attempt,success] of [['es-ES','Último intento conocido','Última sincronización sin incidencias'],['en-US','Last known attempt','Last sync without issues'],['ca-ES','Últim intent conegut','Última sincronització sense incidències']]) {
 const html=renderHealthItem('records',feed,{job,now,locale});
 assert.ok(html.includes(attempt));assert.ok(html.includes(success));assert.ok(html.includes('data-status="failed"'));
 assert.ok(!html.includes('undefined'));assert.ok(!html.includes('Invalid Date'));
 assert.ok(renderHealthItem('results',{}, {now,locale}).includes('—'));
}
console.log('PASS: failed attempts preserve last success, partial updates, recovery, pending counts and three-language status display');
