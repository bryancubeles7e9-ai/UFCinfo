#!/usr/bin/env python3
"""Fill empty fields of catalogue profiles from their official UFC pages, never overwriting data.

- Height, reach and statistics come from the fighter's own UFC.com profile.
- The represented country comes only from the flag shown next to the fighter on an official
  UFC fight card linked from that profile (never from the place of birth).
Run from the repository root: python3 scripts/fill-profile-gaps.py [--dry-run]
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import importlib.util
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / filename)
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded


season = module('season', 'import-season-fighters.py')
countries = module('countries', 'sync-fighter-countries.py')
STATS = season.records.STAT_KEYS
DATA = ROOT / 'assets/js/fighter-directory-data.js'
MANIFEST = ROOT / 'docs/fighter-directory-sources.json'
EVIDENCE = ROOT / 'docs/fighter-country-sources.json'


def gaps(f):
    info = f.get('info') or {}
    return {'height': f.get('heightCm') is None, 'reach': f.get('reachCm') is None,
            'stats': all(info.get(k) is None for k in STATS), 'country': not f.get('code'),
            'record': f.get('record') in (None, '', 'No indicado')}


def fetch(url):
    try:
        return season.fetch(url)
    except Exception:
        return ''


def main():
    today = datetime.now(timezone.utc).date().isoformat()
    text = DATA.read_text()
    prefix, raw = text.split('export const additionalFighters = ', 1)
    profiles = json.loads(raw.strip().removesuffix(';'))
    manifest = json.loads(MANIFEST.read_text())
    evidence = json.loads(EVIDENCE.read_text()) if EVIDENCE.exists() else {}
    todo = [f for f in profiles if any(gaps(f).values())]
    print(f'Perfiles con huecos: {len(todo)}', flush=True)
    pages = {}
    with ThreadPoolExecutor(max_workers=6) as pool:
        for f, page in zip(todo, pool.map(lambda f: fetch(f['source']), todo)):
            pages[f['id']] = page
    filled = {'height': [], 'reach': [], 'stats': [], 'country': []}
    for f in todo:
        page, need = pages[f['id']], gaps(f)
        if not page:
            continue
        try:
            fresh = season.verified_profile(page, {k: f[k] for k in ('id', 'name', 'source') if k in f}, today)
        except Exception:
            continue
        for key, field in (('height', 'heightCm'), ('reach', 'reachCm')):
            if need[key] and fresh.get(field):
                f[field] = fresh[field]; filled[key].append(f['name'])
        if need['stats'] and any(fresh['info'].get(k) is not None for k in STATS):
            for k in STATS:
                if f.setdefault('info', {}).get(k) is None and fresh['info'].get(k) is not None:
                    f['info'][k] = fresh['info'][k]
            f['info']['statisticsSource'] = f['source']; f['info']['statisticsConsulted'] = today
            filled['stats'].append(f['name'])
    # Countries: flags on official fight cards linked from each profile.
    slug = lambda f: f['source'].rstrip('/').rsplit('/', 1)[-1]
    for f in todo:
        if not gaps(f)['country'] or slug(f) in evidence:
            continue
        events = list(dict.fromkeys(re.findall(r'https://www\.ufc\.com/event/[a-z0-9-]+', pages.get(f['id'], ''))))[:20]
        for url in events:
            found = countries.parse_countries(fetch(url)).get(slug(f))
            if found:
                evidence[slug(f)] = {**found, 'countrySource': url, 'countryConsulted': today}
                break
    for f in profiles:
        if not f.get('code') and slug(f) in evidence:
            f.update(evidence[slug(f)]); filled['country'].append(f['name'])
    for entry in manifest:
        if not entry.get('code') and slug(entry) in evidence:
            entry.update(evidence[slug(entry)])
    remaining = [f['name'] + ' (' + ', '.join(k for k, v in gaps(f).items() if v) + ')' for f in profiles if any(gaps(f).values())]
    print(json.dumps({k: len(v) for k, v in filled.items()}), flush=True)
    for key, names in filled.items():
        if names:
            print(f'{key}: {", ".join(names)}')
    print(f'Siguen con huecos ({len(remaining)}): {"; ".join(remaining)}')
    if '--dry-run' not in sys.argv:
        DATA.write_text(prefix + 'export const additionalFighters = ' + json.dumps(profiles, ensure_ascii=False, indent=2) + ';\n')
        MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
        EVIDENCE.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    main()
