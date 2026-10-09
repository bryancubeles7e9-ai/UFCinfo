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

    def test_checkpoint_retry_and_no_duplicate_download(self):
        state = {"source": "UFC", "records": {}, "processedEventIds": [], "completedFighters": {}}
        fighters = [{"id": "a", "name": "A Fighter", "source": "https://www.ufc.com/athlete/a", "record": "10-2-0"},
                    {"id": "b", "name": "B Fighter", "source": "https://www.ufc.com/athlete/b", "record": "5-1-0"}]
        event = {"id": "new", "date": "2026-10-01T02:00:00Z", "status": "completed", "bouts": [{"red": "A Fighter", "blue": "B Fighter", "winner": "A Fighter"}]}
        values = {"a": "11-2-0", "b": "5-1-0"}
        calls = []
        def fetch(fighter):
            calls.append(fighter["id"])
            return {"record": values[fighter["id"]], "info": {"strikesLanded": 4.5, "takedownAverage": 0}}
        with tempfile.TemporaryDirectory() as tmp, patch.object(module, "STATE", Path(tmp) / "feed.json"):
            now = datetime(2026, 10, 3, tzinfo=timezone.utc)
            module.sync([event], state, fighters, fetch=fetch, now=now)
            self.assertEqual(state["completedFighters"]["new"], ["a"])
            self.assertEqual(state["processedEventIds"], [])
            values["b"] = "5-2-0"
            module.sync([event], state, fighters, fetch=fetch, now=now)
            self.assertEqual(calls, ["a", "b", "b"])
            self.assertEqual(state["processedEventIds"], ["new"])
            self.assertEqual(state["records"]["a"]["info"]["strikesLanded"], 4.5)
            module.sync([event], state, fighters, fetch=fetch, now=now)
            self.assertEqual(calls, ["a", "b", "b"])


if __name__ == "__main__":
    unittest.main()
