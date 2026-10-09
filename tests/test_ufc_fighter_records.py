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
            return values[fighter["id"]]
        with tempfile.TemporaryDirectory() as tmp, patch.object(module, "STATE", Path(tmp) / "feed.json"):
            now = datetime(2026, 10, 3, tzinfo=timezone.utc)
            module.sync([event], state, fighters, fetch=fetch, now=now)
            self.assertEqual(state["completedFighters"]["new"], ["a"])
            self.assertEqual(state["processedEventIds"], [])
            values["b"] = "5-2-0"
            module.sync([event], state, fighters, fetch=fetch, now=now)
            self.assertEqual(calls, ["a", "b", "b"])
            self.assertEqual(state["processedEventIds"], ["new"])
            module.sync([event], state, fighters, fetch=fetch, now=now)
            self.assertEqual(calls, ["a", "b", "b"])


if __name__ == "__main__":
    unittest.main()
