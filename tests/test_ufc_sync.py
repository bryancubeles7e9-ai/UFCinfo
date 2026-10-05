import copy
from datetime import datetime, timezone
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

spec = importlib.util.spec_from_file_location('ufc_sync', Path(__file__).resolve().parents[1]/'scripts/sync-ufc-events.py')
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)
NOW = datetime(2026, 10, 5, tzinfo=timezone.utc)

def fight(order, section='main', status='completed', winner=1, normalized='ko_tko'):
    return {'ordering':order,'card_section':section,'status':status,'is_main':order==1,'weight_class':'Lightweight','fighter_a':{'id':1,'name':'Fighter A'},'fighter_b':{'id':2,'name':'Fighter B'},'result':{'winner_fighter_id':winner,'method':'KO/TKO','method_normalized':normalized,'round':2,'time':'1:30'}}

def event(number=332):
    return {'id':number,'org':'ufc','status':'completed','numbering':f'UFC {number}','starts_at':'2026-10-03T22:00:00Z','main_card_at':'2026-10-04T00:00:00Z','venue':{'name':'Arena','city':'City','country':'Country'},'card':[fight(2),fight(1),fight(3,'prelims'),fight(4,status='cancelled')]}

def page(rows, more=False, cursor=None):
    return {'data':rows,'meta':{'pagination':{'has_more':more,'next_cursor':cursor}}}

class SyncTests(unittest.TestCase):
    def test_main_card_order_and_results(self):
        result = sync.normalize_event(event(), NOW)
        self.assertEqual(len(result['bouts']),2)
        self.assertEqual(result['date'],'2026-10-04T00:00:00+00:00')
        self.assertEqual(result['bouts'][0]['winner'],'Fighter A')
        self.assertEqual(result['source'],'https://www.ufc.com/event/ufc-332')

    def test_draw_no_contest_missing_result(self):
        for status, normalized, expected in [('completed','draw','Empate'),('no_contest','no_contest','Sin resultado (No contest)')]:
            e=event(); e['card']=[fight(1,status=status,winner=None,normalized=normalized)]
            b=sync.normalize_event(e,NOW)['bouts'][0]
            self.assertIsNone(b['winner']); self.assertEqual(b['outcome'],expected)
        e=event(); e['card'][0]['result']=None
        self.assertIsNone(sync.normalize_event(e,NOW)['bouts'][1]['winner'])

    def test_invalid_winner_and_missing_main_fail(self):
        e=event(); e['card'][0]['result']['winner_fighter_id']=999
        with self.assertRaises(sync.SyncError): sync.normalize_event(e,NOW)
        e['card']=[fight(1,'prelims')]
        with self.assertRaises(sync.SyncError): sync.normalize_event(e,NOW)

    def test_pagination_and_scope(self):
        unnumbered=event(); unnumbered['numbering']=None; unnumbered['title']='UFC Freedom 250'
        scheduled=event(333); scheduled['status']='scheduled'
        prior=event(320); prior['starts_at']=prior['main_card_at']='2025-12-20T00:00:00Z'
        other=event(); other['org']='pfl'
        future=event(335); future['main_card_at']='2026-12-12T00:00:00Z'
        calls=[]
        def fetch(path,params):
            calls.append(copy.deepcopy(params))
            return page([event(331),unnumbered,prior,other,scheduled,future],True,'next') if not params.get('cursor') else page([event()])
        rows=sync.list_events(fetch,2026,NOW)
        self.assertEqual([r['id'] for r in rows],[331,332])
        self.assertEqual(calls[1]['cursor'],'next')
        self.assertEqual(calls[0]['status'],'completed')
        self.assertNotIn('is_ppv',calls[0])

    def test_repeating_cursor_fails(self):
        with self.assertRaises(sync.SyncError): sync.list_events(lambda p,q:page([],True,'same'),2026,NOW)

    def test_detail_failure_leaves_file_intact(self):
        with tempfile.TemporaryDirectory() as d:
            output=Path(d)/'feed.json';output.write_text('previous valid data')
            def fetch(path,params):
                if path=='/events':return page([event()])
                raise sync.SyncError('provider down')
            with self.assertRaises(sync.SyncError):
                sync.atomic_save(output,sync.synchronize(fetch,NOW))
            self.assertEqual(output.read_text(),'previous valid data')

    def test_missing_event_preserves_file(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'feed.json';p.write_text(json.dumps({'year':2026,'events':[{'id':'ufc-332'}]}))
            before=p.read_text()
            with self.assertRaises(sync.SyncError):sync.atomic_save(p,{'year':2026,'events':[]})
            self.assertEqual(before,p.read_text())
            sync.atomic_save(p,{'year':2027,'events':[]})
            self.assertEqual(json.loads(p.read_text())['year'],2027)

    def test_success_and_schema(self):
        payload=sync.synchronize(lambda path,params:page([event()]) if path=='/events' else {'data':event()},NOW)
        self.assertEqual(payload['source'],'UFCalendar')
        self.assertEqual(payload['schemaVersion'],1)
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'feed.json';sync.atomic_save(p,payload)
            self.assertEqual(json.loads(p.read_text()),payload)

    def test_http_failure_does_not_expose_key(self):
        error=HTTPError('https://api.ufcalendar.com/v1/events',401,'Unauthorized',{},None)
        with patch.object(sync,'urlopen',side_effect=error):
            with self.assertRaises(sync.SyncError) as result: sync.request_json('/events','secret-do-not-log')
        self.assertNotIn('secret-do-not-log',str(result.exception))

    def test_rate_limit_honors_retry_after(self):
        error=HTTPError('url',429,'limit',{'Retry-After':'3'},None)
        with patch.object(sync,'urlopen',side_effect=error),patch.object(sync.time,'sleep') as sleep:
            with self.assertRaises(sync.SyncError):sync.request_json('/events','secret')
        self.assertEqual(sleep.call_count,2);sleep.assert_called_with(3)

    def test_timestamp_requires_zone(self):
        with self.assertRaises(sync.SyncError):sync.utc_date('2026-10-04T00:00:00')

if __name__=='__main__':unittest.main()
