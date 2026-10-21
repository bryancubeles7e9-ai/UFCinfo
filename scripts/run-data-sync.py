"""Record the outcome of an existing sync command without extra source requests."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
JOBS = {
    'events': ('sync-cito-events.py', 'ufc-events.json'),
    'results': ('reconcile-official-results.py', 'ufc-events.json'),
    'rankings': ('sync-ufc-rankings.py', 'ufc-rankings.json'),
    'records': ('sync-ufc-fighter-records.py', 'fighter-records.json'),
    'photos': ('sync-fighter-photos.py', 'fighter-photos.json'),
}


def pending_count(kind, feed):
    if kind == 'records':
        ids = set(feed.get('pendingProfileIds', [])) | set(feed.get('profileReview', {}))
        names = set(n for names in feed.get('unmatchedEventFighters', {}).values() for n in names)
        return len(ids) + len(names)
    if kind == 'events':
        return sum(bool(e.get('pendingBoutRemovals')) for e in feed.get('events', []))
    if kind == 'results':
        return len(set(feed.get('resultsVerification', {}).get('failedIds', [])))
    return len(set(feed.get('failedIds', [])))


def write(path, state):
    with tempfile.NamedTemporaryFile('w', encoding='utf-8', dir=path.parent, delete=False) as tmp:
        json.dump(state, tmp, ensure_ascii=False, indent=2)
        tmp.write('\n')
    Path(tmp.name).replace(path)


def run(kind, args=(), root=ROOT, execute=subprocess.run, clock=lambda: datetime.now(timezone.utc)):
    script, filename = JOBS[kind]
    path = root / 'assets/data/sync-health.json'
    state = json.loads(path.read_text()) if path.exists() else {'schemaVersion': 1, 'jobs': {}}
    previous = state['jobs'].get(kind, {})
    entry = {**previous, 'attemptedAt': clock().isoformat(), 'status': 'running'}
    entry.pop('finishedAt', None)
    entry.pop('exitCode', None)
    state['jobs'][kind] = entry
    write(path, state)
    code = 1
    try:
        code = execute([sys.executable, str(root / 'scripts' / script), *args], cwd=root).returncode
        if code == 0:
            feed = json.loads((root / 'assets/data' / filename).read_text())
            entry['pending'] = pending_count(kind, feed)
            entry['status'] = 'partial' if entry['pending'] else 'success'
            if entry['status'] == 'success':
                entry['lastSuccessAt'] = clock().isoformat()
        else:
            entry['status'] = 'failed'
    except (OSError, ValueError, TypeError, KeyError):
        # Public status never contains exception text, command arguments or secrets.
        code = 1
        entry['status'] = 'failed'
    finally:
        entry['consecutiveFailures'] = previous.get('consecutiveFailures', 0) + 1 if entry['status'] == 'failed' else 0
        if entry.get('pending'):
            entry.setdefault('pendingSince', entry['attemptedAt'])
        elif entry['status'] == 'success':
            entry.pop('pendingSince', None)
        entry.update(finishedAt=clock().isoformat(), exitCode=code)
        write(path, state)
    return code


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('kind', choices=JOBS)
    options, extra = parser.parse_known_args()
    raise SystemExit(run(options.kind, extra))
