import importlib.util
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('rumor_confirmations',ROOT/'scripts/sync-rumor-confirmations.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class OfficialCardTests(unittest.TestCase):
    def fight(self,red,blue):
        return f'<div class="c-listing-fight"><div class="c-listing-fight__corner-name--red">{red}</div><div class="c-listing-fight__corner-name--blue">{blue}</div></div>'
    def test_both_fighters_must_share_a_bout(self):
        html=self.fight('Ilia Topuria','Max Holloway')+self.fight('Charles Oliveira','Diego Lopes')+'<span class="c-event-fight-card-broadcaster__time" data-timestamp="1797127200"></span>'
        pairs,date=module.parse_card(html)
        self.assertIn(tuple(sorted(['iliatopuria','maxholloway'])),pairs)
        self.assertNotIn(tuple(sorted(['iliatopuria','diegolopes'])),pairs)
        self.assertEqual(date.year,2026)
    def test_unrelated_page_text_is_not_a_confirmation(self):
        with self.assertRaises(ValueError):
            module.parse_card('<h1>Ilia Topuria Max Holloway</h1>')
    def test_missing_date_is_not_a_confirmation(self):
        with self.assertRaises(ValueError):
            module.parse_card(self.fight('Ilia Topuria','Max Holloway'))
    def test_ambiguous_date_is_not_a_confirmation(self):
        with self.assertRaises(ValueError):
            module.parse_card(self.fight('Ilia Topuria','Max Holloway')+'<span class="c-event-fight-card-broadcaster__time" data-timestamp="1797127200"></span><span class="c-event-fight-card-broadcaster__time" data-timestamp="1797213601"></span>')
    def test_spelling_normalization(self):
        self.assertEqual(module.normalize('Jiří Procházka'),module.normalize('Jiri Prochazka'))


    def test_prelims_and_main_card_times_are_not_ambiguous(self):
        html=self.fight('Ilia Topuria','Max Holloway')+'<span class="c-event-fight-card-broadcaster__time" data-timestamp="1797112800"></span><span class="c-event-fight-card-broadcaster__time" data-timestamp="1797127200"></span>'
        pairs,date=module.parse_card(html)
        self.assertEqual(int(date.timestamp()),1797127200)
    def test_empty_broadcast_time_is_ignored(self):
        html=self.fight('Ilia Topuria','Max Holloway')+'<span class="c-event-fight-card-broadcaster__time" data-timestamp=""></span><span class="c-event-fight-card-broadcaster__time" data-timestamp="1797127200"></span>'
        pairs,date=module.parse_card(html)
        self.assertEqual(int(date.timestamp()),1797127200)
    def test_official_event_schema_supplies_date_when_times_are_empty(self):
        html=self.fight('Ilia Topuria','Max Holloway')+'<script type="application/ld+json">{"@type":"SportsEvent","startDate":"2026-12-13T02:00:00Z"}</script>'
        pairs,date=module.parse_card(html)
        self.assertEqual(date.day,13)

    def test_official_bout_with_tba_time_can_use_catalog_date(self):
        html=self.fight('Ilia Topuria','Max Holloway')
        pairs,date=module.parse_card(html,module.as_date('2026-12-13T02:00:00Z'))
        self.assertIn(tuple(sorted(['iliatopuria','maxholloway'])),pairs)
        self.assertEqual(date.day,13)
    def test_catalog_date_never_substitutes_for_official_bout(self):
        with self.assertRaises(ValueError):
            module.parse_card('<h1>Ilia Topuria Max Holloway</h1>',module.as_date('2026-12-13T02:00:00Z'))

class AutomaticGroupTests(unittest.TestCase):
    def event(self, identity='ufc-fight-night-november-21-2026'):
        return {'id':identity,'type':'official','source':f'https://www.ufc.com/event/{identity}','date':'2026-11-21T18:00:00Z'}
    def group(self, **overrides):
        return {'id':'test','fighterNames':['Jiří Procházka','Navajo Stirling'],'publishedAt':'2026-10-07T08:00:00Z','eventDateHint':None,**overrides}
    def html(self):
        return OfficialCardTests().fight('Jiri Prochazka','Navajo Stirling')+'<span class="c-event-fight-card-broadcaster__time" data-timestamp="1795284000"></span>'
    def verify(self, groups, fetch=None, events=None):
        feed={'rumors':[]}
        grouped={'groups':groups,'updatedAt':None}
        result=module.verify_feeds(feed,grouped,events or [self.event()],fetch or (lambda url:self.html()),'2026-10-07T16:00:00Z')
        return result,grouped
    def test_fight_night_group_is_removed_after_official_page_match(self):
        result,grouped=self.verify([self.group()])
        self.assertEqual(result['removedGroups'],1)
        self.assertEqual(grouped['groups'],[])
    def test_calendar_alone_is_not_confirmation(self):
        result,grouped=self.verify([self.group()],fetch=lambda url: '<h1>Jiri Prochazka vs Navajo Stirling</h1>')
        self.assertEqual(result['removedGroups'],0)
        self.assertEqual(len(grouped['groups']),1)
        self.assertEqual(result['unavailableCards'],1)
    def test_page_failure_retains_group(self):
        def unavailable(url):raise OSError('offline')
        result,grouped=self.verify([self.group()],fetch=unavailable)
        self.assertEqual(len(grouped['groups']),1)
    def test_later_rematch_is_not_removed(self):
        result,grouped=self.verify([self.group(publishedAt='2026-12-01T08:00:00Z')])
        self.assertEqual(result['checkedCards'],0)
        self.assertEqual(len(grouped['groups']),1)
    def test_other_event_date_retains_group(self):
        result,grouped=self.verify([self.group(eventDateHint='2026-12-21')])
        self.assertEqual(len(grouped['groups']),1)
    def test_local_date_can_differ_by_one_day(self):
        result,grouped=self.verify([self.group(eventDateHint='2026-11-22')])
        self.assertEqual(result['removedGroups'],1)
    def test_both_names_in_different_bouts_is_not_confirmation(self):
        html=OfficialCardTests().fight('Jiri Prochazka','Other Fighter')+OfficialCardTests().fight('Navajo Stirling','Another Fighter')+'<span class="c-event-fight-card-broadcaster__time" data-timestamp="1795284000"></span>'
        result,grouped=self.verify([self.group()],fetch=lambda url:html)
        self.assertEqual(len(grouped['groups']),1)
    def test_fetch_once_for_shared_event(self):
        urls=[]
        def fetch(url):urls.append(url);return self.html()
        self.verify([self.group(),self.group(id='second')],fetch=fetch)
        self.assertEqual(len(urls),1)
    def test_external_source_is_never_requested(self):
        event=self.event();event['source']='https://example.com/event'
        result,grouped=self.verify([self.group()],fetch=lambda url:self.fail('Must not fetch'),events=[event])
        self.assertEqual(result['checkedCards'],0)
        self.assertEqual(len(grouped['groups']),1)
    def test_legacy_reviewed_rumor_still_gets_confirmation(self):
        feed={'rumors':[{'id':'old','fighters':['jiri','navajo'],'publishedAt':'2026-10-07T08:00:00Z','official':None}]}
        module.verify_feeds(feed,{'groups':[]},[self.event()],lambda url:self.html(),'2026-10-07T16:00:00Z',{'jiri':'Jiří Procházka','navajo':'Navajo Stirling'})
        self.assertEqual(feed['rumors'][0]['official']['eventId'],self.event()['id'])

if __name__=='__main__':unittest.main()

