"""Sync completed and announced numbered UFC main cards from UFCalendar; keep last good data on failure."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

API = 'https://api.ufcalendar.com/v1'
ROOT = Path(__file__).resolve().parents[1]

class SyncError(Exception):
    pass

def utc_date(value):
    try:
        date = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if date.tzinfo is None:
            raise ValueError()
        return date.astimezone(timezone.utc)
    except (AttributeError, TypeError, ValueError):
        raise SyncError('Invalid event timestamp') from None

def request_json(path, key, params=None):
    url = API + path + ('?' + urlencode(params) if params else '')
    req = Request(url, headers={'Authorization': 'Bearer ' + key, 'Accept': 'application/json', 'User-Agent': 'Octagon/1.0'})
    for attempt in range(3):
        try:
            with urlopen(req, timeout=30) as response:
                payload = json.load(response)
            if not isinstance(payload, dict) or 'data' not in payload:
                raise SyncError('Unexpected API response')
            return payload
        except HTTPError as error:
            if (error.code == 429 or error.code >= 500) and attempt < 2:
                try:
                    delay = int(error.headers.get('Retry-After', 2 ** (attempt + 1)))
                except (ValueError, TypeError):
                    delay = 2 ** (attempt + 1)
                if delay > 30:
                    raise SyncError('API rate limit; retry on next scheduled run') from None
                time.sleep(max(1, delay))
                continue
            # Never print request headers, key, or provider error bodies.
            raise SyncError(f'UFCalendar returned HTTP {error.code}; check plan, key or quota') from None
        except (URLError, TimeoutError, OSError):
            if attempt < 2:
                time.sleep(2 ** (attempt + 1))
                continue
            raise SyncError('UFCalendar connection failed') from None
        except (json.JSONDecodeError, UnicodeDecodeError):
            raise SyncError('Invalid JSON from UFCalendar') from None

def event_number(event):
    if event.get('org') != 'ufc' or event.get('status') not in ('completed', 'announced', 'scheduled', 'live'):
        return None
    numbering = str(event.get('numbering') or '').strip()
    match = re.fullmatch(r'(?:UFC\s+)?(\d+)', numbering)
    if not match:
        # Some sponsored cards (e.g. Crypto.com UFC 331) have no numbering.
        match = re.search(r'\bUFC\s+(\d+)(?=\s*(?::|$))', event.get('title') or '')
    return int(match.group(1)) if match else None

def event_identity(event):
    if event.get('org') != 'ufc' or event.get('status') not in ('completed', 'announced', 'scheduled', 'live'):
        return None
    if re.search(r'\bUFC\s+Freedom\s+250\b', event.get('title') or '', re.I):
        return 'ufc-freedom-250'
    number = event_number(event)
    return f'ufc-{number}' if number is not None else None

def list_events(fetch, year, now, upcoming=False):
    params = {'org': 'ufc', 'status': 'completed', 'from': f'{year}-01-01', 'to': now.date().isoformat(), 'order': 'asc', 'limit': 100}
    if upcoming:
        params = {'org': 'ufc', 'status': 'upcoming', 'order': 'asc', 'limit': 100}
    events, seen, cursors = [], set(), set()
    for _ in range(20):
        page = fetch('/events', params)
        rows = page.get('data')
        if not isinstance(rows, list):
            raise SyncError('Invalid events list')
        for row in rows:
            if not isinstance(row, dict):
                raise SyncError('Invalid event row')
            identity = event_identity(row)
            if identity is None:
                continue
            date = utc_date(row.get('main_card_at') or row.get('starts_at'))
            if upcoming:
                if row.get('status') not in ('announced', 'scheduled', 'live') or (date < now and row.get('status') != 'live'):
                    continue
            elif row.get('status') != 'completed' or date.year != year or date > now:
                continue
            if identity in seen:
                raise SyncError('Duplicate event number')
            seen.add(identity)
            events.append(row)
        pagination = page.get('meta', {}).get('pagination', {})
        if not isinstance(pagination.get('has_more'), bool):
            raise SyncError('Missing pagination metadata')
        if not pagination['has_more']:
            return events
        cursor = pagination.get('next_cursor')
        if not isinstance(cursor, str) or not cursor or cursor in cursors:
            raise SyncError('Invalid pagination cursor')
        cursors.add(cursor)
        params = {**params, 'cursor': cursor}
    raise SyncError('Pagination exceeded safety limit')

def normalize_event(event, now):
    number = event_number(event)
    identity = event_identity(event)
    if identity is None:
        raise SyncError('Event detail is not a supported UFC event')
    title = 'UFC Freedom 250' if identity == 'ufc-freedom-250' else f'UFC {number}'
    if identity == 'ufc-freedom-250':
        number = None
    date = utc_date(event.get('main_card_at') or event.get('starts_at'))
    status = event['status']
    if status == 'completed' and (date.year != now.year or date > now):
        raise SyncError('Completed event detail outside current year')
    if status in ('announced', 'scheduled') and date < now:
        raise SyncError('Upcoming event date has passed')
    card = event.get('card')
    if not isinstance(card, list):
        raise SyncError('Missing fight card')
    main = []
    for fight in card:
        if not isinstance(fight, dict):
            raise SyncError('Invalid fight')
        if fight.get('card_section') == 'main' and fight.get('status') != 'cancelled':
            main.append(fight)
    if not main and status == 'completed':
        raise SyncError(f'No main card for UFC {number}')
    main.sort(key=lambda f: (not f.get('is_main', False), f.get('ordering') if isinstance(f.get('ordering'), int) else 9999))
    bouts = []
    for fight in main:
        a, b = fight.get('fighter_a'), fight.get('fighter_b')
        if status != 'completed' and (not a or not b):
            continue
        if not isinstance(a, dict) or not isinstance(b, dict) or not all(isinstance(c.get('name'), str) and c['name'].strip() and isinstance(c.get('id'), int) for c in (a,b)):
            raise SyncError('Missing fighter identity')
        result = fight.get('result') or {}
        if not isinstance(result, dict):
            raise SyncError('Invalid result')
        winner_id = result.get('winner_fighter_id')
        if winner_id is not None and winner_id not in (a['id'], b['id']):
            raise SyncError('Winner does not match fight corners')
        winner = a['name'] if winner_id == a['id'] else b['name'] if winner_id == b['id'] else None
        for field in ('method', 'time'):
            if result.get(field) is not None and not isinstance(result[field], str):
                raise SyncError('Invalid result text')
        if fight.get('weight_class') is not None and not isinstance(fight['weight_class'], str):
            raise SyncError('Invalid division')
        method = result.get('method')
        normalized = result.get('method_normalized')
        if winner_id is None and (fight.get('status') == 'no_contest' or normalized == 'no_contest'):
            outcome = 'Sin resultado (No contest)'
        elif winner_id is None and normalized == 'draw':
            outcome = 'Empate'
        else:
            outcome = None
        bouts.append({'red': a['name'], 'blue': b['name'], 'division': fight.get('weight_class') or 'División no indicada', 'winner': winner, 'outcome': outcome, 'method': method or '', 'round': str(result['round']) if result.get('round') is not None else '', 'time': result.get('time') or ''})
    venue = event.get('venue') or {}
    if not isinstance(venue, dict):
        raise SyncError('Invalid venue')
    return {'id': identity, 'number': number, 'title': title, 'subtitle': f"{bouts[0]['red']} vs {bouts[0]['blue']}" if bouts else 'Cartelera pendiente de anuncio', 'status': status, 'date': date.isoformat(), 'location': ', '.join(str(venue[k]) for k in ('name','city','country') if venue.get(k)) or 'Recinto no indicado', 'type': 'official', 'source': f'https://www.ufc.com/event/{identity}', 'checkedAt': now.date().isoformat(), 'bouts': bouts}

def synchronize(fetch, now):
    rows = list_events(fetch, now.year, now) + list_events(fetch, now.year, now, upcoming=True)
    events = []
    for row in rows:
        event_id = row.get('id')
        if not isinstance(event_id, int) or event_id <= 0:
            raise SyncError('Invalid event id')
        detail = fetch(f'/events/{event_id}', None).get('data')
        if not isinstance(detail, dict) or event_identity(detail) != event_identity(row):
            raise SyncError('Event detail mismatch')
        events.append(normalize_event(detail, now))
    if len({e['id'] for e in events}) != len(events):
        raise SyncError('Duplicate event across lists')
    events.sort(key=lambda e: e['date'], reverse=True)
    return {'schemaVersion': 1, 'year': now.year, 'source': 'UFCalendar', 'sourceUrl': 'https://www.ufcalendar.com', 'synchronizedAt': now.isoformat(), 'events': events}

def atomic_save(path, payload):
    # Reject a partial provider response that would delete an existing current-year event.
    if path.exists():
        previous = json.loads(path.read_text())
        if previous.get('year') == payload['year']:
            previous_ids = {e['id'] for e in previous.get('events', []) if e.get('status', 'completed') == 'completed'}
            if not previous_ids.issubset({e['id'] for e in payload['events']}):
                raise SyncError('API omitted existing events; keeping last good data')
    path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(payload, ensure_ascii=False, indent=2) + '\n'
    temp = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent, delete=False) as file:
            temp = Path(file.name)
            file.write(content)
        temp.replace(path)
    finally:
        if temp and temp.exists():
            temp.unlink()


from html.parser import HTMLParser
from urllib.parse import urlparse

class PosterParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hero_depth = 0
        self.poster = None
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'div':
            if self.hero_depth:
                self.hero_depth += 1
            elif 'c-hero__image' in attrs.get('class', '').split():
                self.hero_depth = 1
        if tag == 'img' and self.hero_depth and not self.poster:
            url = attrs.get('src', '')
            parsed = urlparse(url)
            # A generic background is not an event poster.
            if parsed.scheme == 'https' and parsed.hostname in ('ufc.com', 'www.ufc.com') and any(marker in parsed.path.upper() for marker in ('EVENT-ART', 'TEMP-HERO')):
                self.poster = (url, attrs.get('alt') or 'Imagen promocional oficial de UFC')
    def handle_endtag(self, tag):
        if tag == 'div' and self.hero_depth:
            self.hero_depth -= 1

def public_bytes(url, max_bytes):
    with urlopen(Request(url, headers={'User-Agent': 'Octagon/1.0'}), timeout=15) as response:
        body = response.read(max_bytes + 1)
        if len(body) > max_bytes:
            raise SyncError('Public asset exceeded size limit')
        return body

def enrich_posters(payload, previous, image_dir, read_public=public_bytes):
    old = {e['id']: e for e in previous.get('events', [])}
    for event in payload['events']:
        prior = old.get(event['id'], {})
        event.update(poster=prior.get('poster'), posterSource=prior.get('posterSource'), posterAlt=prior.get('posterAlt'))
        try:
            parser = PosterParser()
            parser.feed(read_public(event['source'], 1500000).decode('utf-8'))
            if not parser.poster:
                continue
            url, alt = parser.poster
            body = read_public(url, 4000000)
            if not (body.startswith(b'\xff\xd8\xff') or body.startswith(b'\x89PNG') or (body.startswith(b'RIFF') and body[8:12] == b'WEBP')):
                raise SyncError('Invalid poster image')
            image_dir.mkdir(parents=True, exist_ok=True)
            target = image_dir/f"{event['id']}.jpg"
            with tempfile.NamedTemporaryFile(dir=image_dir, delete=False) as file:
                file.write(body)
                temporary = Path(file.name)
            temporary.replace(target)
            event.update(poster=f"assets/images/events/{event['id']}.jpg", posterSource=url, posterAlt=alt)
        except (HTTPError, URLError, TimeoutError, OSError, SyncError, UnicodeDecodeError):
            # Optional image failures must not block a valid card update.
            continue

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT/'assets/data/ufc-events.json')
    args = parser.parse_args()
    key = os.environ.get('UFCAL_KEY', '').strip()
    if not key:
        print('UFCAL_KEY is not configured. Current events remain unchanged.', file=sys.stderr)
        return 1
    try:
        payload = synchronize(lambda path, params: request_json(path, key, params), datetime.now(timezone.utc))
        previous = json.loads(args.output.read_text()) if args.output.exists() else {}
        enrich_posters(payload, previous, args.output.parent.parent/'images/events')
        atomic_save(args.output, payload)
    except (SyncError, ValueError, TypeError, KeyError, AttributeError, OSError):
        print('UFC synchronization failed. Check credentials, quota, connectivity and provider schema. Last good file was preserved.', file=sys.stderr)
        return 1
    print(f"Synchronized {len(payload['events'])} events and {sum(len(e['bouts']) for e in payload['events'])} main-card fights.")
    return 0

if __name__ == '__main__':
    sys.exit(main())
