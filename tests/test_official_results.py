import importlib.util
from datetime import datetime, timezone
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('results',Path(__file__).resolve().parents[1]/'scripts/reconcile-official-results.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
NOW=datetime(2026,10,18,6,tzinfo=timezone.utc)

def fight(red,blue):
    return f'''<div class="c-listing-fight"><div class="c-listing-fight__corner--red"><span class="c-listing-fight__corner-name--red">{red}</span><span class="c-listing-fight__outcome--win">Win</span></div><div class="c-listing-fight__corner--blue"><span class="c-listing-fight__corner-name--blue">{blue}</span></div><span class="method">KO/TKO</span><span class="round">2</span><span class="time">0:47</span></div>'''

def page():
    return '<div id="main-card"><span class="c-event-fight-card-broadcaster__time" data-timestamp="1792281600"></span>'+fight('Alpha','Beta')+fight('Nallo','Landwehr')+'</div>'

def event():
    return dict(id='test',date='2026-10-18T00:00:00Z',status='scheduled',source='https://www.ufc.com/event/test',bouts=[dict(red='Alpha',blue='Beta',winner=None)])

class OfficialResultsTests(unittest.TestCase):
    def test_recovers_missing_bout_and_keeps_other_saved_result(self):
        e=event(); e['bouts'].append(dict(red='Boser',blue='Diniz',winner='Boser',section='prelims'))
        bouts=m.completed_card(page(),e,NOW)
        self.assertEqual(len(bouts),3)
        self.assertEqual(bouts[1]['winner'],'Nallo')
        self.assertEqual(bouts[-1]['winner'],'Boser')
    def test_incomplete_or_wrong_card_preserves_data(self):
        e=event();feed={'events':[e]}
        m.reconcile(feed,lambda _:page().replace('c-listing-fight__outcome--win','not-finished'),NOW)
        self.assertEqual(e,event())
        self.assertEqual(feed['resultsVerification']['failedIds'],['test'])
        with self.assertRaises(ValueError):m.completed_card(page().replace('Alpha','Unrelated'),e,NOW)
    def test_date_mismatch_rejected(self):
        with self.assertRaises(ValueError):m.completed_card(page().replace('1792281600','1700000000'),event(),NOW)

if __name__=='__main__':unittest.main()
