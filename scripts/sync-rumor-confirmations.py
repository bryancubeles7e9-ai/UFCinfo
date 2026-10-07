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


def event_url(event):
    identity = event.get('id', '')
    expected = f'https://www.ufc.com/event/{identity}'
    if event.get('type') != 'official' or not re.fullmatch(r'ufc-[a-z0-9-]{1,100}', identity):
        return None
    return expected if event.get('source') == expected else None


def as_date(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00'))


def confirmed_match(pair, posted, pairs, official_date, date_hint=None):
    # A completed first fight cannot confirm a later rematch rumor.
    if pair not in pairs or official_date < posted:
        return False
    if date_hint:
        try:
            hinted = datetime.strptime(date_hint, '%Y-%m-%d').date()
        except (ValueError, TypeError):
            return False
        # Tweets use local dates; UFC timestamps are UTC.
        if abs((official_date.date() - hinted).days) > 1:
            return False
    return True


def write_json(target, feed):
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=target.parent, delete=False) as tmp:
        json.dump(feed, tmp, ensure_ascii=False, indent=2)
        tmp.write('\n')
    Path(tmp.name).replace(target)


def verify_feeds(feed, grouped, events, fetch_card, now, names=None):
    records = []
    for rumor in feed.get('rumors', []):
        records.append((rumor, tuple(sorted(normalize(names[f]) for f in rumor['fighters'])), False))
    for group in grouped.get('groups', []):
        records.append((group, tuple(sorted(normalize(n) for n in group['fighterNames'])), True))
    card_cache, failures = {}, set()
    removed, checked = set(), 0
    for record, pair, is_group in records:
        posted = as_date(record['publishedAt'])
        candidates = []
        for event in events:
            url = event_url(event)
            if not url:
                continue
            try:
                eligible = as_date(event['date']) >= posted
            except (ValueError, KeyError, TypeError):
                continue
            if eligible and (record.get('eventId') is None or record['eventId'] == event['id']):
                candidates.append(event)
        for event in sorted(candidates, key=lambda e: e['date']):
            identity = event['id']
            if identity in failures:
                continue
            if identity not in card_cache:
                # Bounded official-page traffic; never guess confirmation on a failure.
                if len(card_cache) + len(failures) >= 24:
                    failures.add(identity)
                    continue
                try:
                    card_cache[identity] = parse_card(fetch_card(event_url(event)))
                except Exception as error:
                    failures.add(identity)
                    status = getattr(error, 'code', None)
                    detail = f'HTTP {status}' if isinstance(status, int) else 'missing/invalid fight card' if isinstance(error, ValueError) else type(error).__name__
                    print(f'Official page unavailable: {identity}: {detail}')
                    continue
            pairs, official_date = card_cache[identity]
            checked += 1
            if confirmed_match(pair, posted, pairs, official_date, record.get('eventDateHint')):
                if is_group:
                    removed.add(record['id'])
                    print(f"Confirmed on UFC.com: {record['id']} -> {identity}")
                else:
                    record['official'] = {'eventId': identity, 'url': event_url(event),
                                          'checkedAt': now, 'eventDate': official_date.isoformat()}
                break
    grouped['groups'] = [g for g in grouped.get('groups', []) if g['id'] not in removed]
    if removed:
        grouped['updatedAt'] = now
    if checked and feed.get('rumors'):
        feed['updatedAt'] = now
    if not failures:
        feed['lastOfficialCheckAt'] = now
    return {'checkedCards': len(card_cache), 'unavailableCards': len(failures),
            'removedGroups': len(removed), 'remainingGroups': len(grouped['groups'])}


def fetch_official_card(url):
    with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; UFCinfo/1.0)', 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9'}), timeout=10) as response:
        if response.geturl().rstrip('/') != url:
            raise ValueError('Unexpected redirect')
        body = response.read(5_000_001)
        if len(body) > 5_000_000:
            raise ValueError('Official page too large')
        return body.decode('utf-8')


def main():
    target = ROOT / 'assets/data/ufc-rumors.json'
    group_target = ROOT / 'assets/data/ufc-rumor-groups.json'
    feed = json.loads(target.read_text(encoding='utf-8'))
    grouped = json.loads(group_target.read_text(encoding='utf-8'))
    if not feed.get('rumors') and not grouped.get('groups'):
        print('No rumors: no official-page requests made.')
        return 0
    names = catalog_names() if feed.get('rumors') else None
    events = json.loads((ROOT / 'assets/data/ufc-events.json').read_text(encoding='utf-8'))['events']
    before_feed, before_groups = json.dumps(feed), json.dumps(grouped)
    result = verify_feeds(feed, grouped, events, fetch_official_card, datetime.now(timezone.utc).isoformat(), names)
    # Both files are committed together by the workflow.
    if feed.get('rumors') and json.dumps(feed) != before_feed:
        write_json(target, feed)
    if json.dumps(grouped) != before_groups:
        write_json(group_target, grouped)
    print(f"Official UFC cards checked: {result['checkedCards']}; unavailable: {result['unavailableCards']}; confirmed groups removed: {result['removedGroups']}; remaining groups: {result['remainingGroups']}.")
    if result['unavailableCards']:
        print('Some UFC pages were unavailable. Unverified groups retained; no confirmation inferred.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
