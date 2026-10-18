"""Verify recent cards against UFC, independently of the paid provider.

Only complete, identity-checked official cards replace results. Failures preserve
all saved data and remain visible in verification metadata for the next run.
"""
from datetime import datetime, timedelta, timezone
import importlib.util
import json
from pathlib import Path
import tempfile
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('official_card', ROOT / 'scripts/import-fight-nights.py')
html = importlib.util.module_from_spec(spec)
spec.loader.exec_module(html)


def pair(bout):
    return frozenset(' '.join(bout[k].casefold().split()) for k in ('red', 'blue'))


def completed_card(page, event, now):
    parser = html.Parser()
    parser.feed(page)
    main = parser.root.find(id='main-card')
    if len(main) != 1:
        raise ValueError('Official main card missing or ambiguous')
    times = main[0].find('c-event-fight-card-broadcaster__time') + parser.root.find('c-hero__headline-suffix')
    stamp = next((n.attrs.get('data-timestamp') for n in times if n.attrs.get('data-timestamp')), None)
    if not stamp:
        raise ValueError('Official event timestamp missing')
    start = datetime.fromtimestamp(int(stamp), timezone.utc)
    prior_start = datetime.fromisoformat(event['date'].replace('Z', '+00:00'))
    if abs((start - prior_start).total_seconds()) > 12 * 3600 or start > now:
        raise ValueError('Official event date mismatch or future event')
    bouts = []
    for card_id, section in [('main-card', 'main'), ('prelims-card', 'prelims'), ('early-prelims', 'early-prelims')]:
        cards = parser.root.find(id=card_id)
        if len(cards) > 1:
            raise ValueError('Ambiguous official section')
        for card in cards:
            for fight in card.find('c-listing-fight'):
                red = html.first(fight, 'c-listing-fight__corner-name--red')
                blue = html.first(fight, 'c-listing-fight__corner-name--blue')
                corners = [fight.find('c-listing-fight__corner--' + c) for c in ('red', 'blue')]
                wins = [bool(c and c[0].find('c-listing-fight__outcome--win')) for c in corners]
                outcome = 'Empate' if fight.find('c-listing-fight__outcome--draw') else 'Sin resultado (No contest)' if fight.find('c-listing-fight__outcome--nc') else None
                method, round_, time = (html.first(fight, k) for k in ('method', 'round', 'time'))
                if not red or not blue or red == blue or sum(wins) > 1 or (not any(wins) and not outcome) or not method or not round_ or not time:
                    raise ValueError('Official results not complete yet')
                bouts.append(dict(red=red, blue=blue, section=section,
                                  division=html.first(fight, 'c-listing-fight__class-text'),
                                  winner=red if wins[0] else blue if wins[1] else None,
                                  outcome=outcome, method=method, round=round_, time=time))
    pairs = {pair(b) for b in bouts}
    if not bouts or len(bouts) > 30 or len(pairs) != len(bouts):
        raise ValueError('Invalid official bout count')
    previous = event.get('bouts', [])
    if previous and not pairs.intersection(pair(b) for b in previous):
        raise ValueError('Official card identity mismatch')
    # Never erase a previously verified result because another source omits it.
    for saved in previous:
        if pair(saved) not in pairs:
            bouts.append(saved)
    bouts.sort(key=lambda b: {'main': 0, 'prelims': 1, 'early-prelims': 2}.get(b.get('section', 'main'), 0))
    if len(bouts) > 30:
        raise ValueError('Merged card exceeds limit')
    return bouts


def fetch(event):
    url = 'https://www.ufc.com/event/' + event['id']
    if event.get('source') != url:
        raise ValueError('Unexpected event source')
    with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=25) as r:
        data = r.read(3_000_001)
    if len(data) > 3_000_000:
        raise ValueError('Official card too large')
    return data.decode('utf-8')


def reconcile(feed, fetch_page=fetch, now=None):
    now = now or datetime.now(timezone.utc)
    targets = [e for e in feed['events'] if now - timedelta(days=14) <= datetime.fromisoformat(e['date'].replace('Z', '+00:00')) <= now]
    failed, updated = [], []
    for event in sorted(targets, key=lambda e: e['date'], reverse=True)[:3]:
        try:
            bouts = completed_card(fetch_page(event), event, now)
            event.update(bouts=bouts, status='completed', checkedAt=now.date().isoformat(),
                         resultsSource=event['source'], resultsCheckedAt=now.isoformat())
            updated.append(event['id'])
            if any(not b.get('winner') and not b.get('outcome') for b in bouts):
                failed.append(event['id'])
                print(f"::warning::Some saved bouts remain unverified for {event['id']}")
        except Exception as error:
            failed.append(event['id'])
            print(f"::warning::Official results preserved for {event['id']}: {error}")
    feed['resultsVerification'] = {'checkedAt': now.isoformat(), 'verifiedIds': updated, 'failedIds': failed}
    return feed


def main():
    path = ROOT / 'assets/data/ufc-events.json'
    feed = reconcile(json.loads(path.read_text()))
    with tempfile.NamedTemporaryFile('w', dir=path.parent, delete=False) as f:
        json.dump(feed, f, ensure_ascii=False, indent=2)
        f.write('\n')
    Path(f.name).replace(path)
    print('Official results verification:', json.dumps(feed['resultsVerification']))


if __name__ == '__main__':
    main()
