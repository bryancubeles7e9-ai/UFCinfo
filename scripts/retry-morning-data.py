"""Once per Madrid morning, retry only unresolved data from the last 48 hours."""
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from pathlib import Path
import importlib.util
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / 'assets/data/morning-retry.json'

def module(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT/'scripts'/file)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result

def due(now, previous):
    local = now.astimezone(ZoneInfo('Europe/Madrid'))
    return local.hour == 10 and previous.get('date') != local.date().isoformat()

def plan(events, state, fighters, now, failed_event_ids=()):
    records = module('retry_records_plan', 'sync-ufc-fighter-records.py')
    names = {records.normalize(n):f for f in fighters for n in [f['name'],*f.get('aliases',[])]}
    cards, ids, missing = [], set(), False
    for event in events:
        start = datetime.fromisoformat(event['date'].replace('Z','+00:00'))
        if not now-timedelta(hours=48) <= start <= now:
            continue
        if event['id'] in failed_event_ids or event.get('status') != 'completed' or not event.get('bouts') or any(not b.get('winner') and not b.get('outcome') for b in event['bouts']):
            cards.append(event)
        for bout in event.get('bouts',[]):
            for corner in ('red','blue'):
                fighter = names.get(records.normalize(bout[corner]))
                if not fighter:
                    missing = True
                    continue
                entry = state.get('records',{}).get(fighter['id'],{})
                stamp = entry.get('updatedAt')
                if fighter['id'] in state.get('pendingProfileIds',[]) or not stamp or datetime.fromisoformat(stamp.replace('Z','+00:00')) < start:
                    ids.add(fighter['id'])
    return cards, ids, missing

def main():
    now = datetime.now(timezone.utc)
    previous = json.loads(STATE.read_text()) if STATE.exists() else {}
    if not due(now, previous):
        print('Outside 10:00 Madrid window or already checked today; no source requests.')
        return
    events_path = ROOT/'assets/data/ufc-events.json'
    feed = json.loads(events_path.read_text())
    records = module('retry_records', 'sync-ufc-fighter-records.py')
    state = json.loads(records.STATE.read_text())
    fighters = records.directory()
    cards, ids, missing = plan(feed['events'], state, fighters, now, feed.get('resultsVerification',{}).get('failedIds',[]))
    if cards:
        official = module('retry_results','reconcile-official-results.py')
        subset = official.reconcile({'events':cards}, now=now)
        feed['resultsVerification'] = subset['resultsVerification']
        events_path.write_text(json.dumps(feed,ensure_ascii=False,indent=2)+'\n')
    if missing or cards:
        subprocess.run([sys.executable,str(ROOT/'scripts/import-season-fighters.py'),'--recent'],check=True)
        fighters = records.directory()
        _, ids, _ = plan(feed['events'],state,fighters,now)
    if ids:
        unmatched = state.get('unmatchedEventFighters',{})
        state['pendingProfileIds'] = sorted(set(state.get('pendingProfileIds',[])) | ids)
        records.sync([],state,[f for f in fighters if f['id'] in ids],now=now)
        state['unmatchedEventFighters'] = unmatched
        records.save(state)
    STATE.write_text(json.dumps({'date':now.astimezone(ZoneInfo('Europe/Madrid')).date().isoformat(),
                                 'checkedAt':now.isoformat(),'eventIds':[e['id'] for e in cards],
                                 'profileIds':sorted(ids)},indent=2)+'\n')
    print(f'Morning retry: {len(cards)} cards, {len(ids)} eligible profiles; no Cito requests.')

if __name__=='__main__':main()
