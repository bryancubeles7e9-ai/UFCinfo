"""Import missing participants of completed current-year cards from official UFC profiles.

Run from the repository root. Existing profiles are preserved; unverifiable profiles
are reported. Photos use the official URL, with the interface's existing fallback.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
import re
import subprocess
from urllib.request import Request, urlopen
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]

def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / filename)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m

parser = module('rank_parser', 'sync-ufc-rankings.py')
countries = module('country_parser', 'sync-fighter-countries.py')
profiles = module('profile_parser', 'import-fighter-directory.py')
records = module('record_parser', 'sync-ufc-fighter-records.py')


def fetch(url):
    with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=30) as r:
        data = r.read(3_000_001)
    if len(data) > 3_000_000:
        raise ValueError('Response too large')
    return data.decode('utf-8')


def verified_profile(page, athlete, date):
    record = records.parse_record(page, athlete)
    f = profiles.parse_profile(page, athlete, date)
    f['record'] = record
    photo = f.get('photoSource') or ''
    photo = photo.replace('https://ufc.com/', 'https://www.ufc.com/', 1)
    parsed = urlsplit(photo)
    f['image'] = photo if parsed.scheme == 'https' and parsed.hostname in ('www.ufc.com', 'ufc.com', 'dmxg5wxfqgb4u.cloudfront.net') else 'assets/images/fighter-placeholder.svg'
    f['photoCredit'] = 'UFC'
    for key in records.STAT_KEYS:
        value = f['info'].get(key)
        if value is not None and (not isinstance(value, (int, float)) or value < 0 or (key in records.PERCENT_STATS and value > 100)):
            f['info'][key] = None
    f['info']['statisticsSource'] = athlete['source']
    f['info']['statisticsConsulted'] = date
    return f


def main():
    date = datetime.now(timezone.utc).date().isoformat()
    feed = json.loads((ROOT / 'assets/data/ufc-events.json').read_text())
    events = sorted([e for e in feed['events'] if e.get('status') == 'completed' and datetime.fromisoformat(e['date'].replace('Z', '+00:00')).year == feed['year']], key=lambda e:e['date'], reverse=True)
    existing_names = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', "import {directoryFighters} from './assets/js/fighter-directory.js'; console.log(JSON.stringify(directoryFighters.flatMap(f=>[`${f.first} ${f.last}`,...(f.aliases||[])])));"], cwd=ROOT, text=True))
    known = {records.normalize(n) for n in existing_names}
    missing = {records.normalize(n):n for e in events for b in e['bouts'] for n in (b['red'],b['blue']) if records.normalize(n) not in known}
    found = {}
    def card(e):
        try:return e, fetch(e['source'])
        except Exception as ex:return e, ex
    with ThreadPoolExecutor(max_workers=8) as pool:
        for e, page in pool.map(card, events):
            if isinstance(page, Exception):
                print('Card failed:', e['id'], type(page).__name__, flush=True)
                continue
            tree=parser.Parser();tree.feed(page)
            flags=countries.parse_countries(page)
            for n in tree.root.find(lambda n:n.tag=='a' and '/athlete/' in n.attrs.get('href','')):
                key=records.normalize(n.text())
                if key not in missing:continue
                slug=n.attrs['href'].split('/athlete/')[-1].split('?')[0].strip('/')
                if not re.fullmatch('[a-z0-9-]+',slug):continue
                f=found.setdefault(slug,dict(id='ufc-'+slug,name=n.text(),aliases=[],source='https://www.ufc.com/athlete/'+slug))
                if missing[key] not in f['aliases']:f['aliases'].append(missing[key])
                if slug in flags and not f.get('code'):f.update(flags[slug],countrySource=e['source'],countryConsulted=date)
    print('Missing names:',len(missing),'official profiles:',len(found),flush=True)
    data_path=ROOT/'assets/js/fighter-directory-data.js'
    prefix, raw=data_path.read_text().split('export const additionalFighters = ',1)
    data=json.loads(raw.strip().removesuffix(';'))
    manifest_path=ROOT/'docs/fighter-directory-sources.json'
    manifest=json.loads(manifest_path.read_text())
    ids={f['id'] for f in data}
    def profile(f):
        try:
            page=fetch(f['source'])
            try: result=verified_profile(page,f,date)
            except ValueError:
                # UFC can redirect an old cached URL to search; request its English page explicitly.
                result=verified_profile(fetch(f['source']+'?language_content_entity=en'),f,date)
            return f,result
        except Exception as ex:return f,ex
    added=0; failures=[]
    with ThreadPoolExecutor(max_workers=8) as pool:
        for i,(f,result) in enumerate(pool.map(profile,found.values())):
            if isinstance(result,Exception):failures.append({'name':f['name'],'source':f['source'],'error':str(result)})
            elif records.normalize(result['name']) not in known and f['id'] not in ids:
                data.append(result);manifest.append(f);ids.add(f['id']);known.add(records.normalize(result['name']));added+=1
            if (i+1)%25==0:print('Reviewed',i+1,'added',added,flush=True)
    data_path.write_text(prefix+'export const additionalFighters = '+json.dumps(data,ensure_ascii=False,indent=2)+';\n')
    manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'added':added,'failures':failures},ensure_ascii=False,indent=2),flush=True)

if __name__=='__main__':main()
