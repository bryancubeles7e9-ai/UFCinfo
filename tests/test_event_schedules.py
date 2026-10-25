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

    def test_only_matching_official_title_bouts_confirm_five_rounds(self):
        event={'date':'2026-11-01T00:00:00+00:00','source':'https://www.ufc.com/event/test','bouts':[
            {'red':'Alpha','blue':'Beta'}, {'red':'Charlie','blue':'Delta'}, {'red':'Else','blue':'Other'}]}
        page='<div class="c-hero__headline-suffix" data-timestamp="1793491200"></div>'
        for red,blue,label in [('Alpha','Beta','Lightweight Bout'),('Charlie','Delta','Heavyweight Title Bout')]:
            page+=f'<div class="c-listing-fight"><div class="c-listing-fight__corner-name--red">{red}</div><div class="c-listing-fight__corner-name--blue">{blue}</div><div class="c-listing-fight__class-text">{label}</div></div>'
        m.confirm_title_rounds(page,event)
        self.assertNotIn('scheduledRounds',event['bouts'][0])
        self.assertEqual(event['bouts'][1]['scheduledRounds'],5)
        self.assertNotIn('scheduledRounds',event['bouts'][2])
        event['bouts'][1].pop('scheduledRounds')
        m.confirm_title_rounds(page.replace('1793491200','1793577600'),event)
        self.assertNotIn('scheduledRounds',event['bouts'][1])

if __name__=='__main__':unittest.main()
