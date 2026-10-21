import importlib.util
import json
from datetime import datetime, timezone
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest

spec = importlib.util.spec_from_file_location('sync_monitor', Path(__file__).resolve().parents[1] / 'scripts/run-data-sync.py')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)


class SyncHealthTests(unittest.TestCase):
    def test_success_partial_failure_and_recovery_keep_last_success(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); data=root/'assets/data'; data.mkdir(parents=True)
            feed=data/'fighter-records.json'; path=data/'sync-health.json'
            clock=lambda: datetime(2026,10,21,6,tzinfo=timezone.utc)
            success=lambda *a,**k: SimpleNamespace(returncode=0)
            feed.write_text('{}')
            self.assertEqual(m.run('records',root=root,execute=success,clock=clock),0)
            good=json.loads(path.read_text())['jobs']['records']['lastSuccessAt']
            feed.write_text('{"pendingProfileIds":["a"],"profileReview":{"a":{}}}')
            m.run('records',root=root,execute=success,clock=clock)
            entry=json.loads(path.read_text())['jobs']['records']
            self.assertEqual(entry['status'],'partial'); self.assertEqual(entry['pending'],1)
            self.assertEqual(entry['lastSuccessAt'],good)
            before=feed.read_bytes()
            def fail(*a,**k): raise OSError('secret-must-not-be-published')
            self.assertEqual(m.run('records',root=root,execute=fail,clock=clock),1)
            self.assertEqual(feed.read_bytes(),before)
            self.assertNotIn('secret-must-not-be-published',path.read_text())
            self.assertEqual(json.loads(path.read_text())['jobs']['records']['status'],'failed')
            failed=json.loads(path.read_text())['jobs']['records']
            self.assertEqual(failed['consecutiveFailures'],1)
            self.assertEqual(failed['pendingSince'],clock().isoformat())
            m.run('records',root=root,execute=fail,clock=clock)
            self.assertEqual(json.loads(path.read_text())['jobs']['records']['consecutiveFailures'],2)
            feed.write_text('{}'); m.run('records',root=root,execute=success,clock=clock)
            self.assertEqual(json.loads(path.read_text())['jobs']['records']['status'],'success')
            recovered=json.loads(path.read_text())['jobs']['records']
            self.assertEqual(recovered['consecutiveFailures'],0)
            self.assertNotIn('pendingSince',recovered)

    def test_malformed_output_cannot_be_reported_successful(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); data=root/'assets/data'; data.mkdir(parents=True)
            (data/'ufc-events.json').write_text('invalid')
            self.assertEqual(m.run('events',root=root,execute=lambda *a,**k: SimpleNamespace(returncode=0)),1)
            self.assertEqual(json.loads((data/'sync-health.json').read_text())['jobs']['events']['status'],'failed')


if __name__=='__main__': unittest.main()
