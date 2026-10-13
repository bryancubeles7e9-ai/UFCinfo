"""Add official preliminary cards to the existing year's archive.

Usage: python3 scripts/import-event-prelims.py DIRECTORY_OF_OFFICIAL_EVENT_HTML
Downloads must be named EVENT_ID.html. Existing main-card data is preserved.
Missing/invalid pages leave their event untouched and are reported.
"""
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('official_html', ROOT / 'scripts/import-fight-nights.py')
html = importlib.util.module_from_spec(spec)
spec.loader.exec_module(html)


def preliminary_bouts(text, event):
    parser = html.Parser()
    parser.feed(text)
    main = parser.root.find(id='main-card')
    if len(main) != 1:
        raise ValueError('Official main card missing')
    # Confirm this is the same card before attaching its preliminaries.
    official_pairs = {frozenset((html.first(f, 'c-listing-fight__corner-name--red').casefold(),
                                  html.first(f, 'c-listing-fight__corner-name--blue').casefold()))
                      for f in main[0].find('c-listing-fight')}
    existing = [b for b in event['bouts'] if b.get('section', 'main') == 'main']
    if existing and not any(frozenset((b['red'].casefold(), b['blue'].casefold())) in official_pairs for b in existing):
        raise ValueError('Main card identity mismatch')
    bouts = []
    seen = {frozenset((b['red'].casefold(), b['blue'].casefold())) for b in existing}
    for card_id, section in [('prelims-card', 'prelims'), ('early-prelims', 'early-prelims')]:
        cards = parser.root.find(id=card_id)
        if len(cards) > 1:
            raise ValueError('Ambiguous card section')
        for card in cards:
            for fight in card.find('c-listing-fight'):
                red = html.first(fight, 'c-listing-fight__corner-name--red')
                blue = html.first(fight, 'c-listing-fight__corner-name--blue')
                if not red or not blue:
                    raise ValueError('Incomplete preliminary bout')
                pair = frozenset((red.casefold(), blue.casefold()))
                if len(pair) != 2 or pair in seen:
                    raise ValueError('Duplicate preliminary bout')
                seen.add(pair)
                corners = [fight.find('c-listing-fight__corner--' + c) for c in ('red', 'blue')]
                winner = red if corners[0] and corners[0][0].find('c-listing-fight__outcome--win') else blue if corners[1] and corners[1][0].find('c-listing-fight__outcome--win') else None
                outcome = 'Empate' if fight.find('c-listing-fight__outcome--draw') else 'Sin resultado (No contest)' if fight.find('c-listing-fight__outcome--nc') else None
                bouts.append(dict(red=red, blue=blue, section=section,
                                  division=html.first(fight, 'c-listing-fight__class-text'),
                                  winner=winner, outcome=outcome, method=html.first(fight, 'method'),
                                  round=html.first(fight, 'round'), time=html.first(fight, 'time')))
    if len(existing) + len(bouts) > 30:
        raise ValueError('Too many bouts')
    return bouts


def main():
    target = ROOT / 'assets/data/ufc-events.json'
    feed = json.loads(target.read_text())
    updated = added = 0
    for event in feed['events']:
        if datetime.fromisoformat(event['date'].replace('Z', '+00:00')).year != feed['year']:
            continue
        try:
            bouts = preliminary_bouts((Path(sys.argv[1]) / (event['id'] + '.html')).read_text(), event)
            if not bouts:
                print(event['id'], 'no published preliminaries; preserved')
                continue
            main_card = [{**b, 'section': 'main'} for b in event['bouts'] if b.get('section', 'main') == 'main']
            event['bouts'] = main_card + bouts
            event['prelimsSource'] = event['source']
            event['prelimsCheckedAt'] = datetime.now(timezone.utc).isoformat()
            updated += 1
            added += len(bouts)
            print(event['id'], len(bouts), 'preliminary bouts')
        except (OSError, ValueError) as error:
            print(event['id'], 'preserved:', error)
    target.write_text(json.dumps(feed, ensure_ascii=False, indent=2) + '\n')
    (ROOT / 'assets/js/official-events.js').write_text('// Official UFC event snapshot, including available preliminaries.\nexport const officialEvents = ' + json.dumps(feed['events'], ensure_ascii=False, indent=2) + ';\n')
    print(f'Updated {updated} events with {added} preliminary bouts')


if __name__ == '__main__':
    main()
