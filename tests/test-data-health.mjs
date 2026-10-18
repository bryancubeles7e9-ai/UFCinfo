import assert from 'node:assert/strict';
import {assessFeed} from '../assets/js/data-health.js';
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
