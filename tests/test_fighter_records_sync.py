import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("fighter_sync", Path(__file__).resolve().parents[1] / "scripts/sync-fighter-records.py")
sync = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(sync)


class FakeClient:
    def __init__(self, bad=False):
        self.used, self.limit, self.calls, self.bad = 0, 80, [], bad

    def get(self, endpoint, **params):
        self.used += 1
        self.calls.append((endpoint, params))
        if endpoint == "/fighters":
            return [{"id": 7, "name": "A Fighter"}]
        if self.bad:
            return [{"fighter": {"id": 7}, "total": {"win": None, "loss": None, "draw": None}}]
        return [{"fighter": {"id": 7}, "total": {"win": 11, "loss": 2, "draw": 0}}]


class FighterSyncTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.state_file = Path(self.tmp.name) / "state.json"
        self.patch = patch.object(sync, "STATE", self.state_file)
        self.patch.start()
        self.addCleanup(self.patch.stop)
        self.state = {"schemaVersion": 1, "source": "API-Sports MMA", "processedEventIds": [],
                      "completedFighters": {}, "apiIds": {}, "records": {}}
        self.event = {"id": "test-event", "date": "2026-10-10T02:00:00Z", "status": "completed",
                      "bouts": [{"red": "A Fighter", "blue": "Unknown Fighter", "winner": "A Fighter"}]}
        self.directory = [{"id": "a", "name": "A Fighter", "aliases": []}]

    def test_success_and_no_repeat_calls(self):
        client = FakeClient()
        sync.sync(client, [self.event], self.state, self.directory)
        self.assertEqual(client.used, 2)
        self.assertEqual(self.state["records"]["a"]["record"], "11-2-0")
        self.assertEqual(self.state["processedEventIds"], ["test-event"])
        sync.sync(client, [self.event], self.state, self.directory)
        self.assertEqual(client.used, 2)
        self.assertEqual(json.loads(self.state_file.read_text())["apiIds"], {"a": 7})

    def test_invalid_data_preserves_snapshot_and_retries(self):
        client = FakeClient(bad=True)
        sync.sync(client, [self.event], self.state, self.directory)
        self.assertEqual(self.state["records"], {})
        self.assertEqual(self.state["processedEventIds"], [])
        client.bad = False
        sync.sync(client, [self.event], self.state, self.directory)
        self.assertEqual(client.used, 3)  # ID was safely cached after the first lookup.
        self.assertEqual(self.state["records"]["a"]["record"], "11-2-0")

    def test_incomplete_event_waits(self):
        client = FakeClient()
        self.event["bouts"][0]["winner"] = None
        sync.sync(client, [self.event], self.state, self.directory)
        self.assertEqual(client.used, 0)
        self.assertEqual(self.state["processedEventIds"], [])


if __name__ == "__main__":
    unittest.main()
