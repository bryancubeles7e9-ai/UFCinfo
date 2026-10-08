from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

spec = importlib.util.spec_from_file_location('cito_sync', Path(__file__).resolve().parents[1] / 'scripts/sync-cito-events.py')
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)
NOW = datetime(2026, 10, 8, tzinfo=timezone.utc)


def event(slug, when, name):
    return {'slug': slug, 'startsAt': when, 'name': name, 'venue': {'name': 'Arena', 'city': 'Vegas'}}


def bout(section='Main Card', winner=None):
    return {'cardSection': section, 'isMainEvent': True, 'boutOrder': 1, 'weightClass': 'Lightweight',
            'fighters': [{'corner': 'red', 'fighterName': 'Alpha'}, {'corner': 'blue', 'fighterName': 'Beta'}],
            'result': {'winner': winner, 'method': 'Decision', 'round': 5, 'time': '5:00'}}


class CitoSyncTests(unittest.TestCase):
    def test_mixed_archive_and_three_card_budget(self):
        old = {'source': 'UFCalendar', 'events': [{'id': 'ufc-332', 'date': '2026-10-04T00:00:00Z', 'status': 'completed', 'bouts': []}]}
        upcoming = [event('ufc-333-main', '2026-10-25T00:00:00Z', 'UFC 333'),
                    event('ufc-fight-night-test', '2026-11-01T00:00:00Z', 'UFC Fight Night')]
        recent = [event('ufc-332', '2026-10-04T00:00:00Z', 'UFC 332')]
        calls = []
        def fetch(path):
            calls.append(path)
            if path == '/upcoming': return upcoming
            if path == '/recent': return recent
            return [bout('Prelims'), bout(winner='red')]
        feed = sync.synchronize(fetch, old, NOW)
        self.assertEqual(feed['source'], 'Cito')
        self.assertEqual(len(calls), 5)
        self.assertEqual(feed['events'][0]['id'], 'ufc-fight-night-october-31-2026')
        self.assertEqual(feed['events'][-1]['bouts'][0]['winner'], 'Alpha')
        self.assertEqual(feed['events'][-1]['bouts'][0]['division'], 'Lightweight')

    def test_past_archive_remains_with_attribution(self):
        previous = {'source': 'UFCalendar', 'events': [{'id': 'ufc-331', 'status': 'completed', 'date': '2026-09-20T00:00:00Z', 'bouts': [{'red': 'A'}]}]}
        def fetch(path):
            if path == '/upcoming': return [event('cryptocom-ufc-333', '2026-10-25T00:00:00Z', 'Crypto.com UFC 333')]
            if path == '/recent': return []
            return [bout()]
        feed = sync.synchronize(fetch, previous, NOW)
        self.assertEqual(feed['source'], 'Cito + UFCalendar')
        self.assertEqual(feed['events'][-1]['id'], 'ufc-331')
        self.assertEqual(feed['events'][0]['id'], 'ufc-333')

    def test_bad_response_and_no_key_preserve_file(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'events.json'
            output.write_text('{"existing":true}')
            with patch.object(sync.sys, 'argv', ['sync', '--output', str(output)]), patch.dict(sync.os.environ, {'CITO_API_KEY': ''}):
                self.assertEqual(sync.main(), 1)
            self.assertEqual(json.loads(output.read_text()), {'existing': True})
        with self.assertRaises(sync.SyncError):
            sync.rows({'data': []})
        with self.assertRaises(sync.SyncError):
            sync.normalize_bouts([bout('Early Prelims')], True)

    def test_http_error_does_not_leak_key(self):
        error = HTTPError('https://api.citoapi.com/', 429, 'quota', {}, None)
        with patch.object(sync, 'urlopen', side_effect=error):
            with self.assertRaises(sync.SyncError) as context:
                sync.request_json('/recent', 'secret-do-not-log')
        self.assertNotIn('secret-do-not-log', str(context.exception))


if __name__ == '__main__':
    unittest.main()
