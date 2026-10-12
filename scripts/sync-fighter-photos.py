"""Refresh title-holder portraits without paid API calls; retain both variants."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
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
    stale_title_photo = url == previous.get('champion', {}).get('url') or (held_belt and url == original)
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
    if not 100 < len(data) <= 4_000_000 or not (data.startswith(b'\x89PNG\r\n\x1a\n') or data.startswith(b'\xff\xd8\xff')):
        raise ValueError('Portrait response empty, invalid or too large')

def directory():
    output = subprocess.check_output(['node', '--input-type=module', '-e', '''
      import {directoryFighters} from './assets/js/fighter-directory.js';
      console.log(JSON.stringify(directoryFighters.map(f => ({id:f.id, name:`${f.first} ${f.last}`,
        aliases:[...(f.aliases || []), ...(f.id==='zhang' ? ['Zhang Weili'] : [])], source:f.source,
        championships:f.championships || [], photoSource:f.photoSource || ''}))));
    '''], cwd=ROOT, text=True)
    return json.loads(output)

def sync(fighters, rankings, state, consult=fetch, now=None, verify=verify_image):
    now = (now or datetime.now(timezone.utc)).isoformat()
    champions = {records.normalize(c['champion']) for c in rankings['categories'] if c.get('champion')}
    targets = [f for f in fighters if any(records.normalize(n) in champions for n in [f['name'], *f.get('aliases', [])])
               or any(b.get('type') == 'undisputed' for b in f.get('championships', [])) or f['id'] in state['photos']]
    def update(fighter):
        try:
            champion = any(records.normalize(n) in champions for n in [fighter['name'], *fighter.get('aliases', [])])
            selected = choose_photo(consult(fighter), fighter, champion, state['photos'].get(fighter['id']))
            if selected:
                verify(selected['url'])
            return fighter, champion, selected, None
        except Exception as error:
            return fighter, False, None, str(error)
    failures = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        for fighter, champion, photo, error in pool.map(update, targets):
            if error:
                failures.append(fighter['id'])
                print(f"::warning::Portrait preserved for {fighter['id']}: {error}", file=sys.stderr)
                continue
            variants = state['photos'].setdefault(fighter['id'], {})
            key = 'champion' if champion else 'regular'
            if photo:
                variants[key] = {**photo, 'consultedAt': now}
            variants['checkedAt'] = now
            variants['pendingNeutral'] = not champion and photo is None
    state['synchronizedAt'] = now
    state['failedIds'] = failures
    return state

if __name__ == '__main__':
    state = json.loads(STATE.read_text()) if STATE.exists() else {'schemaVersion':1, 'photos':{}}
    rankings = json.loads((ROOT / 'assets/data/ufc-rankings.json').read_text())
    if rankings.get('schemaVersion') != 1 or rankings.get('source') != 'https://www.ufc.com/rankings':
        raise ValueError('Invalid rankings source')
    sync(directory(), rankings, state)
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n')
    print(f"Portraits checked: {len(state['photos'])}; failures: {len(state['failedIds'])}")
