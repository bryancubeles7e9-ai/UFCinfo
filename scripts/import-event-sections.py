"""Import published section/order metadata from saved official upcoming-event pages.

Usage: python scripts/import-event-sections.py DIRECTORY
Pages are named EVENT_ID.html. Unknown or partially matched cards are preserved.
Does not infer sections from unclassified announcements or change results.
"""
import importlib.util
import json
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('official_html', ROOT / 'scripts/import-fight-nights.py')
html = importlib.util.module_from_spec(spec)
spec.loader.exec_module(html)


def normalize(name):
    return ''.join(c for c in unicodedata.normalize('NFD', name).lower() if c.isalnum())


def pair(red, blue):
    return frozenset((normalize(red), normalize(blue)))


def main():
    path = ROOT / 'assets/data/ufc-events.json'
    feed = json.loads(path.read_text())
    changed = {}
    for event in feed['events']:
        if event.get('status') not in ('scheduled', 'announced'):
            continue
        page = Path(sys.argv[1]) / (event['id'] + '.html')
        if not page.exists():
            continue
        parser = html.Parser()
        parser.feed(page.read_text())
        published = {}
        for card_id, section in [('main-card', 'main'), ('prelims-card', 'prelims'), ('early-prelims', 'early-prelims')]:
            for card in parser.root.find(id=card_id):
                for fight in card.find('c-listing-fight'):
                    red = html.first(fight, 'c-listing-fight__corner-name--red')
                    blue = html.first(fight, 'c-listing-fight__corner-name--blue')
                    if red and blue:
                        published[pair(red, blue)] = (section, len(published))
        if not event['bouts'] or any(pair(b['red'], b['blue']) not in published for b in event['bouts']):
            print(event['id'], 'preserved: section/order not fully confirmed')
            continue
        for bout in event['bouts']:
            bout['section'] = published[pair(bout['red'], bout['blue'])][0]
        event['bouts'].sort(key=lambda b: published[pair(b['red'], b['blue'])][1])
        event['scheduleSource'] = event['source']
        event['scheduleCheckedAt'] = datetime.now(timezone.utc).isoformat()
        changed[event['id']] = event
        print(event['id'], len(event['bouts']), 'bout sections verified')
    if changed:
        path.write_text(json.dumps(feed, ensure_ascii=False, indent=2) + '\n')
        snapshot = ROOT / 'assets/js/official-events.js'
        prefix, raw = snapshot.read_text().split('export const officialEvents = ', 1)
        events = json.loads(raw.strip().removesuffix(';'))
        events = [changed.get(e['id'], e) for e in events]
        snapshot.write_text(prefix + 'export const officialEvents = ' + json.dumps(events, ensure_ascii=False, indent=2) + ';\n')


if __name__ == '__main__':
    main()
