import importlib.util
from datetime import datetime, timezone
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("ufc_records", Path(__file__).resolve().parents[1] / "scripts/sync-ufc-fighter-records.py")
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


class OfficialRecordsTest(unittest.TestCase):
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
