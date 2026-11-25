import importlib.util
from pathlib import Path
from datetime import datetime, timezone, timedelta
import unittest

spec = importlib.util.spec_from_file_location('alerts', Path(__file__).resolve().parents[1] / 'scripts/check-data-health.py')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)


class AlertTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 10, 22, 12, tzinfo=timezone.utc)
        self.stamp = self.now.isoformat()
        self.state = {'jobs': {k: {'lastSuccessAt': self.stamp} for k in m.monitor.JOBS}}
        self.feeds = {k: {} for k in m.monitor.JOBS}
        self.rumors = {'lastSearchedAt': self.stamp, 'groups': []}

    def check(self):
        return m.assess(self.state, self.feeds, self.rumors, self.now)

    def test_no_new_rumors_is_healthy(self):
        self.assertEqual(self.check(), [])

    def test_stale_rumors(self):
        self.rumors['lastSearchedAt'] = (self.now - timedelta(hours=4)).isoformat()
        self.assertEqual(len(self.check()), 1)

    def test_pending_and_recovery(self):
        self.state['jobs']['records']['pendingSince'] = (self.now - timedelta(hours=49)).isoformat()
        self.feeds['records']['pendingProfileIds'] = ['a']
        self.assertEqual(len(self.check()), 1)
        self.feeds['records']['pendingProfileIds'] = []
        self.assertEqual(self.check(), [])

    def test_repeated_failures_and_newer_retry(self):
        self.state['jobs']['records'].update(consecutiveFailures=2, attemptedAt=(self.now-timedelta(hours=2)).isoformat())
        self.assertEqual(len(self.check()), 1)
        self.feeds['records']['lastSync'] = {'checkedAt': self.stamp}
        self.assertEqual(self.check(), [])

    def test_missing_source_statistics_warns_but_real_failures_still_fail(self):
        self.state['jobs']['records']['pendingSince'] = (self.now - timedelta(hours=49)).isoformat()
        feed = self.feeds['records']
        feed.update(pendingProfileIds=['jack'], lastSync={
            'checkedAt': self.stamp, 'failedIds': ['jack'], 'recordOnlyIds': ['jack']})
        warnings = []
        self.assertEqual(m.assess(self.state, self.feeds, self.rumors, self.now, warnings), [])
        self.assertEqual(len(warnings), 1)
        self.assertIn('jack', warnings[0])
        for extra in ({'profileReview': {'jack': {'reason': 'regression'}}},
                      {'unmatchedEventFighters': {'card': ['Missing']}},
                      {'pendingProfileIds': ['jack', 'other']}):
            original = dict(feed)
            feed.update(extra)
            self.assertTrue(self.check())
            feed.clear(); feed.update(original)
        feed['lastSync']['failedIds'].append('network-error')
        self.assertTrue(self.check())
        feed['lastSync']['failedIds'].pop()
        feed['lastSync']['checkedAt'] = (self.now - timedelta(hours=31)).isoformat()
        self.assertTrue(self.check())
        feed['lastSync']['checkedAt'] = (self.now + timedelta(hours=1)).isoformat()
        self.assertTrue(self.check())

    def test_distinguishes_no_attempt_failed_and_partial(self):
        job = self.state['jobs']['events']
        job['lastSuccessAt'] = (self.now - timedelta(hours=40)).isoformat()
        self.assertIn('no consta un intento reciente', self.check()[0])
        job.update(status='failed', attemptedAt=self.stamp, consecutiveFailures=1)
        self.assertIn('último intento falló', self.check()[0])
        job['lastSuccessAt'] = self.stamp
        warnings = []
        self.assertEqual(m.assess(self.state, self.feeds, self.rumors, self.now, warnings), [])
        self.assertIn('último intento falló', warnings.pop())
        job.update(status='partial', consecutiveFailures=0)
        self.feeds['events']['scheduleVerification'] = {'failedIds':['some-card']}
        self.assertEqual(m.assess(self.state, self.feeds, self.rumors, self.now, warnings), [])
        self.assertIn('actualización parcial', warnings.pop())

    def test_schedule_distinguishes_push_queue_failure_and_success(self):
        now = datetime(2026, 11, 19, 9, tzinfo=timezone.utc)  # 10:00 Madrid
        run = {'head_branch':'main', 'created_at':'2026-11-19T07:15:00Z',
               'event':'push', 'status':'completed', 'conclusion':'success'}
        self.assertIn('no consta', m.schedule_warning([run], now))
        run.update(event='schedule', status='queued', conclusion=None)
        self.assertIn('en cola', m.schedule_warning([run], now))
        run.update(status='completed', conclusion='failure')
        self.assertIn('no terminó correctamente', m.schedule_warning([run], now))
        run.update(conclusion='success')
        self.assertIsNone(m.schedule_warning([run], now))
        run.update(event='workflow_dispatch')  # cron-job.org dispatch fills the slot too.
        self.assertIsNone(m.schedule_warning([run], now))

    def test_schedule_grace_and_madrid_summer_time(self):
        run = {'head_branch':'main', 'created_at':'2026-07-01T12:01:00Z',
               'event':'schedule', 'status':'completed', 'conclusion':'success'}
        next_day = datetime(2026, 7, 2, 7, 20, tzinfo=timezone.utc)
        self.assertIsNone(m.schedule_warning([run], next_day))  # 09:20, still in grace.
        self.assertIn('02/07 a las 08:00', m.schedule_warning([run], next_day + timedelta(minutes=15)))
        run['created_at'] = '2026-07-02T06:04:00Z'
        self.assertIsNone(m.schedule_warning([run], next_day + timedelta(minutes=15)))

    def test_run_history(self):
        run = lambda c: {'head_branch': 'main', 'status': 'completed', 'conclusion': c}
        self.assertFalse(m.repeated_failures([run('success'), run('failure')]))
        self.assertFalse(m.repeated_failures([run('failure')]))
        self.assertTrue(m.repeated_failures([run('failure'), run('cancelled'), run('timed_out')]))


if __name__ == '__main__': unittest.main()
