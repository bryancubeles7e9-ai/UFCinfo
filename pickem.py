"""Server-authoritative Pick'em. Uses the published event feed, never provider APIs."""
import json
import re
import time
import unicodedata
from datetime import datetime, timezone


class PickemError(Exception):
    def __init__(self, status, message):
        self.status, self.body = status, {"error": message}


def timestamp(value):
    try:
        return datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp()
    except (ValueError, TypeError, AttributeError):
        return 0


def key(bout):
    return json.dumps(sorted([bout['red'], bout['blue']]), ensure_ascii=False, separators=(',', ':'))


def closing_time(event):
    main = timestamp(event.get('date'))
    schedule = event.get('sectionSchedule') or {}
    starts = schedule.get('starts') or {}
    sections = {b.get('section') for b in event['bouts']}
    valid = [timestamp(t) for t in starts.values() if main - 43200 <= timestamp(t) <= main]
    complete = (sections and schedule.get('eventDate') == event.get('date') and
                schedule.get('source') == event.get('source') and
                all(s in {'main', 'prelims', 'early-prelims'} and timestamp(starts.get(s)) in valid for s in sections))
    return min(valid) if complete else main - 14400


METHODS = {'general', 'ko', 'submission', 'decision'}


def selection(value, bout):
    # Existing saved names remain valid general-winner predictions.
    if isinstance(value, str):
        value = {'winner': value, 'method': 'general'}
    if (not isinstance(value, dict) or set(value) != {'winner', 'method'}
            or not isinstance(value.get('winner'), str)
            or not isinstance(value.get('method'), str)
            or value['winner'] not in (bout['red'], bout['blue'])
            or value['method'] not in METHODS):
        return None
    return value


def result_method(value):
    text = unicodedata.normalize('NFKD', str(value or '')).encode('ascii', 'ignore').decode().lower()
    if re.search(r'\b(ko|tko|knockout)\b', text):
        return 'ko'
    if re.search(r'\b(sub|submission|sumision)\b', text):
        return 'submission'
    if re.search(r'\b(dec|ud|sd|md|decision)\b', text):
        return 'decision'
    if re.search(r'\b(dq|disqualification|descalificacion)\b', text):
        return 'other'
    return None


def void(bout):
    text = str(bout.get('outcome') or bout.get('method') or '').strip().lower().replace('-', ' ')
    return bool(bout.get('_void')) or text in {'empate', 'nc', 'n/c', 'cancelled', 'canceled'} or any(word in text for word in ('draw', 'empate', 'no contest'))


def pick_result(bout, picks):
    if void(bout):
        return 'void', 0
    if bout.get('winner') not in (bout['red'], bout['blue']):
        return 'pending', 0
    chosen = selection(picks.get(key(bout)), bout)
    if not chosen:
        return 'unpicked', 0
    if chosen['winner'] != bout['winner']:
        return 'wrong', 0
    if chosen['method'] == 'general':
        return 'correct', 100
    method = result_method(bout.get('method'))
    if method is None:
        return 'pending', 0
    return ('correct', 350) if method == chosen['method'] else ('wrong', 0)


def score(event, picks):
    results = [pick_result(b, picks) for b in event['bouts'] if not void(b)]
    correct = sum(status == 'correct' for status, _ in results)
    resolved = sum(status != 'pending' for status, _ in results)
    final = event.get('status') == 'completed' and resolved == len(results)
    return {'correct': correct, 'total': len(results), 'resolved': resolved,
            'score': sum(points for _, points in results),
            'final': final, 'void': not results}


def public_name(username, previous_alias, user_id):
    # Legacy email logins must not become public leaderboard names.
    if re.fullmatch(r'[A-Za-z0-9_-]{3,24}', username or ''):
        return username
    if re.fullmatch(r'[A-Za-z0-9_-]{3,24}', previous_alias or ''):
        return previous_alias
    return 'Usuario-' + user_id[:8]


class Competition:
    def __init__(self, database, feed_path):
        self.database, self.feed_path = database, feed_path
        with database.connect() as db:
            db.executescript('''
              CREATE TABLE IF NOT EXISTS pickem_profiles (
                user_id TEXT PRIMARY KEY REFERENCES users(id),
                alias TEXT NOT NULL COLLATE NOCASE UNIQUE);
              CREATE TABLE IF NOT EXISTS pickem_events (
                id TEXT PRIMARY KEY, snapshot TEXT NOT NULL, closes_at REAL NOT NULL,
                locked INTEGER NOT NULL DEFAULT 0);
              CREATE TABLE IF NOT EXISTS pickem_entries (
                user_id TEXT NOT NULL REFERENCES users(id), event_id TEXT NOT NULL REFERENCES pickem_events(id),
                picks TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, updated_at REAL NOT NULL,
                PRIMARY KEY(user_id,event_id));
            ''')

    def sync(self, db, now):
        # Keep an archive in the persistent database when the annual feed rolls over.
        feed = json.loads(self.feed_path.read_text())
        if feed.get('schemaVersion') != 1 or not isinstance(feed.get('events'), list):
            raise PickemError(503, 'Cartelera no disponible. No se han guardado cambios.')
        for incoming in feed['events']:
            if incoming.get('type') != 'official' or not isinstance(incoming.get('bouts'), list):
                continue
            event = dict(incoming)
            row = db.execute('SELECT * FROM pickem_events WHERE id=?', (event['id'],)).fetchone()
            if not row:
                if event.get('status') not in {'announced', 'scheduled', 'live'} or timestamp(event.get('date')) + 43200 < now:
                    continue
                close = closing_time(event)
                if not close:
                    continue
                locked = now >= close or event.get('status') == 'live'
            else:
                old = json.loads(row['snapshot'])
                locked = bool(row['locked']) or now >= row['closes_at'] or event.get('status') in {'live', 'completed', 'cancelled', 'postponed'}
                close = row['closes_at'] if locked else closing_time(event)
                locked = locked or now >= close
                if locked:
                    current = {key(b): b for b in event['bouts']}
                    # Freeze eligible matchups; replacements after closing cannot score.
                    bouts = []
                    for previous in old['bouts']:
                        fresh = current.get(key(previous))
                        if fresh is not None:
                            bouts.append(fresh)
                        else:
                            bouts.append({**previous, '_void': True})
                    event['bouts'] = bouts
                if event.get('status') in {'cancelled', 'postponed'}:
                    event['bouts'] = [{**b, '_void': True} for b in event['bouts']]
            db.execute('INSERT INTO pickem_events VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET snapshot=excluded.snapshot, closes_at=excluded.closes_at, locked=excluded.locked',
                       (event['id'], json.dumps(event), close, int(locked)))

    def next_event_id(self, db, now):
        candidates = [json.loads(row['snapshot']) for row in db.execute('SELECT snapshot FROM pickem_events')]
        candidates = [e for e in candidates if e.get('status') in {'announced', 'scheduled', 'live'}
                      and timestamp(e.get('date')) + 43200 > now]
        return min(candidates, key=lambda e: (timestamp(e['date']), e['id']))['id'] if candidates else None

    def state(self, user_id=None):
        now = time.time()
        with self.database.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            self.sync(db, now)
            profile = db.execute('SELECT u.username, p.alias FROM users u LEFT JOIN pickem_profiles p ON p.user_id=u.id WHERE u.id=?', (user_id,)).fetchone()
            next_id = self.next_event_id(db, now)
            own = {r['event_id']: r for r in db.execute('SELECT * FROM pickem_entries WHERE user_id=?', (user_id,))}
            items = []
            for row in db.execute('SELECT * FROM pickem_events'):
                event = json.loads(row['snapshot'])
                entry = own.get(row['id'])
                if row['id'] != next_id and not entry:
                    continue
                picks = json.loads(entry['picks']) if entry else {}
                items.append({'event': event, 'closesAt': row['closes_at'] * 1000,
                              'closed': row['id'] != next_id or bool(row['locked']) or now >= row['closes_at'],
                              'joined': bool(entry), 'revision': entry['revision'] if entry else 0,
                              'picks': picks, 'result': score(event, picks) if entry else None})
            items.sort(key=lambda r: timestamp(r['event']['date']), reverse=True)
            return {'serverTime': now * 1000, 'nextEventId': next_id, 'alias': public_name(profile['username'], profile['alias'], user_id) if profile else None,
                    'authenticated': user_id is not None, 'events': items}

    def save(self, user_id, data):
        now = time.time()
        if not isinstance(data.get('eventId'), str) or type(data.get('revision')) is not int:
            raise PickemError(400, 'Pronósticos no válidos.')
        with self.database.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            self.sync(db, now)
            if data['eventId'] != self.next_event_id(db, now):
                raise PickemError(409, 'Solo puedes hacer pronósticos para el próximo evento.')
            row = db.execute('SELECT * FROM pickem_events WHERE id=?', (data['eventId'],)).fetchone()
            if not row or row['locked'] or now >= row['closes_at']:
                raise PickemError(409, 'Los pronósticos de esta velada están cerrados.')
            event = json.loads(row['snapshot'])
            if event.get('status') not in {'announced', 'scheduled'}:
                raise PickemError(409, 'Esta velada no admite pronósticos.')
            picks = data.get('picks')
            allowed = {key(b): b for b in event['bouts']}
            if not isinstance(picks, dict) or not picks or len(picks) > 30 or any(k not in allowed or selection(v, allowed[k]) is None for k,v in picks.items()):
                raise PickemError(400, 'La cartelera ha cambiado o hay una elección no válida. Actualiza los pronósticos.')
            old = db.execute('SELECT revision FROM pickem_entries WHERE user_id=? AND event_id=?', (user_id, event['id'])).fetchone()
            if data['revision'] != (old['revision'] if old else 0):
                raise PickemError(409, 'Hay pronósticos más recientes en otro dispositivo. Actualiza antes de guardar.')
            # Identity comes from the authenticated account, never from request data.
            db.execute('INSERT INTO pickem_entries VALUES (?,?,?,?,?) ON CONFLICT(user_id,event_id) DO UPDATE SET picks=excluded.picks, revision=excluded.revision, updated_at=excluded.updated_at',
                       (user_id, event['id'], json.dumps(picks), data['revision'] + 1, now))
        return self.state(user_id)

    def leaderboard(self, scope='all', page=1, user_id=None):
        now = time.time()
        with self.database.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            self.sync(db, now)
            events = {r['id']: json.loads(r['snapshot']) for r in db.execute('SELECT * FROM pickem_events')}
            rows = {}
            year = datetime.now(timezone.utc).year
            for entry in db.execute('SELECT e.*, u.username, p.alias FROM pickem_entries e JOIN users u ON u.id=e.user_id LEFT JOIN pickem_profiles p ON p.user_id=e.user_id'):
                event = events[entry['event_id']]
                if scope == 'year' and datetime.fromtimestamp(timestamp(event['date']), timezone.utc).year != year:
                    continue
                if scope not in {'all', 'year'} and entry['event_id'] != scope:
                    continue
                r = rows.setdefault(entry['user_id'], {'alias': public_name(entry['username'], entry['alias'], entry['user_id']), 'correct': 0, 'total': 0, 'played': 0, 'pending': 0, 'score': 0, 'isYou': entry['user_id'] == user_id})
                result = score(event, json.loads(entry['picks']))
                # Only final results count in the public totals; pending cards remain provisional.
                if result['final'] and not result['void']:
                    r['correct'] += result['correct']; r['total'] += result['total']; r['played'] += 1; r['score'] += result['score']
                elif not result['void']:
                    r['pending'] += 1
            values = []
            for r in rows.values():
                r['score'] = r['score'] if r['played'] else None
                values.append(r)
            values.sort(key=lambda r: (r['score'] is None, -(r['score'] or 0), r['alias'].lower()))
            last_score, position = object(), 0
            for i,r in enumerate(values):
                if r['score'] != last_score: position = i + 1
                r['position'] = position if r['score'] is not None else None
                last_score = r['score']
            me_index = next((i for i, r in enumerate(values) if r['isYou']), None)
            return {'scope': scope, 'page': page, 'total': len(values), 'pageSize': 50,
                    'me': values[me_index] if me_index is not None else None,
                    'myPage': me_index // 50 + 1 if me_index is not None else None,
                    'rows': values[(page-1)*50:page*50], 'year': year}
