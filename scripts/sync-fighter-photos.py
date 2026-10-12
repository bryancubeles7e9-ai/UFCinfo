"""Refresh title-holder portraits without paid API calls; retain both variants."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
import hashlib
from pathlib import Path
import subprocess
import sys
from urllib.parse import urlparse, urlunparse
from urllib.request import Request, urlopen
import importlib.util

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / 'assets/data/fighter-photos.json'
spec = importlib.util.spec_from_file_location('records', ROOT / 'scripts/sync-ufc-fighter-records.py')
records = importlib.util.module_from_spec(spec)
spec.loader.exec_module(records)
# Visually verified neutral portrait; UFC still publishes a historical belt photo.
NEUTRAL = {'shevchenko': {'url': 'https://a.espncdn.com/i/headshots/mma/players/full/2554705.png',
    'source': 'ESPN', 'sourceUrl': 'https://www.espn.com/mma/fighter/_/id/2554705/valentina-shevchenko'}}

class PhotoParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.photos = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'img' and 'hero-profile__image' in attrs.get('class', '').split():
            self.photos.append(attrs.get('src', ''))

def photo_url(html, fighter):
    records.parse_record(html, fighter)  # Verify the athlete, not a challenge/error page.
    parser = PhotoParser()
    parser.feed(html)
    if len(parser.photos) != 1:
        raise ValueError('Official portrait missing or ambiguous')
    url = urlparse(parser.photos[0])
    if url.scheme != 'https' or url.netloc not in ('ufc.com', 'www.ufc.com') or not url.path.startswith('/images/'):
        raise ValueError('Unexpected portrait host/path')
    # The canonical www host reliably serves the same official image.
    return urlunparse(url._replace(netloc='www.ufc.com'))

def choose_photo(url, fighter, champion, previous=None):
    previous = previous or {}
    original = fighter.get('photoSource', '').replace('https://ufc.com/', 'https://www.ufc.com/')
    held_belt = any(b.get('status') == 'current' and b.get('type') == 'undisputed' for b in fighter.get('championships', []))
    stale_title_photo = any(url == previous.get(k, {}).get('url') for k in ('champion', 'bmf')) or (held_belt and url == original)
    if not champion and ('BELT' in urlparse(url).path.upper() or stale_title_photo):
        return NEUTRAL.get(fighter['id'])  # Never label an explicit belt image as neutral.
    return {'url': url, 'source': 'UFC', 'sourceUrl': fighter['source']}

def fetch(fighter):
    with urlopen(Request(fighter['source'], headers={'User-Agent':'Mozilla/5.0 (compatible; UFCinfo/1.0)'}), timeout=25) as response:
        html = response.read(2_000_001)
    if len(html) > 2_000_000:
        raise ValueError('Profile response too large')
    return photo_url(html.decode('utf-8'), fighter)

def verify_image(url):
    with urlopen(Request(url, headers={'User-Agent':'Mozilla/5.0'}), timeout=25) as response:
        data = response.read(4_000_001)
    return archive_image(data)

def archive_image(data):
    if not 100 < len(data) <= 4_000_000 or not (data.startswith(b'\x89PNG\r\n\x1a\n') or data.startswith(b'\xff\xd8\xff')):
        raise ValueError('Portrait response empty, invalid or too large')
    extension = 'png' if data.startswith(b'\x89PNG') else 'jpg'
    relative = Path('assets/images/fighter-variants') / (hashlib.sha256(data).hexdigest() + '.' + extension)
    destination = ROOT / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not destination.exists():
        destination.write_bytes(data)
    return relative.as_posix()

def directory():
    output = subprocess.check_output(['node', '--input-type=module', '-e', '''
      import {directoryFighters} from './assets/js/fighter-directory.js';
      console.log(JSON.stringify(directoryFighters.map(f => ({id:f.id, name:`${f.first} ${f.last}`,
        aliases:[...(f.aliases || []), ...(f.id==='zhang' ? ['Zhang Weili'] : [])], source:f.source,
        championships:f.championships || [], photoSource:f.photoSource || '', image:f.image, consulted:f.consulted || f.info?.consulted || '2026-10-02'}))));
    '''], cwd=ROOT, text=True)
    return json.loads(output)

def seed_regular_photos(fighters, state):
    for fighter in fighters:
        source = fighter.get('photoSource', '').replace('https://ufc.com/', 'https://www.ufc.com/')
        image = fighter.get('image', '')
        # Archive existing neutral portraits before someone wins their first title.
        if (not source or any(b.get('status') == 'current' for b in fighter.get('championships', []))
            or 'BELT' in source.upper() or 'BMF' in source.upper()
            or not image.startswith('assets/images/fighters/') or not (ROOT / image).is_file()):
            continue
        variants = state['photos'].setdefault(fighter['id'], {})
        if any(source == variants.get(k, {}).get('url') for k in ('champion', 'bmf')):
            continue
        variants.setdefault('regular', {'url':source, 'image':image, 'source':'UFC',
            'sourceUrl':fighter['source'], 'consultedAt':fighter.get('consulted', '2026-10-02')})

def sync(fighters, rankings, state, consult=fetch, now=None, verify=verify_image):
    now = (now or datetime.now(timezone.utc)).isoformat()
    champions = {records.normalize(c['champion']) for c in rankings['categories'] if c.get('champion')}
    seed_regular_photos(fighters, state)
    targets = [f for f in fighters if any(records.normalize(n) in champions for n in [f['name'], *f.get('aliases', [])])
               or bool(f.get('championships')) or any(k in state['photos'].get(f['id'], {}) for k in ('champion', 'bmf'))]
    def update(fighter):
        try:
            champion = any(records.normalize(n) in champions for n in [fighter['name'], *fighter.get('aliases', [])])
            bmf = any(b.get('name') == 'BMF' and b.get('status') == 'current' for b in fighter.get('championships', []))
            mode = 'champion' if champion else 'bmf' if bmf else 'regular'
            selected = choose_photo(consult(fighter), fighter, champion or bmf, state['photos'].get(fighter['id']))
            if selected:
                image = verify(selected['url'])
                if image:
                    selected = {**selected, 'image':image}
            return fighter, mode, selected, None
        except Exception as error:
            return fighter, False, None, str(error)
    failures = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        for fighter, mode, photo, error in pool.map(update, targets):
            if error:
                failures.append(fighter['id'])
                print(f"::warning::Portrait preserved for {fighter['id']}: {error}", file=sys.stderr)
                continue
            variants = state['photos'].setdefault(fighter['id'], {})
            key = mode
            if photo:
                if mode == 'bmf' and variants.get('regular', {}).get('url') == photo['url']:
                    del variants['regular']
                variants[key] = {**photo, 'consultedAt': now}
            variants['checkedAt'] = now
            variants['pendingNeutral'] = mode == 'regular' and photo is None
    state['synchronizedAt'] = now
    state['failedIds'] = failures
    return state

if __name__ == '__main__':
    state = json.loads(STATE.read_text()) if STATE.exists() else {'schemaVersion':1, 'photos':{}}
    rankings = json.loads((ROOT / 'assets/data/ufc-rankings.json').read_text())
    if rankings.get('schemaVersion') != 1 or rankings.get('source') != 'https://www.ufc.com/rankings':
        raise ValueError('Invalid rankings source')
    sync(directory(), rankings, state)
    # Freeze the existing local neutral photos too, before future imports replace them.
    for variants in state['photos'].values():
        for key in ('regular', 'champion', 'bmf'):
            photo = variants.get(key, {})
            image = photo.get('image', '')
            if image.startswith('assets/images/fighters/') and (ROOT / image).is_file():
                photo['image'] = archive_image((ROOT / image).read_bytes())
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n')
    print(f"Portraits checked: {len(state['photos'])}; failures: {len(state['failedIds'])}")
