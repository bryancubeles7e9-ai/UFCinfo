from datetime import datetime, timezone, timedelta
from copy import deepcopy
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
            fights = [bout('Prelims'), bout(winner='red'), bout('Early Prelims')]
            for i, fight in enumerate(fights):
                if i != 1:
                    for fighter in fight['fighters']:
                        fighter['fighterName'] += str(i)
            return fights
        feed = sync.synchronize(fetch, old, NOW)
        self.assertEqual(feed['source'], 'Cito')
        self.assertEqual(len(calls), 5)
        self.assertEqual([b['section'] for b in feed['events'][0]['bouts']], ['main', 'prelims', 'early-prelims'])
        self.assertEqual(feed['events'][0]['id'], 'ufc-fight-night-october-31-2026')
        self.assertEqual(feed['events'][-1]['bouts'][0]['winner'], 'Alpha')
        self.assertEqual(feed['events'][-1]['bouts'][0]['division'], 'Lightweight')

    def test_discovers_next_year_without_extra_bout_queries(self):
        upcoming = [event(f'ufc-{n}', date, f'UFC {n}') for n, date in (
            (333, '2026-10-25T00:00:00Z'), (334, '2026-11-15T02:00:00Z'),
            (335, '2026-12-13T02:00:00Z'), (336, '2027-01-31T02:00:00Z'))]
        calls = []
        def fetch(path):
            calls.append(path)
            if path == '/upcoming': return upcoming
            if path == '/recent': return []
            return [bout()]
        feed = sync.synchronize(fetch, {'events': []}, NOW)
        january = next(e for e in feed['events'] if e['id'] == 'ufc-336')
        self.assertEqual(january['status'], 'announced')
        self.assertEqual(january['bouts'], [])
        self.assertEqual(len(calls), 5)
        self.assertNotIn('/ufc-336/bouts', calls)
        january['bouts'] = [{'red': 'Van', 'blue': 'Kape'}]
        calls.clear()
        again = sync.synchronize(fetch, feed, NOW)
        self.assertEqual(next(e for e in again['events'] if e['id'] == 'ufc-336')['bouts'], january['bouts'])
        self.assertEqual(len(calls), 5)

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

    def test_truncated_provider_cannot_remove_saved_result(self):
        saved = {'red': 'Nallo', 'blue': 'Landwehr', 'winner': 'Nallo', 'section': 'main'}
        old = {'source': 'Cito', 'events': [{'id': 'ufc-332', 'date': '2026-10-04T00:00:00Z', 'status': 'completed', 'bouts': [saved]}]}
        def fetch(path):
            if path == '/upcoming': return []
            if path == '/recent': return [event('ufc-332', '2026-10-04T00:00:00Z', 'UFC 332')]
            return [bout(winner='red')]
        feed = sync.synchronize(fetch, old, NOW)
        self.assertIn(saved, feed['events'][0]['bouts'])

    def test_http_error_does_not_leak_key(self):
        error = HTTPError('https://api.citoapi.com/', 429, 'quota', {}, None)
        with patch.object(sync, 'urlopen', side_effect=error):
            with self.assertRaises(sync.SyncError) as context:
                sync.request_json('/recent', 'secret-do-not-log')
        self.assertNotIn('secret-do-not-log', str(context.exception))

    def test_missing_bout_requires_consistent_comparable_snapshots_one_hour_apart(self):
        a, b = dict(red='A', blue='B'), dict(red='C', blue='D')
        prior = {'bouts': [a, b]}
        prior['bouts'] = sync.merge_bouts(prior, [a], set(), NOW)
        self.assertIn(b, prior['bouts'])
        prior['bouts'] = sync.merge_bouts(prior, [a], set(), NOW + timedelta(minutes=10))
        self.assertIn(b, prior['bouts'])
        prior['bouts'] = sync.merge_bouts(prior, [a], set(), NOW + timedelta(hours=6))
        self.assertEqual(prior['bouts'], [a])
        self.assertEqual(prior['cardChanges'][-1]['kind'], 'removed-from-card')
        self.assertEqual(prior['pendingBoutRemovals'], {})

    def test_empty_or_massively_partial_response_preserves_card(self):
        saved = [dict(red=f'A{i}', blue=f'B{i}') for i in range(10)]
        for incoming in ([], saved[:1]):
            prior = {'bouts': deepcopy(saved)}
            for hours in (0, 6, 24):
                prior['bouts'] = sync.merge_bouts(prior, incoming, set(), NOW + timedelta(hours=hours))
                self.assertEqual(len(prior['bouts']), 10)

    def test_replacement_cancellation_and_result_preservation(self):
        a, b, result = dict(red='A', blue='B'), dict(red='C', blue='D'), dict(red='E', blue='F', winner='E')
        replacement = dict(red='A', blue='G')
        prior = {'bouts': [a, b, result]}
        merged = sync.merge_bouts(prior, [replacement], {sync.pair(b), sync.pair(result)}, NOW)
        self.assertEqual(merged, [replacement, result])
        self.assertEqual([c['kind'] for c in prior['cardChanges']], ['replaced', 'cancelled', 'added'])
        stale = dict(red='E', blue='F', winner=None)
        self.assertEqual(sync.merge_bouts({'bouts': [result]}, [stale], set(), NOW), [result])

    def test_reappearing_pair_clears_pending_and_normalizes_accents(self):
        a = dict(red='José Aldo', blue='Max Holloway')
        b = dict(red='C', blue='D')
        prior = {'bouts': [a, b]}
        prior['bouts'] = sync.merge_bouts(prior, [b], set(), NOW)
        returned = dict(red='max holloway', blue='Jose Aldo')
        prior['bouts'] = sync.merge_bouts(prior, [returned, b], set(), NOW + timedelta(hours=6))
        self.assertEqual(len(prior['bouts']), 2)
        self.assertEqual(prior['pendingBoutRemovals'], {})

    def test_changed_snapshot_resets_confirmation(self):
        a, b, c = [dict(red=x, blue=x+'2') for x in ('A', 'B', 'C')]
        prior = {'bouts': [a, b, c]}
        prior['bouts'] = sync.merge_bouts(prior, [a, b], set(), NOW)
        prior['bouts'] = sync.merge_bouts(prior, [a], set(), NOW + timedelta(hours=6))
        self.assertIn(c, prior['bouts'])

    def test_rescheduled_fight_night_keeps_identity_and_five_request_budget(self):
        row = event('ufc-fight-night-test', '2026-11-01T00:00:00Z', 'UFC Fight Night')
        def fetch(path):
            if path == '/upcoming': return [row]
            if path == '/recent': return []
            return [bout()]
        first = sync.synchronize(fetch, {'events': []}, NOW)
        old_id = first['events'][0]['id']
        original = deepcopy(first)
        row['startsAt'] = '2026-11-08T00:00:00Z'
        second = sync.synchronize(fetch, first, NOW + timedelta(hours=6))
        self.assertEqual(first, original)
        self.assertEqual(len(second['events']), 1)
        self.assertEqual(second['events'][0]['id'], old_id)
        self.assertEqual(second['events'][0]['date'], '2026-11-08T00:00:00+00:00')
        self.assertEqual(second['events'][0]['cardChanges'][-1]['kind'], 'rescheduled')

    def test_inactive_events_require_explicit_reactivation(self):
        row = event('ufc-333', '2026-10-25T00:00:00Z', 'UFC 333')
        calls = []
        def fetch(path):
            calls.append(path)
            if path == '/upcoming': return [row]
            if path == '/recent': return []
            return [bout()]
        feed = sync.synchronize(fetch, {'events': []}, NOW)
        for status in ('cancelled', '', 'postponed', ''):
            row['status'] = status
            calls.clear()
            feed = sync.synchronize(fetch, feed, NOW)
            self.assertIn(feed['events'][0]['status'], ('cancelled', 'postponed'))
            self.assertEqual(len(calls), 2)
        row['status'] = 'scheduled'
        feed = sync.synchronize(fetch, feed, NOW)
        self.assertEqual(feed['events'][0]['status'], 'scheduled')

    def test_transfer_is_recorded_only_after_origin_removal(self):
        cards = [event('ufc-333', '2026-10-25T00:00:00Z', 'UFC 333'), event('ufc-334', '2026-11-15T00:00:00Z', 'UFC 334')]
        cancelled = bout(); cancelled['status'] = 'cancelled'
        previous = {'events': [{'id': 'ufc-333', 'status': 'scheduled', 'date': cards[0]['startsAt'], 'bouts': sync.normalize_bouts([bout()], False)}]}
        def fetch(path):
            if path == '/upcoming': return cards
            if path == '/recent': return []
            return [cancelled] if path == '/ufc-333/bouts' else [bout()]
        feed = sync.synchronize(fetch, previous, NOW)
        origin = next(e for e in feed['events'] if e['id'] == 'ufc-333')
        self.assertEqual(origin['bouts'], [])
        self.assertEqual(origin['cardChanges'][-1]['kind'], 'moved')
        self.assertEqual(origin['cardChanges'][-1]['destinationEventId'], 'ufc-334')

    def test_listing_updates_distant_date_without_extra_bout_request(self):
        cards = [event(f'ufc-{333+i}', f'2026-11-{1+i*7:02d}T00:00:00Z', f'UFC {333+i}') for i in range(4)]
        old = {'events': [{'id': 'ufc-336', 'status': 'scheduled', 'date': '2026-11-20T00:00:00Z', 'bouts': []}]}
        calls = []
        def fetch(path):
            calls.append(path)
            if path == '/upcoming': return cards
            if path == '/recent': return []
            return [bout()]
        feed = sync.synchronize(fetch, old, NOW)
        distant = next(e for e in feed['events'] if e['id'] == 'ufc-336')
        self.assertEqual(distant['date'], '2026-11-22T00:00:00+00:00')
        self.assertEqual(len(calls), 5)
        self.assertNotIn('/ufc-336/bouts', calls)

    def test_duplicate_pairs_are_rejected_and_omitted_event_is_preserved(self):
        with self.assertRaises(sync.SyncError):
            sync.merge_bouts({}, [dict(red='A', blue='B'), dict(red='B', blue='A')], set(), NOW)
        old = {'events': [{'id': 'ufc-336', 'status': 'scheduled', 'date': '2026-11-20T00:00:00Z', 'bouts': []}]}
        def fetch(path):
            if path == '/upcoming': return [event('ufc-333', '2026-10-25T00:00:00Z', 'UFC 333')]
            if path == '/recent': return []
            return [bout()]
        feed = sync.synchronize(fetch, old, NOW)
        self.assertEqual(next(e for e in feed['events'] if e['id']=='ufc-336')['status'], 'scheduled')


if __name__ == '__main__':
    unittest.main()
