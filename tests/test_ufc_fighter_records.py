import importlib.util
import copy
from datetime import datetime, timedelta, timezone
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("ufc_records", Path(__file__).resolve().parents[1] / "scripts/sync-ufc-fighter-records.py")
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


class OfficialRecordsTest(unittest.TestCase):
    def test_regressions_preserve_entire_profile_and_retry_until_valid(self):
        fighter = {'id': 'a', 'name': 'A', 'record': '8-1-0', 'source': 'https://www.ufc.com/athlete/a'}
        saved = {'record': '8-1-0', 'updatedAt': '2026-10-01',
                 'info': {'strikesLanded': 4, 'koWins': 5, 'statisticsConsulted': '2026-10-01'}}
        state = {'records': {'a': copy.deepcopy(saved)}, 'processedEventIds': ['card'],
                 'completedFighters': {'card': ['a']}}
        event = {'id': 'card', 'date': '2026-10-20T00:00:00Z', 'status': 'completed',
                 'bouts': [{'red': 'A', 'blue': 'A', 'winner': 'A'}]}
        now = datetime(2026, 10, 21, tzinfo=timezone.utc)
        with tempfile.TemporaryDirectory() as tmp, patch.object(module, 'STATE', Path(tmp) / 'feed.json'):
            for bad in ({'record': '1-0-0', 'info': None},
                        {'record': '8-0-1', 'info': {'strikesLanded': 3}},
                        {'record': '9-1-0', 'info': {'koWins': 0}},
                        {'record': '9-1-0', 'info': dict.fromkeys(module.CORE_STATS, 0)}):
                module.sync([event], state, [fighter], fetch=lambda f: bad, now=now)
                self.assertEqual(state['records']['a'], saved)
                self.assertEqual(state['pendingProfileIds'], ['a'])
                self.assertEqual(state['lastSync']['succeeded'], 0)
                self.assertNotIn('card', state['processedEventIds'])
                self.assertIn('a', state['profileReview'])
            module.sync([event], state, [fighter], fetch=lambda f: {
                'record': '9-1-0', 'info': {'strikesLanded': 3, 'koWins': 5}}, now=now)
        self.assertEqual(state['records']['a']['record'], '9-1-0')
        self.assertEqual(state['records']['a']['info']['strikesLanded'], 3)
        self.assertEqual(state['pendingProfileIds'], [])
        self.assertEqual(state['profileReview'], {})
        self.assertIn('card', state['processedEventIds'])

    def test_official_correction_is_accepted_after_72_unchanged_hours(self):
        fighter = {'id': 'm', 'name': 'M', 'record': '23-8-0', 'source': 'https://www.ufc.com/athlete/m',
                   'info': {'koWins': 6, 'submissionWins': 8}}
        corrected = {'record': '23-9-0', 'info': {'strikesLanded': 3.2, 'strikesAbsorbed': 2.5, 'takedownAverage': 1.3,
                                                  'submissionAverage': 0.7, 'koWins': 5, 'submissionWins': 9}}
        state = {'records': {}, 'processedEventIds': [], 'completedFighters': {}}
        start = datetime(2026, 11, 20, tzinfo=timezone.utc)
        with tempfile.TemporaryDirectory() as tmp, patch.object(module, 'STATE', Path(tmp) / 'feed.json'):
            for hours in (0, 24, 71):
                module.sync([], state, [fighter], fetch=lambda f: corrected, now=start + timedelta(hours=hours), full=True)
                self.assertNotIn('m', state['records'], 'held for review before 72 hours')
                self.assertEqual(state['profileReview']['m']['firstSeenAt'], start.isoformat())
            module.sync([], state, [fighter], fetch=lambda f: corrected, now=start + timedelta(hours=72), full=True)
            self.assertEqual(state['records']['m']['record'], '23-9-0')
            self.assertEqual(state['records']['m']['info']['koWins'], 5)
            self.assertEqual(state['records']['m']['acceptedCorrection']['previousRecord'], '23-8-0')
            self.assertNotIn('m', state['profileReview'])
            # Later checks compare with the accepted profile, not the old directory values.
            module.sync([], state, [fighter], fetch=lambda f: corrected, now=start + timedelta(hours=96), full=True)
            self.assertNotIn('m', state['profileReview'])
            self.assertIn('acceptedCorrection', state['records']['m'])

    def test_changed_or_drastic_regressions_are_never_accepted_automatically(self):
        fighter = {'id': 'd', 'name': 'D', 'record': '20-2-0', 'source': 'https://www.ufc.com/athlete/d'}
        state = {'records': {}, 'processedEventIds': [], 'completedFighters': {}}
        start = datetime(2026, 11, 20, tzinfo=timezone.utc)
        with tempfile.TemporaryDirectory() as tmp, patch.object(module, 'STATE', Path(tmp) / 'feed.json'):
            for hours in (0, 100, 200):  # A broken page showing a much lower record.
                module.sync([], state, [fighter], fetch=lambda f: {'record': '2-0-0', 'info': None}, now=start + timedelta(hours=hours), full=True)
            self.assertNotIn('d', state['records'])
            # A correction that keeps changing restarts its 72-hour window.
            other = {'id': 'e', 'name': 'E', 'record': '10-1-0', 'source': 'https://www.ufc.com/athlete/e', 'info': {'koWins': 4}}
            for hours, ko in ((0, 3), (48, 2), (100, 2)):
                module.sync([], state, [other], fetch=lambda f, ko=ko: {'record': '10-1-0', 'info': {'koWins': ko}}, now=start + timedelta(hours=hours), full=True)
            self.assertNotIn('e', state['records'])
            self.assertEqual(state['profileReview']['e']['firstSeenAt'], (start + timedelta(hours=48)).isoformat())

    def test_directory_record_protects_first_sync_and_corrupt_existing_state(self):
        fighter = {'record': '8-1-0'}
        for previous in ({}, {'record': '1-0-0'}):
            with self.assertRaisesRegex(ValueError, 'regression'):
                module.validate_progress(fighter, previous, {'record': '1-0-0', 'info': None})
        module.validate_progress(fighter, {}, {'record': '8-2-0', 'info': None})

    def test_valid_zero_rates_and_decreasing_percentages_are_allowed(self):
        module.validate_progress({}, {'record': '8-1-0', 'info': {'takedownAverage': 1, 'strikingDefense': 60}},
                                 {'record': '8-2-0', 'info': {'takedownAverage': 0, 'strikingDefense': 55}})

    def test_stats_require_complete_core_and_preserve_missing_optional(self):
        page = '<h1 class="hero-profile__name">A Fighter</h1><p class="hero-profile__division-body">11-2-0 (W-L-D)</p>'
        for label, value in [("Sig. Str. Landed", 4.2), ("Sig. Str. Absorbed", 2.3), ("Takedown avg", 0), ("Submission avg", 0.5)]:
            page += f'<div class="c-stat-compare__number">{value}<div class="c-stat-compare__label">{label}</div></div>'
        parsed = module.parse_profile(page, {"name": "A Fighter"})
        self.assertEqual(parsed["info"]["takedownAverage"], 0)
        self.assertNotIn("koWins", parsed["info"])
        with self.assertRaises(ValueError):
            module.parse_profile(page.replace("Sig. Str. Landed", "Other stat"), {"name": "A Fighter"})
        with self.assertRaises(ValueError):
            module.parse_profile(page + '<title>Striking accuracy 101%</title>', {"name": "A Fighter"})

    def test_ufc_stats_completes_missing_core_statistics(self):
        fighter = {"id": "ufc-a-fighter", "name": "A Fighter", "aliases": []}
        url = "http://ufcstats.com/fighter-details/0123456789abcdef"
        search = ('<tr class="b-statistics__table-row"><td><a href="' + url + '">A</a></td><td><a href="' + url +
                  '">Fighter</a></td></tr><tr class="b-statistics__table-row"><td><a href="http://ufcstats.com/fighter-details/'
                  'fedcba9876543210">B</a></td><td>Fighter</td></tr>')
        details = ('<span class="b-content__title-highlight"> A Fighter </span><span class="b-content__title-record">Record: 11-2-0</span>'
                   '<li><i>SLpM:</i> 6.22</li><li><i>Str. Acc.:</i> 50%</li><li><i>SApM:</i> 4.27</li><li><i>Str. Def:</i> 61%</li>'
                   '<li><i>TD Avg.:</i> 0.47</li><li><i>TD Acc.:</i> 40%</li><li><i>TD Def.:</i> 69%</li><li><i>Sub. Avg.:</i> 0.2</li>')
        pages = {module.UFC_STATS + "/statistics/fighters/search?query=Fighter": search, url: details}
        official = '<div class="c-record__promoted-figure">12</div><div class="c-record__promoted-text">Wins by Knockout</div>'
        profile = module.complete_from_ufc_stats(fighter, "11-2-0", official, read=pages.__getitem__)
        self.assertEqual(profile["statisticsSource"], url)
        self.assertEqual(profile["info"]["strikesLanded"], 6.22)
        self.assertEqual(profile["info"]["strikingDefense"], 61)
        self.assertEqual(profile["info"]["submissionAverage"], 0.2)
        for key in module.CORE_STATS:
            self.assertIn(key, profile["info"])
        # A different record or another fighter's page is never used.
        with self.assertRaises(ValueError):
            module.complete_from_ufc_stats(fighter, "12-2-0", official, read=pages.__getitem__)
        with self.assertRaises(ValueError):
            module.parse_ufc_stats(details.replace("A Fighter", "Other Person"), fighter, "11-2-0")
        with self.assertRaises(ValueError):
            module.parse_ufc_stats(details.replace("<li><i>SApM:</i> 4.27</li>", ""), fighter, "11-2-0")

    def test_ufc_stats_source_is_saved_with_statistics(self):
        state = {"records": {}}
        fighter = {"id": "a", "source": "https://www.ufc.com/athlete/a", "record": "11-2-0"}
        info = {"strikesLanded": 6.22, "strikesAbsorbed": 4.27, "takedownAverage": 0.47, "submissionAverage": 0.2}
        with patch.object(module, "save"):
            module.store_profile(state, fighter, {"record": "11-2-0", "info": info,
                                                  "statisticsSource": "http://ufcstats.com/fighter-details/0123456789abcdef"},
                                 datetime(2026, 11, 25, tzinfo=timezone.utc))
        self.assertEqual(state["records"]["a"]["info"]["statisticsSource"], "http://ufcstats.com/fighter-details/0123456789abcdef")

    def test_identity_and_record_validation(self):
        page = '<h1 class="hero-profile__name">A Fighter</h1><p class="hero-profile__division-body">11-2-0 (W-L-D)</p>'
        self.assertEqual(module.parse_record(page, {"name": "A Fighter"}), "11-2-0")
        with self.assertRaises(ValueError):
            module.parse_record(page, {"name": "Another Fighter"})
        with self.assertRaises(ValueError):
            module.parse_record(page.replace("11-2-0", "No record"), {"name": "A Fighter"})

    def test_recent_processed_card_refreshes_immediately_with_unchanged_record(self):
        state = {"source": "UFC", "records": {}, "processedEventIds": ["new"], "completedFighters": {}}
        fighter = {"id": "a", "name": "A Fighter", "source": "https://www.ufc.com/athlete/a", "record": "10-2-0"}
        event = {"id": "new", "date": "2026-10-03T00:00:00Z", "status": "completed", "bouts": [{"red": "A Fighter", "blue": "Unknown", "winner": "A Fighter"}]}
        with tempfile.TemporaryDirectory() as tmp, patch.object(module, "STATE", Path(tmp) / "feed.json"):
            now = datetime(2026, 10, 3, 3, tzinfo=timezone.utc)
            for value in (4.5, 5.5):
                calls = []
                def fetch(f):
                    calls.append(f["id"])
                    return {"record": "10-2-0", "info": {"strikesLanded": value}}
                module.sync([event], state, [fighter], fetch=fetch, now=now)
                self.assertEqual(calls, ["a"])
                self.assertEqual(state["records"]["a"]["info"]["strikesLanded"], value)
            self.assertEqual(state["processedEventIds"], [])
            self.assertEqual(state["unmatchedEventFighters"], {"new": ["Unknown"]})

    def test_full_refresh_preserves_failed_fighter_and_optional_stats(self):
        state = {"source": "UFC", "records": {"a": {"record": "1-0-0", "info": {"koWins": 1}}, "b": {"record": "5-2-0"}}, "processedEventIds": [], "completedFighters": {}}
        fighters = [{"id": x, "name": x, "source": "https://www.ufc.com/athlete/"+x, "record": "1-0-0"} for x in ('a','b')]
        def fetch(f):
            if f['id'] == 'b': raise ValueError('incomplete statistics')
            return {"record": "2-0-0", "info": {"strikesLanded": 4}}
        with tempfile.TemporaryDirectory() as tmp, patch.object(module, "STATE", Path(tmp) / "feed.json"):
            module.sync([], state, fighters, fetch=fetch, full=True)
        self.assertEqual(state['records']['a']['info']['koWins'], 1)
        self.assertEqual(state['records']['b'], {"record": "5-2-0"})
        self.assertEqual(state['lastSync']['failedIds'], ['b'])
        self.assertNotIn('fullRefreshCompletedAt', state)
        calls = []
        def retry(f):
            calls.append(f['id'])
            return {"record": "5-2-0", "info": {"strikesLanded": 3}}
        with tempfile.TemporaryDirectory() as tmp, patch.object(module, "STATE", Path(tmp) / "feed.json"):
            module.sync([], state, fighters, fetch=retry)
        self.assertEqual(calls, ['b'])
        self.assertEqual(state['pendingProfileIds'], [])
        self.assertIn('fullRefreshCompletedAt', state)

    def test_record_only_update_retains_stats_timestamp_and_retries(self):
        state = {"records": {"a": {"record": "1-0-0", "info": {"strikesLanded": 3, "statisticsConsulted": "2026-10-01"}}}, "processedEventIds": [], "completedFighters": {}, "pendingProfileIds": ["a"]}
        fighter = {"id": "a", "name": "A", "source": "https://www.ufc.com/athlete/a"}
        with tempfile.TemporaryDirectory() as tmp, patch.object(module, "STATE", Path(tmp)/"feed.json"):
            module.sync([], state, [fighter], fetch=lambda f: {"record": "2-0-0", "info": None})
        self.assertEqual(state['records']['a']['record'], '2-0-0')
        self.assertEqual(state['records']['a']['info']['statisticsConsulted'], '2026-10-01')
        self.assertEqual(state['pendingProfileIds'], ['a'])
        self.assertEqual(state['lastSync']['recordOnlyIds'], ['a'])

    def test_pending_statistics_get_reserved_slots_within_budget(self):
        fighters = [{"id": str(i), "name": str(i), "source": "https://www.ufc.com/athlete/"+str(i)} for i in range(44)]
        pending = [str(i) for i in range(40,44)]
        state = {"records": {f["id"]: {"updatedAt": "2026-10-18" if f["id"] in pending else "2026-10-01"} for f in fighters}, "processedEventIds": [], "completedFighters": {}, "pendingProfileIds": pending}
        event = {"id": "recent", "date": "2026-10-18T00:00:00Z", "status": "completed", "bouts": [{"red": str(i), "blue": str(i+1), "winner": str(i)} for i in range(0,44,2)]}
        calls = []
        def fetch(f):
            calls.append(f['id'])
            return {"record": "1-0-0", "info": {"strikesLanded": 3}}
        with tempfile.TemporaryDirectory() as tmp, patch.object(module, "STATE", Path(tmp)/"feed.json"):
            module.sync([event], state, fighters, fetch=fetch, now=datetime(2026,10,18,19,tzinfo=timezone.utc))
        self.assertEqual(len(calls), 40)
        self.assertTrue(set(pending).issubset(calls))
        self.assertEqual(state['pendingProfileIds'], [])

    def test_old_processed_and_unfinished_bouts_not_queried(self):
        state = {"source": "UFC", "records": {}, "processedEventIds": ['old'], "completedFighters": {}}
        fighter = {"id": "a", "name": "A", "source": "https://www.ufc.com/athlete/a", "record": "1-0-0"}
        events = [{"id": "old", "date": "2026-01-01T00:00:00Z", "status": "completed", "bouts": [{"red": "A", "blue": "B", "winner": "A"}]},
                  {"id": "new", "date": "2026-10-03T00:00:00Z", "status": "completed", "bouts": [{"red": "A", "blue": "B", "winner": None}]}]
        with tempfile.TemporaryDirectory() as tmp, patch.object(module, "STATE", Path(tmp) / "feed.json"):
            used = module.sync(events, state, [fighter], fetch=lambda f: self.fail('unexpected request'), now=datetime(2026,10,3,3,tzinfo=timezone.utc))
        self.assertEqual(used, 0)


if __name__ == "__main__":
    unittest.main()
