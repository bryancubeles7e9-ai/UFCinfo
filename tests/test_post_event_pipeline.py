"""Offline source-to-public-files rehearsal. Never call UFC, Cito or Render."""
from datetime import datetime, timedelta, timezone
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / file)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


cito = module('pipeline_cito', 'sync-cito-events.py')
official = module('pipeline_official', 'reconcile-official-results.py')
records = module('pipeline_records', 'sync-ufc-fighter-records.py')
profiles = module('pipeline_profiles', 'import-season-fighters.py')
retry = module('pipeline_retry', 'retry-morning-data.py')
monitor = module('pipeline_monitor', 'run-data-sync.py')
START = datetime(2026, 10, 18, tzinfo=timezone.utc)


def profile_page(name, record, complete=True):
    page = f'<h1 class="hero-profile__name">{name}</h1><p class="hero-profile__division-body">{record} (W-L-D)</p>'
    if complete:
        for label, value in [('Sig. Str. Landed', 3), ('Sig. Str. Absorbed', 2), ('Takedown avg', 0), ('Submission avg', 0.5)]:
            page += f'<div class="c-stat-compare__number">{value}<div class="c-stat-compare__label">{label}</div></div>'
    return page


def card_page(complete=False):
    result = '<span class="c-listing-fight__outcome--win">Win</span>' if complete else ''
    details = '<span class="method">Decision</span><span class="round">3</span><span class="time">5:00</span>' if complete else ''
    return f'''<div id="main-card"><span class="c-event-fight-card-broadcaster__time" data-timestamp="{int(START.timestamp())}"></span>
      <div class="c-listing-fight"><div class="c-listing-fight__corner--red"><span class="c-listing-fight__corner-name--red">A Fighter</span>{result}</div>
      <div class="c-listing-fight__corner--blue"><span class="c-listing-fight__corner-name--blue">New Fighter</span></div>{details}</div>
      <a href="/athlete/a-fighter">A Fighter</a><a href="/athlete/new-fighter">New Fighter</a></div>'''


class PostEventPipelineTests(unittest.TestCase):
    def test_announcement_import_outage_late_results_partial_records_and_recovery(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            data = root / 'assets/data'; data.mkdir(parents=True)
            js = root / 'assets/js'; js.mkdir()
            (root / 'docs').mkdir()
            (root / 'package.json').write_text('{"type":"module"}')
            a = dict(id='a', name='A Fighter', first='A', last='Fighter', record='8-1-0', source='https://www.ufc.com/athlete/a-fighter')
            (js / 'fighter-directory-data.js').write_text('export const additionalFighters = [];\n')
            (js / 'fighter-directory.js').write_text("import {additionalFighters} from './fighter-directory-data.js'; export const directoryFighters = [" + json.dumps(a) + ', ...additionalFighters];')
            (root / 'docs/fighter-directory-sources.json').write_text('[]')
            event_row = dict(slug='ufc-333', name='UFC 333', startsAt=START.isoformat())
            bout = dict(cardSection='Main Card', fighters=[dict(corner='red', fighterName='A Fighter'), dict(corner='blue', fighterName='New Fighter')])
            calls = []
            def source(path):
                calls.append(path)
                return [event_row] if path == '/upcoming' else [] if path == '/recent' else [bout]
            feed = cito.synchronize(source, {'schemaVersion': 1, 'events': []}, START - timedelta(days=1))
            events_path = data / 'ufc-events.json'
            events_path.write_text(json.dumps(feed))
            self.assertEqual(len(calls), 3)
            self.assertEqual(feed['events'][0]['status'], 'scheduled')

            class BeforeEvent(datetime):
                @classmethod
                def now(cls, tz=None): return START - timedelta(days=1)
            def page(url):
                return card_page() if '/event/' in url else profile_page('New Fighter', '3-0-0')
            with patch.object(profiles, 'ROOT', root), patch.object(profiles, 'datetime', BeforeEvent), patch.object(profiles, 'fetch', page), patch.object(profiles.sys, 'argv', ['import', '--upcoming']):
                profiles.main()
                profiles.main()  # Repeating the import must not duplicate anyone.
            imported = json.loads((js / 'fighter-directory-data.js').read_text().split('export const additionalFighters = ', 1)[1].strip().removesuffix(';'))
            self.assertEqual(len(imported), 1)
            fighters = [a, imported[0]]
            old_info = {'strikesLanded': 4, 'strikesAbsorbed': 2, 'takedownAverage': 1, 'submissionAverage': 0.5,
                        'statisticsSource': a['source'], 'statisticsConsulted': '2026-10-17'}
            state = {'schemaVersion': 1, 'source': 'UFC', 'processedEventIds': [], 'completedFighters': {},
                     'records': {f['id']: {'record': f['record'], 'updatedAt': '2026-10-17T00:00:00Z',
                                         'info': {**old_info, 'statisticsSource': f['source']}} for f in fighters}}
            records_path = data / 'fighter-records.json'
            records_path.write_text(json.dumps(state))
            at8 = START + timedelta(hours=6)  # 08:00 Madrid before the DST change.
            saved_events = events_path.read_bytes()
            code = monitor.run('events', root=root, execute=lambda *a, **k: SimpleNamespace(returncode=1), clock=lambda: at8)
            self.assertEqual(code, 1)
            self.assertEqual(events_path.read_bytes(), saved_events)
            self.assertEqual(json.loads((data / 'sync-health.json').read_text())['jobs']['events']['status'], 'failed')
            official.reconcile(feed, lambda _: card_page(), at8)
            self.assertEqual(feed['resultsVerification']['failedIds'], ['ufc-333'])
            self.assertEqual(feed['events'][0]['status'], 'scheduled')
            # Started events stay visible while official results are incomplete.
            script = "import {visibleOfficialEvents} from './assets/js/event-visibility.js'; import fs from 'node:fs'; const v=JSON.parse(fs.readFileSync(0,'utf8')); if(visibleOfficialEvents(v.events,v.now).length!==1) process.exit(1);"
            subprocess.run(['node', '--input-type=module', '-e', script], cwd=ROOT,
                           input=json.dumps({'events': feed['events'], 'now': at8.timestamp()*1000}), text=True, check=True)

            at10 = at8 + timedelta(hours=2)
            self.assertTrue(retry.due(at10, {}))
            cards, _, _ = retry.plan(feed['events'], state, fighters, at10, feed['resultsVerification']['failedIds'])
            self.assertEqual(len(cards), 1)
            official.reconcile(feed, lambda _: card_page(True), at10)
            self.assertEqual(feed['events'][0]['bouts'][0]['winner'], 'A Fighter')
            self.assertEqual(feed['resultsVerification']['failedIds'], [])
            def partial(f):
                if f['id'] == 'a': return records.parse_profile(profile_page(f['name'], '1-0-0'), f)
                # Same record-only response used when UFC has not populated core stats.
                return {'record': records.parse_record(profile_page(f['name'], '3-1-0', False), f), 'info': None}
            with patch.object(records, 'STATE', records_path):
                records.sync(feed['events'], state, fighters, fetch=partial, now=at10)
            self.assertEqual(state['records']['a']['record'], '8-1-0')
            self.assertEqual(state['records'][fighters[1]['id']]['record'], '3-1-0')
            self.assertEqual(state['records'][fighters[1]['id']]['info']['statisticsConsulted'], '2026-10-17')
            self.assertEqual(set(state['pendingProfileIds']), {f['id'] for f in fighters})
            self.assertIn('a', state['profileReview'])

            at14 = at8 + timedelta(hours=6)
            _, ids, _ = retry.plan(feed['events'], state, fighters, at14)
            self.assertEqual(ids, {f['id'] for f in fighters})
            with patch.object(records, 'STATE', records_path):
                records.sync(feed['events'], state, fighters, fetch=lambda f: records.parse_profile(profile_page(f['name'], '9-1-0' if f['id']=='a' else '3-1-0'), f), now=at14)
            self.assertEqual(state['pendingProfileIds'], [])
            self.assertEqual(state['profileReview'], {})
            self.assertEqual(state['records']['a']['record'], '9-1-0')
            self.assertIn('ufc-333', state['processedEventIds'])
            self.assertEqual(retry.plan(feed['events'], state, fighters, at14), ([], set(), False))
            self.assertEqual(len(calls), 3)  # Official retries never consumed more Cito calls.


if __name__ == '__main__': unittest.main()
