import importlib.util
from datetime import datetime,timezone
from pathlib import Path
import unittest
s=importlib.util.spec_from_file_location('retry',Path(__file__).resolve().parents[1]/'scripts/retry-morning-data.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class MorningRetryTests(unittest.TestCase):
    def test_summer_winter_and_duplicate(self):
        for month,hour in [(7,8),(12,9)]:
            now=datetime(2026,month,18,hour,tzinfo=timezone.utc)
            self.assertTrue(m.due(now,{}))
            self.assertFalse(m.due(now,{'date':now.date().isoformat()}))
            self.assertFalse(m.due(now.replace(hour=hour+1),{}))
    def test_only_recent_missing_data(self):
        now=datetime(2026,10,18,8,tzinfo=timezone.utc)
        e={'id':'card','date':'2026-10-18T00:00:00Z','status':'completed','bouts':[{'red':'A','blue':'B','winner':'A'}]}
        fighters=[{'id':n,'name':n} for n in ['A','B']]
        state={'records':{n:{'updatedAt':'2026-10-18T06:00:00Z'} for n in ['A','B']},'pendingProfileIds':[]}
        self.assertEqual(m.plan([e],state,fighters,now),([],set(),False))
        state['pendingProfileIds']=['B','unrelated']
        self.assertEqual(m.plan([e],state,fighters,now),([] ,{'B'},False))
        e['status']='scheduled'
        self.assertEqual(m.plan([e],state,fighters,now)[0],[e])
        for status in ('cancelled','postponed'):
            e['status']=status
            self.assertEqual(m.plan([e],state,fighters,now),([],set(),False))
        e['status']='scheduled'
        e['date']='2026-10-10T00:00:00Z'
        self.assertEqual(m.plan([e],state,fighters,now),([],set(),False))
if __name__=='__main__':unittest.main()
