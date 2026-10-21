// Attempt timestamps describe a job, never the age of an individual statistic.
const list=value=>Array.isArray(value)?value:[];
export function syncHealth(kind,feed,now=Date.now(),job=null) {
  const stamp=kind==='rumors'?feed?.lastSearchedAt:kind==='records'?feed?.lastSync?.checkedAt:kind==='results'?feed?.resultsVerification?.checkedAt:feed?.synchronizedAt;
  const valid=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&Date.parse(value)<=now+300000;
  const ids=kind==='records'?new Set([...list(feed?.pendingProfileIds),...list(feed?.lastSync?.failedIds),...Object.keys(feed?.profileReview||{})]):
    kind==='events'?new Set([...list(feed?.resultsVerification?.failedIds),...list(feed?.events).filter(e=>Object.keys(e.pendingBoutRemovals||{}).length).map(e=>e.id)]):
    new Set(list(kind==='results'?feed?.resultsVerification?.failedIds:feed?.failedIds));
  const unmatched=kind==='records'?new Set(Object.values(feed?.unmatchedEventFighters||{}).flatMap(list)).size:0;
  const pending=ids.size+unmatched;
  // A later conditional recovery supersedes a previous job outcome.
  const tracked=job&&valid(job.attemptedAt)&&(!valid(stamp)||Date.parse(job.finishedAt||job.attemptedAt)>=Date.parse(stamp));
  const attemptStamp=tracked?job.attemptedAt:valid(stamp)?stamp:null;
  const successStamp=tracked?(valid(job.lastSuccessAt)?job.lastSuccessAt:null):
    valid(stamp)&&!pending?stamp:valid(job?.lastSuccessAt)?job.lastSuccessAt:null;
  const status=tracked&&job.status==='failed'?'failed':
    tracked&&job.status==='running'?(now-Date.parse(job.attemptedAt)>30*60000?'interrupted':'running'):
    !valid(attemptStamp)?'unknown':pending||(tracked&&job.status==='partial')?'partial':
    now-Date.parse(attemptStamp)>(kind==='rumors'?90:1200)*60000?'delayed':'recent';
  return {stamp,attemptStamp,successStamp,status,pending:Math.max(pending,tracked&&Number.isSafeInteger(job.pending)?job.pending:0)};
}
