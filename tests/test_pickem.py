import hashlib
import http.client
import json
import tempfile
import threading
import time
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch
from http.server import ThreadingHTTPServer
from server import Database, make_handler
from pickem import Competition, PickemError, key, score, closing_time

NOW = 1792756800  # Before UFC 333; tests never call external providers.

def iso(t):
    return datetime.fromtimestamp(t, timezone.utc).isoformat()


def fixture(id='event', at=NOW+86400):
    bouts=[{'red':f'R{i}','blue':f'B{i}','section':'main','winner':None} for i in range(12)]
    return {'id':id,'title':id,'date':iso(at),'type':'official','status':'scheduled','source':'official','bouts':bouts}


class PickemTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.root=Path(self.tmp.name)
        self.db=Database(self.root/'db.sqlite')
        self.feed=self.root/'events.json'; self.event=fixture(); self.write(self.event)
        self.game=Competition(self.db,self.feed)
        self.clock=patch('pickem.time.time',return_value=NOW); self.clock.start()
        with self.db.connect() as db:
            for user in ['one','two']:
                db.execute('INSERT INTO users (id,username,salt,password,updated_at) VALUES (?,?,?,?,?)',(user,user,b's',b'p',NOW))
    def tearDown(self):
        self.clock.stop(); self.tmp.cleanup()
    def write(self,*events):
        self.feed.write_text(json.dumps({'schemaVersion':1,'events':events}))
    def picks(self,event=None):
        return {key(b):b['red'] for b in (event or self.event)['bouts']}
    def save(self,user='one',revision=0,**extra):
        return self.game.save(user,{'eventId':self.event['id'],'revision':revision,'picks':self.picks(),**extra})
    def finish(self,correct=9):
        for i,b in enumerate(self.event['bouts']): b['winner']=b['red'] if i<correct else b['blue']
        self.event['status']='completed';self.write(self.event)

    def test_each_correct_pick_is_100_and_unpicked_is_zero(self):
        self.save();self.finish()
        state=self.game.state('one')['events'][0]
        self.assertEqual(state['result']['score'],900)
        self.assertEqual(self.game.leaderboard()['rows'][0]['score'],900)
        self.assertEqual(score(self.event,{key(self.event['bouts'][0]):'R0'})['score'],100)
        self.assertEqual(score(self.event,{})['score'],0)
        self.assertEqual(score(self.event,{key(self.event['bouts'][0]):'B0'})['score'],0)
        self.assertEqual(self.game.leaderboard()['rows'][0]['alias'],'one')
        self.assertNotIn('@private.test',json.dumps(self.game.leaderboard()))

    def test_void_draw_nc_and_correction_recalculate_idempotently(self):
        self.save();self.finish(10)
        self.event['bouts'][10]['outcome']='Draw';self.event['bouts'][10]['winner']=None
        self.event['bouts'][11]['outcome']='No contest';self.event['bouts'][11]['winner']=None
        self.write(self.event)
        self.assertEqual(self.game.leaderboard()['rows'][0]['score'],1000)
        self.assertEqual(self.game.leaderboard()['rows'][0]['score'],1000)
        self.event['bouts'][0]['winner']='B0';self.write(self.event)
        self.assertEqual(self.game.leaderboard()['rows'][0]['score'],900)

    def test_partial_results_do_not_enter_average(self):
        self.save();self.event['status']='completed';self.event['bouts'][0]['winner']='R0';self.write(self.event)
        r=self.game.leaderboard()['rows'][0]
        self.assertIsNone(r['score']);self.assertEqual(r['pending'],1)
        self.assertFalse(self.game.state('one')['events'][0]['result']['final'])

    def test_server_closure_and_never_reopen(self):
        self.save()
        with patch('pickem.time.time',return_value=closing_time(self.event)):
            with self.assertRaises(PickemError) as e:self.save(revision=1)
            self.assertEqual(e.exception.status,409)
            self.game.state('one')
        self.event['date']=iso(NOW+864000);self.write(self.event)
        with self.assertRaises(PickemError):self.save(revision=1)

    def test_reorder_replacement_and_late_bouts(self):
        self.save();self.event['bouts'].reverse();self.write(self.event)
        self.assertEqual(self.game.state('one')['events'][0]['picks'],self.picks())
        self.event['bouts'][0]['blue']='New';self.write(self.event)
        with self.assertRaises(PickemError): self.save(revision=1,picks={'["B11","R11"]':'R11'})
        self.save(revision=1)
        with patch('pickem.time.time',return_value=closing_time(self.event)+1):
            self.game.state('one')
            self.event['bouts'][0]['blue']='Late';self.write(self.event)
            result=self.game.state('one')['events'][0]
            self.assertTrue(result['event']['bouts'][0]['_void'])

    def test_concurrent_devices_and_account_isolation(self):
        self.save()
        with self.assertRaises(PickemError) as e:self.save()
        self.assertEqual(e.exception.status,409)
        self.assertFalse(self.game.state('two')['events'][0]['joined'])
        self.assertEqual(self.game.state('two')['events'][0]['picks'],{})
        self.save('two',alias='ONE')
        self.assertEqual(self.game.state('two')['alias'], 'two')
        with self.assertRaises(PickemError):self.save('two',picks={'bad':'intruder'})

    def test_account_name_overrides_legacy_alias_and_survives_restart(self):
        self.save(alias='invented')
        with self.db.connect() as db:
            db.execute('INSERT INTO pickem_profiles VALUES (?,?)', ('one','old-alias'))
        self.finish()
        game=Competition(Database(self.root/'db.sqlite'),self.feed)
        for scope in ['all','year',self.event['id']]:
            self.assertEqual(game.leaderboard(scope)['rows'][0]['alias'], 'one')
        self.assertEqual(game.state('one')['alias'], 'one')
        self.assertEqual(game.state('one')['events'][0]['result']['score'], 900)

    def test_legacy_email_is_not_public(self):
        self.save()
        with self.db.connect() as db:
            db.execute('UPDATE users SET username=? WHERE id=?', ('old@private.test','one'))
        self.assertNotIn('old@private.test', json.dumps(self.game.leaderboard()))
        self.assertEqual(self.game.state('one')['alias'], 'Usuario-one')

    def test_archive_survives_feed_rollover_and_restart(self):
        self.save();self.finish();self.game.state('one')
        self.write(fixture('next',NOW+864000))
        game=Competition(Database(self.root/'db.sqlite'),self.feed)
        self.assertEqual(game.leaderboard()['rows'][0]['score'],900)
        self.assertTrue(any(r['joined'] for r in game.state('one')['events']))

    def test_total_points_ties_and_cancelled_event(self):
        self.save();self.save('two');self.finish(6);self.game.state()
        self.event=fixture('second',NOW+172800);self.write(self.event)
        self.save();self.finish(12)
        board=self.game.leaderboard()['rows']
        self.assertEqual(board[0]['score'],1800);self.assertEqual(board[0]['played'],2)
        self.assertEqual(board[1]['score'],600)
        self.assertEqual(self.game.leaderboard('second')['rows'][0]['score'],1200)
        self.event['status']='cancelled';self.write(self.event)
        board=self.game.leaderboard()['rows']
        self.assertEqual([r['score'] for r in board],[600,600])
        self.assertEqual([r['position'] for r in board],[1,1])

    def test_only_next_event_is_available_and_server_rejects_later(self):
        later = fixture('later', NOW+172800)
        self.write(later, self.event)
        state = self.game.state('one')
        self.assertEqual(state['nextEventId'], 'event')
        self.assertEqual([i['event']['id'] for i in state['events']], ['event'])
        with self.assertRaises(PickemError) as error:
            self.game.save('one', {'eventId':'later','revision':0,'picks':self.picks(later)})
        self.assertEqual(error.exception.status, 409)
        self.save()
        # A closed current card does not let users skip ahead to later events.
        with patch('pickem.time.time', return_value=closing_time(self.event)+1):
            with self.assertRaises(PickemError):
                self.game.save('one', {'eventId':'later','revision':0,'picks':self.picks(later)})
        self.event['status'] = 'completed'
        self.write(self.event, later)
        state = self.game.state('one')
        self.assertEqual(state['nextEventId'], 'later')
        self.assertTrue(next(i for i in state['events'] if i['event']['id']=='event')['closed'])
        self.game.save('one', {'eventId':'later','revision':0,'picks':self.picks(later)})

    def test_cancelled_next_event_is_skipped(self):
        later = fixture('later', NOW+172800)
        self.event['status'] = 'cancelled'
        self.write(self.event, later)
        self.assertEqual(self.game.state('one')['nextEventId'], 'later')

    def test_official_closing_and_stale_schedule(self):
        e=self.event;e['bouts'][0]['section']='prelims'
        e['sectionSchedule']={'eventDate':e['date'],'source':e['source'],'starts':{'main':e['date'],'prelims':iso(NOW+86400-7200)}}
        self.assertEqual(closing_time(e),NOW+86400-7200)
        e['sectionSchedule']['eventDate']='stale'
        self.assertEqual(closing_time(e),NOW+86400-14400)

    def test_http_auth_csrf_origin_and_private_predictions(self):
        feed_dir=self.root/'assets/data';feed_dir.mkdir(parents=True)
        (feed_dir/'ufc-events.json').write_text(self.feed.read_text())
        with self.db.connect() as db:
            db.execute('INSERT INTO sessions VALUES (?,?,?,?)',(hashlib.sha256(b'test-token').hexdigest(),'one','csrf-token',time.time()+3600))
        with patch('server.ROOT',self.root):
            server=ThreadingHTTPServer(('127.0.0.1',0),make_handler(self.db,'http://127.0.0.1:1',set()))
            origin=f'http://127.0.0.1:{server.server_port}'
            server.RequestHandlerClass=make_handler(self.db,origin,set())
            server.RequestHandlerClass.log_message=lambda *args:None
            thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
            def request(method,path,body=None,cookie=True,csrf=True,other_origin=False):
                conn=http.client.HTTPConnection('127.0.0.1',server.server_port)
                headers={'Origin':'https://other.test' if other_origin else origin,'Content-Type':'application/json'}
                if cookie:headers['Cookie']='octagon_session=test-token'
                if csrf:headers['X-Octagon-CSRF']='csrf-token'
                conn.request(method,path,json.dumps(body) if body else None,headers)
                r=conn.getresponse();data=json.loads(r.read());status=r.status;conn.close();return status,data
            try:
                body={'eventId':'event','picks':self.picks(),'alias':'public-one','revision':0}
                self.assertEqual(request('PUT','/api/me/pickem',body,cookie=False)[0],401)
                self.assertEqual(request('PUT','/api/me/pickem',body,csrf=False)[0],403)
                self.assertEqual(request('PUT','/api/me/pickem',body,other_origin=True)[0],403)
                self.assertEqual(request('PUT','/api/me/pickem',body)[0],200)
                self.assertEqual(request('GET','/api/pickem/state',cookie=False)[1]['events'][0]['picks'],{})
                status,board=request('GET','/api/pickem/ranking',cookie=False)
                self.assertEqual(status,200);self.assertEqual(board['rows'][0]['alias'],'one')
                self.assertNotIn('picks',json.dumps(board));self.assertNotIn('@private.test',json.dumps(board))
            finally:server.shutdown();server.server_close();thread.join()

if __name__=='__main__':unittest.main()
