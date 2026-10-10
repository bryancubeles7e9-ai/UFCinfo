"""Import represented countries from official fight-card flags, never birthplace."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('rankings', ROOT / 'scripts/sync-ufc-rankings.py')
parser_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parser_module)


def parse_countries(page):
    parser = parser_module.Parser()
    parser.feed(page)
    result = {}
    for fight in parser.root.find(lambda n: n.has('c-listing-fight')):
        for side in ('red', 'blue'):
            names = fight.find(lambda n: n.has('c-listing-fight__corner-name--' + side))
            countries = fight.find(lambda n: n.has('c-listing-fight__country--' + side))
            if len(names) != 1 or len(countries) != 1:
                continue
            links = names[0].find(lambda n: n.tag == 'a' and '/athlete/' in n.attrs.get('href', ''))
            flags = countries[0].find(lambda n: n.tag == 'img')
            labels = countries[0].find(lambda n: n.has('c-listing-fight__country-text'))
            if len(links) != 1 or len(flags) != 1 or len(labels) != 1:
                continue
            match = re.search(r'/flags/([A-Z]{2,3})\.png$', flags[0].attrs.get('src', ''), re.I)
            if match and labels[0].text():
                slug = links[0].attrs['href'].split('/athlete/')[-1].split('?')[0].strip('/')
                result[slug] = {'code': match[1].upper(), 'country': labels[0].text()}
    return result


def fetch(url):
    try:
        with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=30) as response:
            return url, response.read(3_000_000).decode('utf-8')
    except Exception as error:
        print('Unavailable:', url, type(error).__name__, flush=True)
        return url, ''


def main():
    manifest_path = ROOT / 'docs/fighter-directory-sources.json'
    data_path = ROOT / 'assets/js/fighter-directory-data.js'
    manifest = json.loads(manifest_path.read_text())
    prefix, raw = data_path.read_text().split('export const additionalFighters = ', 1)
    profiles = json.loads(raw.strip().removesuffix(';'))
    evidence_path = ROOT / 'docs/fighter-country-sources.json'
    evidence = json.loads(evidence_path.read_text()) if evidence_path.exists() else {}
    now = datetime.now(timezone.utc).isoformat()
    events = json.loads((ROOT / 'assets/data/ufc-events.json').read_text())['events']
    urls = list(dict.fromkeys(e['source'] for e in sorted(events, key=lambda e: e['date'], reverse=True)
                             if e.get('source', '').startswith('https://www.ufc.com/event/')))
    seen = set()
    def collect(urls):
        with ThreadPoolExecutor(max_workers=5) as pool:
            for url, page in pool.map(fetch, urls):
                for slug, country in parse_countries(page).items():
                    if slug not in seen:
                        evidence[slug] = {**country, 'countrySource': url, 'countryConsulted': now}
                        seen.add(slug)
        evidence_path.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n')
        print('Verified countries:', len(evidence), flush=True)
    collect(urls)
    missing = [f for f in profiles if f['source'].rsplit('/', 1)[-1] not in evidence]
    extra = []
    with ThreadPoolExecutor(max_workers=5) as pool:
        for url, page in pool.map(fetch, [f['source'] for f in missing]):
            links = re.findall(r'https://www\.ufc\.com/event/[a-z0-9-]+', page)
            extra.extend(list(dict.fromkeys(links))[:2])
    collect([u for u in dict.fromkeys(extra) if u not in urls])
    for items in (manifest, profiles):
        for fighter in items:
            country = evidence.get(fighter['source'].rsplit('/', 1)[-1])
            if country:
                fighter.update(country)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    data_path.write_text(prefix + 'export const additionalFighters = ' + json.dumps(profiles, ensure_ascii=False, indent=2) + ';\n')
    print('Missing:', [f['name'] for f in profiles if not f.get('code')], flush=True)


if __name__ == '__main__':
    main()
