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
import unicodedata
from copy import deepcopy

API = 'https://api.citoapi.com/api/v1/ufc/events'
ROOT = Path(__file__).resolve().parents[1]
SOURCE_URL = 'https://citoapi.com/ufc-api/'


class SyncError(Exception):
    pass


def pair(bout):
    def name(value):
        return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode().lower())
    return tuple(sorted(name(bout[k]) for k in ('red', 'blue')))


def change(event, kind, now, **details):
    entry = {'kind': kind, 'checkedAt': now.isoformat(), 'source': 'Cito', **details}
    event['cardChanges'] = (event.get('cardChanges', []) + [entry])[-100:]


def merge_bouts(prior, incoming, cancelled, now):
    """Absence is not cancellation: require a second comparable snapshot."""
    current = {pair(b): b for b in incoming}
    if len(current) != len(incoming) or any(len(set(key)) != 2 for key in current):
        raise SyncError('Duplicate or invalid fight pairing')
    saved = prior.get('bouts', [])
    pending = {}
    result = list(incoming)
    # A major drop or an empty response is treated as incomplete, indefinitely.
    comparable = bool(incoming) and len(incoming) >= max(1, (len(saved) + 1) // 2)
    snapshot = sorted('|'.join(key) for key in current)
    for bout in saved:
        key = pair(bout)
        if key in current:
            if bout.get('winner') or bout.get('outcome'):
                # A stale provider response must not erase a verified result.
                if not current[key].get('winner') and not current[key].get('outcome'):
                    result[result.index(current[key])] = bout
            continue
        if bout.get('winner') or bout.get('outcome'):
            result.append(bout)
            continue
        if key in cancelled:
            change(prior, 'cancelled', now, bout=bout)
            continue
        replacements = [b for b in incoming if set(pair(b)) & set(key) and pair(b) not in {pair(s) for s in saved}]
        if len(replacements) == 1:
            change(prior, 'replaced', now, bout=bout, replacement=replacements[0])
            continue
        token = '|'.join(key)
        old_pending = prior.get('pendingBoutRemovals', {}).get(token, {})
        first = old_pending.get('firstSeenAt')
        enough_time = first and now - datetime.fromisoformat(first) >= timedelta(hours=1)
        consistent = old_pending.get('snapshot') == snapshot
        if comparable and enough_time and old_pending.get('comparable') and consistent:
            change(prior, 'removed-from-card', now, bout=bout)
            continue
        pending[token] = {'firstSeenAt': first if comparable and old_pending.get('comparable') and consistent else now.isoformat(),
                          'comparable': comparable, 'snapshot': snapshot, 'bout': bout}
        result.append(bout)
    prior['pendingBoutRemovals'] = pending
    for bout in incoming:
        if pair(bout) not in {pair(s) for s in saved}:
            change(prior, 'added', now, bout=bout)
    return result


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
    sections = {'main card': 'main', 'prelims': 'prelims', 'preliminary card': 'prelims',
                'early prelims': 'early-prelims', 'early preliminary card': 'early-prelims'}
    main = []
    for bout in rows(value):
        if str(bout.get('status', '')).lower() in ('cancelled', 'canceled'):
            continue
        section = sections.get(str(bout.get('cardSection', '')).strip().lower())
        if section is None:
            raise SyncError('Unknown card section')
        main.append({**bout, '_section': section})
    if completed and not any(b['_section'] == 'main' for b in main):
        raise SyncError('Missing completed main card')
    order = {'main': 0, 'prelims': 1, 'early-prelims': 2}
    main.sort(key=lambda bout: (order[bout['_section']], not bool(bout.get('isMainEvent')), bout.get('boutOrder') if isinstance(bout.get('boutOrder'), int) else 9999))
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
        result.append({'section': bout['_section'], 'red': red, 'blue': blue, 'division': division, 'winner': red if winner == 'red' else blue if winner == 'blue' else None, 'outcome': outcome, 'method': method, 'round': str(round_value) if round_value is not None else '', 'time': time_value})
    return result


def synchronize(fetch, previous, now):
    old = {e['id']: {**deepcopy(e), 'dataSource': e.get('dataSource') or previous.get('source', 'UFC')}
           for e in previous.get('events', []) if isinstance(e, dict) and isinstance(e.get('id'), str)}
    upcoming, recent = rows(fetch('/upcoming')), rows(fetch('/recent'))
    candidates = {}
    for is_recent, listing in ((False, upcoming), (True, recent)):
        for row in listing:
            eid, number, kind = identity(row)
            if eid is None: continue
            slug = row.get('slug') or row.get('eventSlug')
            matches = [e for e in old.values() if e.get('citoSlug') == slug]
            if len(matches) > 1:
                raise SyncError('Ambiguous saved provider identity')
            if matches:
                # Keep links/favourites stable when a Fight Night changes date.
                eid = matches[0]['id']
            date = date_of(row)
            if is_recent and (date.year != now.year or date > now + timedelta(days=1)): continue
            if not is_recent and date < now - timedelta(days=2): continue
            if eid in candidates: raise SyncError('Duplicate event in Cito lists')
            candidates[eid] = (row, number, kind, is_recent, date)
    if not candidates:
        raise SyncError('No UFC events found in Cito lists')
    inactive = set()
    for eid, (row, number, kind, is_recent, date) in candidates.items():
        prior = old.get(eid)
        status = str(row.get('status', '')).lower()
        if status in ('cancelled', 'canceled', 'postponed'):
            inactive.add(eid)
            if prior and prior.get('status') != 'completed':
                target_status = 'postponed' if status == 'postponed' else 'cancelled'
                if prior.get('status') != target_status:
                    change(prior, target_status, now)
                prior.update(status=target_status, checkedAt=now.date().isoformat(), citoSlug=row.get('slug') or row.get('eventSlug'))
            continue
        if prior and prior.get('status') != 'completed':
            if date_of({'startsAt': prior['date']}) != date:
                change(prior, 'rescheduled', now, previousDate=prior['date'], date=date.isoformat())
                prior['date'] = date.isoformat()
            prior['citoSlug'] = row.get('slug') or row.get('eventSlug')
            # An unknown/absent status cannot silently reactivate a cancelled card.
            if prior.get('status') in ('cancelled', 'postponed'):
                if status in ('scheduled', 'announced'):
                    change(prior, 'reinstated', now)
                    prior['status'] = status
                else:
                    inactive.add(eid)
    near_recent = sorted(((eid, c) for eid, c in candidates.items() if eid not in inactive and c[3] and c[4] >= now - timedelta(days=14)), key=lambda pair: pair[1][4], reverse=True)
    future = sorted(((eid, c) for eid, c in candidates.items() if eid not in inactive and not c[3]), key=lambda pair: pair[1][4])
    # Discovery uses the already fetched list, not an extra paid bout request.
    # Far-away cards (including next year) must be visible before they enter
    # the three-card refresh window. Preserve any existing verified bouts.
    for eid, (row, number, kind, is_recent, date) in future:
        if eid in old:
            continue
        venue = row.get('venue') or row.get('location') or ''
        if isinstance(venue, dict):
            venue = ', '.join(str(venue[k]) for k in ('name', 'city', 'country') if venue.get(k))
        if not isinstance(venue, str):
            raise SyncError('Invalid venue')
        old[eid] = {
            'id': eid, 'number': number, 'eventKind': kind,
            'citoSlug': row.get('slug') or row.get('eventSlug'),
            'title': f'UFC {number}' if number else 'UFC Freedom 250' if kind == 'special' else 'UFC Fight Night',
            'subtitle': 'Cartelera pendiente de anuncio', 'status': 'announced',
            'date': date.isoformat(), 'location': venue or 'Recinto no indicado',
            'type': 'official', 'source': f'https://www.ufc.com/event/{eid}',
            'checkedAt': now.date().isoformat(), 'bouts': [], 'dataSource': 'Cito',
            'poster': None, 'posterSource': None, 'posterAlt': None,
        }
    selected = near_recent[:1] + future[:2]
    if len(selected) < 3:
        selected += [pair for pair in future[2:] + near_recent[1:] if pair not in selected][:3-len(selected)]
    for eid, (row, number, kind, is_recent, date) in selected:
        slug = row.get('slug') or row.get('eventSlug')
        raw_bouts = rows(fetch('/' + quote(slug, safe='') + '/bouts'))
        bouts = normalize_bouts(raw_bouts, is_recent)
        prior = old.get(eid, {})
        cancelled = {pair({'red': corner_name(b, 'red')[0], 'blue': corner_name(b, 'blue')[0]})
                     for b in raw_bouts if str(b.get('status', '')).lower() in ('cancelled', 'canceled')}
        if cancelled.intersection(pair(b) for b in bouts):
            raise SyncError('Conflicting active and cancelled pairing')
        bouts = merge_bouts(prior, bouts, cancelled, now)
        if len(bouts) > 30:
            raise SyncError('Merged card exceeds capacity')
        bouts.sort(key=lambda b: {'main': 0, 'prelims': 1, 'early-prelims': 2}.get(b.get('section', 'main'), 0))
        name = row.get('name') or row.get('title') or ''
        if not isinstance(name, str): raise SyncError('Invalid event name')
        venue = row.get('venue') or row.get('location') or ''
        if isinstance(venue, dict):
            venue = ', '.join(str(venue[k]) for k in ('name', 'city', 'country') if venue.get(k))
        if not isinstance(venue, str): raise SyncError('Invalid venue')
        status = 'completed' if is_recent or prior.get('status') == 'completed' else 'scheduled'
        old[eid] = {**prior, 'id': eid, 'number': number, 'eventKind': kind, 'citoSlug': slug,
                    'title': f'UFC {number}' if number else 'UFC Freedom 250' if kind == 'special' else 'UFC Fight Night',
                    'subtitle': f"{bouts[0]['red']} vs {bouts[0]['blue']}" if bouts else 'Cartelera pendiente de anuncio',
                    'status': status, 'date': date.isoformat(), 'location': venue or prior.get('location') or 'Recinto no indicado',
                    'type': 'official', 'source': f'https://www.ufc.com/event/{eid}', 'checkedAt': now.date().isoformat(),
                    'bouts': bouts, 'dataSource': 'Cito',
                    'poster': prior.get('poster'), 'posterSource': prior.get('posterSource'), 'posterAlt': prior.get('posterAlt')}
    # Label a transfer only after removal at the origin has been confirmed.
    # Merely finding the same pair elsewhere is not enough (it could be a rematch).
    for origin in old.values():
        for entry in origin.get('cardChanges', []):
            if entry['kind'] not in ('cancelled', 'removed-from-card') or entry['checkedAt'] != now.isoformat() or 'bout' not in entry:
                continue
            destinations = [e for e in old.values() if e['id'] != origin['id']
                            and e.get('status') in ('scheduled', 'announced')
                            and date_of({'startsAt': e['date']}) > now
                            and any(pair(b) == pair(entry['bout']) for b in e.get('bouts', []))]
            if len(destinations) == 1:
                entry.update(kind='moved', destinationEventId=destinations[0]['id'])
    # A Cito outage, limited recent window, or incomplete card cannot erase the archive.
    events = [e for e in old.values() if e.get('status') != 'completed' or date_of({'startsAt': e['date']}).year == now.year]
    events.sort(key=lambda e: e['date'], reverse=True)
    if len(events) > 100: raise SyncError('Events feed exceeds capacity')
    old_providers = {e['dataSource'] for e in events}
    source = 'Cito + UFCalendar' if 'UFCalendar' in old_providers else 'Cito'
    return {**previous, 'schemaVersion': 1, 'year': now.year, 'source': source, 'sourceUrl': SOURCE_URL, 'synchronizedAt': now.isoformat(), 'events': events}


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
    except SyncError as error:
        print(f'Cito synchronization failed: {error}. Last good events file was preserved.', file=sys.stderr)
        return 1
    except (ValueError, TypeError, KeyError, AttributeError, OSError):
        print('Cito synchronization failed. Last good events file was preserved.', file=sys.stderr)
        return 1
    print(f"Updated {len(payload['events'])} UFC events; at most five Cito requests in this run.")
    return 0


if __name__ == '__main__':
    sys.exit(main())
