"""Verify rumored matchups against UFC.com fight cards. Keep prior confirmations on fetch/parser failure."""
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
import re
import sys
import tempfile
import unicodedata
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('rankings_parser', ROOT / 'scripts/sync-ufc-rankings.py')
parser_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parser_module)


def normalize(name):
    return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFD', name).lower())


def parse_card(html):
    parser = parser_module.Parser(); parser.feed(html)
    fights = parser.root.find(lambda n: n.has('c-listing-fight'))
    # Both participants must be inside the same fight, never just somewhere on the page.
    pairs = set()
    for fight in fights:
        red = fight.find(lambda n: n.has('c-listing-fight__corner-name--red'))
        blue = fight.find(lambda n: n.has('c-listing-fight__corner-name--blue'))
        if len(red) == len(blue) == 1 and red[0].text() and blue[0].text():
            pairs.add(tuple(sorted([normalize(red[0].text()),normalize(blue[0].text())])))
    times = parser.root.find(lambda n: n.has('c-event-fight-card-broadcaster__time') and 'data-timestamp' in n.attrs)
    if not pairs or not times:
        raise ValueError('Official fight card or event timestamp missing; preserve existing confirmations')
    dates = {int(n.attrs['data-timestamp']) for n in times}
    if len(dates) != 1:
        raise ValueError('Ambiguous official event date')
    return pairs, datetime.fromtimestamp(dates.pop(),timezone.utc)


def catalog_names():
    initial = json.loads((ROOT / 'docs/fighter-details-sources.json').read_text())
    additional = json.loads((ROOT / 'docs/fighter-directory-sources.json').read_text())
    # Read names from the checked-in catalog without requiring an external service.
    import subprocess
    output = subprocess.check_output(['node','--input-type=module','-e',
        "import {directoryFighters} from './assets/js/fighter-directory.js'; import {fullName} from './assets/js/data.js'; console.log(JSON.stringify(Object.fromEntries(directoryFighters.map(f=>[f.id,fullName(f)]))));"],cwd=ROOT,text=True)
    names = json.loads(output)
    if not (set(initial) | {f['id'] for f in additional}).issubset(names):
        raise ValueError('Incomplete fighter catalog')
    return names


def main():
    target = ROOT / 'assets/data/ufc-rumors.json'
    feed = json.loads(target.read_text())
    if not feed['rumors']:
        print('No reviewed rumors: no external requests made.'); return 0
    names = catalog_names()
    events = json.loads((ROOT / 'assets/data/ufc-events.json').read_text())['events']
    now = datetime.now(timezone.utc).isoformat()
    card_cache, failures = {}, set()
    checked = 0
    for rumor in feed['rumors']:
        posted = datetime.fromisoformat(rumor['publishedAt'].replace('Z','+00:00'))
        pair = tuple(sorted(normalize(names[f]) for f in rumor['fighters']))
        candidates = [e for e in events if e.get('type') == 'official' and re.fullmatch(r'ufc-\d{1,4}',e['id']) and
                      datetime.fromisoformat(e['date'].replace('Z','+00:00')) >= posted and
                      (rumor.get('eventId') is None or rumor['eventId'] == e['id'])]
        for event in sorted(candidates,key=lambda e:e['date']):
            event_id = event['id']
            if event_id in failures:
                continue
            if event_id not in card_cache:
                url = f'https://www.ufc.com/event/{event_id}'
                try:
                    with urlopen(Request(url,headers={'User-Agent':'UFCinfo/1.0','Accept':'text/html'}),timeout=15) as response:
                        if response.geturl().rstrip('/') != url:
                            raise ValueError('Unexpected redirect')
                        card_cache[event_id] = parse_card(response.read(5_000_000).decode('utf-8'))
                except Exception:
                    failures.add(event_id); continue
            pairs, official_date = card_cache[event_id]
            checked += 1
            if pair in pairs and official_date >= posted:
                rumor['official'] = {'eventId':event_id,'url':f'https://www.ufc.com/event/{event_id}',
                                     'checkedAt':now,'eventDate':official_date.isoformat()}
                break
    # Never claim a complete fresh check if one relevant official page was unavailable.
    if not failures:
        feed['lastOfficialCheckAt'] = now
    if checked:
        feed['updatedAt'] = now
        with tempfile.NamedTemporaryFile(mode='w',encoding='utf-8',dir=target.parent,delete=False) as tmp:
            json.dump(feed,tmp,ensure_ascii=False,indent=2); tmp.write('\n')
        Path(tmp.name).replace(target)
    print(f'Official cards checked: {len(card_cache)}; unavailable: {len(failures)}. Existing confirmations retained.')
    return 1 if failures else 0

if __name__ == '__main__':
    sys.exit(main())
