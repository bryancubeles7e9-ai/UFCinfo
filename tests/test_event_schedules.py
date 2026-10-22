import importlib.util
from pathlib import Path
from datetime import datetime, timezone
import unittest
spec=importlib.util.spec_from_file_location('schedule',Path(__file__).resolve().parents[1]/'scripts/sync-event-schedules.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class ScheduleTests(unittest.TestCase):
    def test_official_blocks_and_rejection(self):
        event={'date':'2026-11-01T00:00:00+00:00','source':'https://www.ufc.com/event/test'}
        page='<div id="main-card"><div class="c-event-fight-card-broadcaster__time" data-timestamp="1793491200"></div></div><div id="prelims-card"><div class="c-event-fight-card-broadcaster__time" data-timestamp="1793480400"></div></div>'
        result=m.parse_schedule(page,event,datetime.now(timezone.utc))
        self.assertEqual(result['starts']['prelims'],'2026-10-31T21:00:00+00:00')
        for bad in ['',page.replace('1793480400','1793491201'),page.replace('1793491200','1793577600')]:
            with self.assertRaises(ValueError):m.parse_schedule(bad,event,datetime.now(timezone.utc))

if __name__=='__main__':unittest.main()
