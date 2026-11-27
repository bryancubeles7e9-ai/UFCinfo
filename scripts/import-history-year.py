#!/usr/bin/env python3
"""Add a past season's completed UFC results to the permanent fight history.

Usage: python3 scripts/import-history-year.py 2025 [--dry-run]

Reads each official event page on UFC.com (the same source and parser as the daily results check)
and merges every completed bout (main card, prelims and early prelims) into
assets/data/fight-history.json. It never touches the current season's events feed and never
removes saved bouts. Events are found without a listing page: numbered cards are tried by number
and Fight Nights by their dated address (ufc-fight-night-<month>-<day>-<year>); addresses that do
not exist are skipped. Nothing is written unless the season looks complete.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
import importlib.util
import json
from pathlib import Path
import sys
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
HISTORY = ROOT / 'assets/data/fight-history.json'
UFC = 'https://www.ufc.com/event/'
MONTHS = ('january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december')
spec = importlib.util.spec_from_file_location('official_card', ROOT / 'scripts/import-fight-nights.py')
html = importlib.util.module_from_spec(spec)
spec.loader.exec_module(html)


def fetch(slug):
    """The event page, or None when UFC.com has no such event (404 or a redirect elsewhere)."""
    url = UFC + slug
    try:
        with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=25) as response:
            if response.geturl().rstrip('/') != url:
                return None
            data = response.read(3_000_001)
    except HTTPError as error:
        if error.code in (403, 404, 410):
            return None
        raise
    if len(data) > 3_000_000:
        raise ValueError('Official page too large')
    return data.decode('utf-8')


def candidates(year, numbers):
    slugs = [f'ufc-{n}' for n in numbers]
    day = date(year, 1, 1)
    while day.year == year:
        slugs.append(f'ufc-fight-night-{MONTHS[day.month - 1]}-{day.day:02d}-{year}')
        day += timedelta(days=1)
    return slugs


def parse_event(page, slug, year):
    """Completed bouts of one official card, or None if it is not a finished card of that year."""
    parser = html.Parser()
    parser.feed(page)
    root = parser.root
    times = root.find('c-event-fight-card-broadcaster__time') + root.find('c-hero__headline-suffix')
    stamp = next((n.attrs.get('data-timestamp') for n in times if n.attrs.get('data-timestamp')), None)
    if not stamp:
        return None
    start = datetime.fromtimestamp(int(stamp), timezone.utc)
    if start.year != year or start > datetime.now(timezone.utc):
        return None
    number = slug[4:] if slug[4:].isdigit() else None
    bouts, incomplete = [], 0
    for card_id, section in (('main-card', 'main'), ('prelims-card', 'prelims'), ('early-prelims', 'early-prelims')):
        for card in root.find(id=card_id):
            for fight in card.find('c-listing-fight'):
                red = html.first(fight, 'c-listing-fight__corner-name--red')
                blue = html.first(fight, 'c-listing-fight__corner-name--blue')
                corners = [fight.find('c-listing-fight__corner--' + c) for c in ('red', 'blue')]
                wins = [bool(c and c[0].find('c-listing-fight__outcome--win')) for c in corners]
                draw = bool(fight.find('c-listing-fight__outcome--draw'))
                no_contest = bool(fight.find('c-listing-fight__outcome--nc'))
                if not red or not blue or red == blue or sum(wins) > 1 or not (any(wins) or draw or no_contest):
                    incomplete += 1
                    continue
                result = 'red' if wins[0] else 'blue' if wins[1] else 'draw' if draw else 'nc'
                bouts.append({'date': start.isoformat(), 'event': slug, 'title': f'UFC {number}' if number else 'UFC Fight Night',
                              'red': red, 'blue': blue, 'result': result,
                              'method': html.first(fight, 'method') or None, 'round': html.first(fight, 'round') or None})
    if len({frozenset((b['red'], b['blue'])) for b in bouts}) != len(bouts):
        raise ValueError(f'{slug}: duplicate bouts')
    return {'slug': slug, 'date': start.isoformat(), 'bouts': bouts, 'incomplete': incomplete}


def import_year(year, numbers, read=fetch, workers=4):
    events, missing = [], 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for slug, page in zip(candidates(year, numbers), pool.map(lambda s: (read(s)), candidates(year, numbers))):
            if page is None:
                missing += 1
                continue
            event = parse_event(page, slug, year)
            if event:
                events.append(event)
    return sorted(events, key=lambda e: e['date']), missing


def check_season(events, year):
    """A season has dozens of cards with full results; refuse anything that looks partial."""
    bouts = sum(len(e['bouts']) for e in events)
    problems = [f"{e['slug']}: solo {len(e['bouts'])} combates con resultado" for e in events if len(e['bouts']) < 5]
    if not 30 <= len(events) <= 60:
        problems.append(f'{len(events)} veladas encontradas en {year} (se esperan 30-60)')
    if bouts < 350:
        problems.append(f'{bouts} combates con resultado (se esperan 350 o más)')
    return problems


def merge(history, events):
    key = lambda b: f"{b['event']}|{b['red']}|{b['blue']}"
    saved = {key(b): b for b in history['bouts']}
    added = 0
    for event in events:
        for bout in event['bouts']:
            if key(bout) not in saved:
                added += 1
            saved.setdefault(key(bout), bout)   # Never overwrite a result already saved from the live feed.
    bouts = sorted(saved.values(), key=lambda b: (b['date'], key(b)), reverse=True)
    return {**history, 'bouts': bouts}, added


def write(history):
    HISTORY.write_text('{"schemaVersion":1,"source":"UFC","bouts":[\n' + ',\n'.join(json.dumps(b, ensure_ascii=False, separators=(',', ':')) for b in history['bouts']) + '\n]}\n')


def main():
    year = int(sys.argv[1])
    numbers = {2025: range(311, 324)}.get(year, range(0))
    events, missing = import_year(year, numbers)
    for event in events:
        print(f"{event['date'][:10]} {event['slug']}: {len(event['bouts'])} combates" + (f" ({event['incomplete']} sin resultado completo)" if event['incomplete'] else ''))
    print(f'{len(events)} veladas de {year}, {sum(len(e["bouts"]) for e in events)} combates; {missing} direcciones sin velada')
    problems = check_season(events, year)
    for problem in problems:
        print(f'::error::{problem}')
    if problems:
        return 1
    history, added = merge(json.loads(HISTORY.read_text()), events)
    print(f'{added} combates nuevos en el historial')
    if '--dry-run' not in sys.argv:
        write(history)
    return 0


if __name__ == '__main__':
    sys.exit(main())
