"""Refresh nearby UFC cards from Cito while retaining the existing verified archive."""
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo
import argparse
import json
import os
import re
import sys
import tempfile

API = 'https://api.citoapi.com/api/v1/ufc/events'
ROOT = Path(__file__).resolve().parents[1]
SOURCE_URL = 'https://citoapi.com/ufc-api/'


class SyncError(Exception):
    pass


def request_json(path, key):
    request = Request(API + path, headers={'x-api-key': key, 'Accept': 'application/json'})
    try:
        with urlopen(request, timeout=25) as response:
            value = json.load(response)
    except HTTPError as error:
        raise SyncError(f'Cito HTTP {error.code}; check key or quota') from None
    except (URLError, TimeoutError, OSError, ValueError):
        raise SyncError('Cito request failed') from None
    if not isinstance(value, dict) or value.get('success') is not True or 'data' not in value:
        raise SyncError('Unexpected Cito response')
    return value['data']


def date_of(row):
    value = row.get('startsAt') or row.get('eventDate')
    if not isinstance(value, str):
        raise SyncError('Missing event date')
    try:
        date = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if date.tzinfo is None:
            raise ValueError()
        return date.astimezone(timezone.utc)
    except ValueError:
        raise SyncError('Invalid event date') from None


def identity(row):
    slug = row.get('slug') or row.get('eventSlug')
    name = row.get('name') or row.get('title') or ''
    if not isinstance(slug, str) or not re.fullmatch(r'[a-z0-9-]{3,100}', slug):
        raise SyncError('Invalid Cito event slug')
    if 'freedom-250' in slug or 'Freedom 250' in name:
        return 'ufc-freedom-250', None, 'special'
    match = re.search(r'(?:^|-)ufc-(\d{3})(?:-|$)', slug)
    if not match:
        match = re.search(r'\bUFC\s+(\d{3})(?=\b|:)', name, re.I)
    if match:
        number = int(match.group(1))
        return f'ufc-{number}', number, 'numbered'
    if not re.search(r'fight[ -]?night', slug + ' ' + name, re.I):
        return None, None, None
    day = date_of(row).astimezone(ZoneInfo('America/New_York'))
    return f'ufc-fight-night-{day.strftime("%B-%d-%Y").lower()}', None, 'fight-night'


def rows(value):
    if not isinstance(value, list) or len(value) > 100 or not all(isinstance(item, dict) for item in value):
        raise SyncError('Invalid Cito event or bout list')
    return value


def corner_name(bout, corner):
    fighters = bout.get('fighters')
    if not isinstance(fighters, list):
        raise SyncError('Missing fight corners')
    matches = [f for f in fighters if isinstance(f, dict) and f.get('corner') == corner]
    if len(matches) != 1 or not isinstance(matches[0].get('fighterName'), str) or not matches[0]['fighterName'].strip():
        raise SyncError('Invalid fight corner')
    return matches[0]['fighterName'].strip(), matches[0]


def normalize_bouts(value, completed):
    main = [bout for bout in rows(value) if str(bout.get('cardSection', '')).lower() == 'main card' and bout.get('status') != 'cancelled']
    if completed and not main:
        raise SyncError('Missing completed main card')
    main.sort(key=lambda bout: (not bool(bout.get('isMainEvent')), bout.get('boutOrder') if isinstance(bout.get('boutOrder'), int) else 9999))
    result = []
    for bout in main:
        red, red_corner = corner_name(bout, 'red')
        blue, blue_corner = corner_name(bout, 'blue')
        winner = (bout.get('result') or {}).get('winner') if isinstance(bout.get('result'), dict) else None
        if winner is None:
            won = [side for side, fighter in [('red', red_corner), ('blue', blue_corner)] if str(fighter.get('outcome', '')).lower() in ('win', 'winner')]
            winner = won[0] if len(won) == 1 else None
        if winner not in (None, 'red', 'blue'):
            raise SyncError('Invalid winner')
        method = bout.get('method') or (bout.get('result') or {}).get('method') or ''
        division = bout.get('weightClass') or 'División no indicada'
        if not isinstance(method, str) or not isinstance(division, str):
            raise SyncError('Invalid bout text')
        round_value = bout.get('resultRound') or (bout.get('result') or {}).get('round')
        time_value = bout.get('resultTime') or (bout.get('result') or {}).get('time') or ''
        if not isinstance(time_value, str):
            raise SyncError('Invalid result time')
        outcome = None
        if winner is None and completed:
            if re.search(r'no.?contest', method, re.I): outcome = 'Sin resultado (No contest)'
            elif re.search(r'draw|empate', method, re.I): outcome = 'Empate'
        result.append({'red': red, 'blue': blue, 'division': division, 'winner': red if winner == 'red' else blue if winner == 'blue' else None, 'outcome': outcome, 'method': method, 'round': str(round_value) if round_value is not None else '', 'time': time_value})
    return result


def synchronize(fetch, previous, now):
    old = {e['id']: {**e, 'dataSource': e.get('dataSource') or previous.get('source', 'UFC')}
           for e in previous.get('events', []) if isinstance(e, dict) and isinstance(e.get('id'), str)}
    upcoming, recent = rows(fetch('/upcoming')), rows(fetch('/recent'))
    candidates = {}
    for is_recent, listing in ((False, upcoming), (True, recent)):
        for row in listing:
            eid, number, kind = identity(row)
            if eid is None: continue
            date = date_of(row)
            if is_recent and (date.year != now.year or date > now + timedelta(days=1)): continue
            if not is_recent and date < now - timedelta(days=2): continue
            if eid in candidates: raise SyncError('Duplicate event in Cito lists')
            candidates[eid] = (row, number, kind, is_recent, date)
    if not candidates:
        raise SyncError('No UFC events found in Cito lists')
    near_recent = sorted(((eid, c) for eid, c in candidates.items() if c[3] and c[4] >= now - timedelta(days=14)), key=lambda pair: pair[1][4], reverse=True)
    future = sorted(((eid, c) for eid, c in candidates.items() if not c[3]), key=lambda pair: pair[1][4])
    selected = near_recent[:1] + future[:2]
    if len(selected) < 3:
        selected += [pair for pair in future[2:] + near_recent[1:] if pair not in selected][:3-len(selected)]
    for eid, (row, number, kind, is_recent, date) in selected:
        slug = row.get('slug') or row.get('eventSlug')
        bouts = normalize_bouts(fetch('/' + quote(slug, safe='') + '/bouts'), is_recent)
        prior = old.get(eid, {})
        name = row.get('name') or row.get('title') or ''
        if not isinstance(name, str): raise SyncError('Invalid event name')
        venue = row.get('venue') or row.get('location') or ''
        if isinstance(venue, dict):
            venue = ', '.join(str(venue[k]) for k in ('name', 'city', 'country') if venue.get(k))
        if not isinstance(venue, str): raise SyncError('Invalid venue')
        status = 'completed' if is_recent else 'scheduled'
        old[eid] = {'id': eid, 'number': number, 'eventKind': kind,
                    'title': f'UFC {number}' if number else 'UFC Freedom 250' if kind == 'special' else 'UFC Fight Night',
                    'subtitle': f"{bouts[0]['red']} vs {bouts[0]['blue']}" if bouts else 'Cartelera pendiente de anuncio',
                    'status': status, 'date': date.isoformat(), 'location': venue or prior.get('location') or 'Recinto no indicado',
                    'type': 'official', 'source': f'https://www.ufc.com/event/{eid}', 'checkedAt': now.date().isoformat(),
                    'bouts': bouts, 'dataSource': 'Cito',
                    'poster': prior.get('poster'), 'posterSource': prior.get('posterSource'), 'posterAlt': prior.get('posterAlt')}
    # A Cito outage, limited recent window, or incomplete card cannot erase the archive.
    events = [e for e in old.values() if e.get('status') != 'completed' or date_of({'startsAt': e['date']}).year == now.year]
    events.sort(key=lambda e: e['date'], reverse=True)
    if len(events) > 100: raise SyncError('Events feed exceeds capacity')
    old_providers = {e['dataSource'] for e in events}
    source = 'Cito + UFCalendar' if 'UFCalendar' in old_providers else 'Cito'
    return {'schemaVersion': 1, 'year': now.year, 'source': source, 'sourceUrl': SOURCE_URL, 'synchronizedAt': now.isoformat(), 'events': events}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT/'assets/data/ufc-events.json')
    args = parser.parse_args()
    key = os.environ.get('CITO_API_KEY', '').strip()
    if not key:
        print('CITO_API_KEY is not configured. Current events remain unchanged.', file=sys.stderr)
        return 1
    try:
        previous = json.loads(args.output.read_text(encoding='utf-8'))
        payload = synchronize(lambda path: request_json(path, key), previous, datetime.now(timezone.utc))
        # Preserve the last good snapshot when any query or validation fails.
        with tempfile.NamedTemporaryFile('w', encoding='utf-8', dir=args.output.parent, delete=False) as file:
            temp = Path(file.name)
            json.dump(payload, file, ensure_ascii=False, indent=2)
            file.write('\n')
        temp.replace(args.output)
    except (SyncError, ValueError, TypeError, KeyError, OSError):
        print('Cito synchronization failed. Last good events file was preserved.', file=sys.stderr)
        return 1
    print(f"Updated {len(payload['events'])} UFC events; at most five Cito requests in this run.")
    return 0


if __name__ == '__main__':
    sys.exit(main())
