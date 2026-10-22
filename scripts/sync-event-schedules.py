"""Refresh official block start times for the next three cards, without paid APIs."""
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
from urllib.request import urlopen, Request

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('card_html', ROOT / 'scripts/import-fight-nights.py')
html = importlib.util.module_from_spec(spec)
spec.loader.exec_module(html)


def parse_schedule(page, event, now):
    parser = html.Parser(); parser.feed(page)
    starts = {}
    for card_id, section in [('main-card', 'main'), ('prelims-card', 'prelims'), ('early-prelims', 'early-prelims')]:
        cards = parser.root.find(id=card_id)
        if len(cards) > 1:
            raise ValueError('Ambiguous section')
        stamps = {n.attrs['data-timestamp'] for card in cards for n in card.find('c-event-fight-card-broadcaster__time') if n.attrs.get('data-timestamp')}
        if len(stamps) > 1:
            raise ValueError('Ambiguous start time')
        if stamps:
            starts[section] = datetime.fromtimestamp(int(stamps.pop()), timezone.utc)
    main = datetime.fromisoformat(event['date'].replace('Z', '+00:00'))
    if starts.get('main') != main:
        raise ValueError('Official main start differs from saved event date')
    ordered = [starts[s] for s in ('early-prelims', 'prelims', 'main') if s in starts]
    if any(t > main or (main-t).total_seconds() > 43200 for t in ordered) or any(a >= b for a,b in zip(ordered,ordered[1:])):
        raise ValueError('Invalid section chronology')
    return {'eventDate': event['date'], 'source': event['source'], 'checkedAt': now.isoformat(), 'starts': {k:v.isoformat() for k,v in starts.items()}}


def main():
    path = ROOT / 'assets/data/ufc-events.json'
    feed = json.loads(path.read_text())
    now = datetime.now(timezone.utc)
    upcoming = sorted([e for e in feed['events'] if e.get('status') in ('scheduled','announced') and datetime.fromisoformat(e['date'].replace('Z','+00:00')) > now], key=lambda e:e['date'])[:3]
    failed = []
    for event in upcoming:
        try:
            if event['source'] != 'https://www.ufc.com/event/' + event['id']:
                raise ValueError('Unexpected source')
            with urlopen(Request(event['source'], headers={'User-Agent':'UFCinfo schedule verification'}), timeout=25) as response:
                page = response.read(3000000).decode('utf-8')
            event['sectionSchedule'] = parse_schedule(page, event, now)
            print('Official schedule:', event['id'])
        except (OSError, ValueError, KeyError, OverflowError):
            failed.append(event['id'])
            print('::warning::Schedule not verified: ' + event['id'])
    feed['scheduleVerification'] = {'checkedAt':now.isoformat(), 'failedIds':failed}
    path.write_text(json.dumps(feed, ensure_ascii=False, indent=2)+'\n')
    return bool(failed)


if __name__ == '__main__':
    raise SystemExit(main())
