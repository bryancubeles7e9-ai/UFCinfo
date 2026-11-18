import importlib.util
from pathlib import Path
from datetime import datetime, timezone
import tempfile
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

class OfficialUpcomingTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 10, 30, tzinfo=timezone.utc)
        self.slug = 'ufc-fight-night-october-31-2026'
        self.url = m.UFC + '/event/' + self.slug
        self.page = (
            f'<link rel="canonical" href="{self.url}">'
            '<div class="c-hero__headline-suffix" data-timestamp="1793491200"></div>'
            '<div id="main-card">'
            '<div class="c-event-fight-card-broadcaster__time" data-timestamp="1793491200"></div>'
            '<div class="c-listing-fight">'
            '<span class="c-listing-fight__corner-name--red">Alpha</span>'
            '<span class="c-listing-fight__corner-name--blue">New Bravo</span>'
            '<span class="c-listing-fight__class-text">Lightweight Bout</span></div></div>'
            '<div id="prelims-card">'
            '<div class="c-event-fight-card-broadcaster__time" data-timestamp="1793480400"></div></div>'
        )
        self.calendar = (
            '<details id="events-list-upcoming"><div class="c-card-event--result__date">'
            f'<a href="/event/{self.slug}">UFC Fight Night</a></div></details>'
            '<details id="events-list-past"><div class="c-card-event--result__date">'
            '<a href="/event/ufc-300">Old UFC</a></div></details>'
        )

    def test_discovers_new_event_and_preserves_results(self):
        archived = {'id':'ufc-300', 'date':'2026-04-30T00:00:00+00:00', 'status':'completed',
                    'bouts':[{'red':'A', 'blue':'B', 'winner':'A'}]}
        feed = {'events':[archived]}
        pages = {m.UFC + '/events':self.calendar, self.url:self.page}
        self.assertTrue(m.synchronize(feed, pages.__getitem__, self.now))
        self.assertEqual(feed['events'][1], archived)
        new = feed['events'][0]
        self.assertEqual(new['id'], self.slug)
        self.assertEqual(new['bouts'][0]['blue'], 'New Bravo')
        self.assertEqual(new['date'], '2026-11-01T00:00:00+00:00')
        self.assertEqual(new['sectionSchedule']['starts']['prelims'], '2026-10-31T21:00:00+00:00')

    def test_repairs_first_block_date_and_applies_replacement(self):
        current = m.update_card(self.page, self.slug, None, self.now)
        current['date'] = current['sectionSchedule']['starts']['prelims']
        current['bouts'][0]['blue'] = 'Old Bravo'
        new = m.update_card(self.page, self.slug, current, self.now)
        self.assertEqual(new['date'], new['sectionSchedule']['starts']['main'])
        self.assertEqual([b['blue'] for b in new['bouts']], ['New Bravo'])
        self.assertIn(('replaced','UFC'), [(c['kind'],c['source']) for c in new['cardChanges']])
        self.assertEqual(new['cardChanges'][-1]['kind'], 'schedule-corrected')

    def test_unassigned_card_gets_official_block_times_without_guessing_bout_order(self):
        start = self.page.index('<div class="c-listing-fight">')
        end = self.page.index('<div id="prelims-card">')
        fight = self.page[start:end].removesuffix('</div>')
        page = self.page.split('<div id="main-card">')[0] + f'<div class="view-event-fights">{fight}</div>'
        page += ('<div class="c-listing-viewing-option">'
                 '<div class="c-listing-viewing-option__fight-card">Prelims</div>'
                 '<div class="c-listing-viewing-option__time" data-timestamp="1793480400"></div></div>')
        event = m.update_card(page, self.slug, None, self.now)
        self.assertIsNone(event['bouts'][0]['section'])
        self.assertEqual(event['sectionSchedule']['starts']['prelims'], '2026-10-31T21:00:00+00:00')

    def test_upcoming_sync_publishes_and_retries_official_posters(self):
        url = 'https://ufc.com/images/new-EVENT-ART.jpg'
        image = b'\xff\xd8\xfftest jpeg bytes'
        pages = {m.UFC + '/events': self.calendar, self.url: self.page +
                 f'<div class="c-hero__image"><img src="{url}" alt="UFC fight poster"></div>'}
        fetched_pages, downloads = [], []

        def get_page(url):
            fetched_pages.append(url)
            return pages[url]

        def get_image(url, limit):
            downloads.append(url)
            return image

        feed = {'events': []}
        with tempfile.TemporaryDirectory() as directory:
            images = Path(directory)
            m.synchronize(feed, get_page, self.now, image_dir=images, fetch_image=get_image)
            self.assertEqual(fetched_pages, [m.UFC + '/events', self.url])
            self.assertEqual(downloads, [url])
            event = feed['events'][0]
            self.assertEqual(event['poster'], f'assets/images/events/{self.slug}.jpg')
            self.assertEqual(event['posterAlt'], 'UFC fight poster')
            m.synchronize(feed, get_page, self.now, image_dir=images, fetch_image=get_image)
            self.assertEqual(downloads, [url])
            new_url = url.replace('new-', 'final-')
            pages[self.url] = pages[self.url].replace(url, new_url)
            self.assertTrue(m.synchronize(feed, get_page, self.now, image_dir=images,
                                          fetch_image=lambda *_: b'<html>Unavailable</html>'))
            self.assertEqual(feed['events'][0]['posterSource'], url)
            self.assertEqual((images / f'{self.slug}.jpg').read_bytes(), image)
            m.synchronize(feed, get_page, self.now, image_dir=images,
                          fetch_image=lambda *_: image + b' replacement')
            self.assertEqual(feed['events'][0]['posterSource'], new_url)
            self.assertEqual((images / f'{self.slug}.jpg').read_bytes(), image + b' replacement')

    def test_bad_official_page_keeps_saved_data_and_reports_failure(self):
        old = m.update_card(self.page, self.slug, None, self.now)
        feed = {'events':[old], 'synchronizedAt':'2026-10-29T12:00:00+00:00'}
        pages = {m.UFC + '/events':self.calendar, self.url:self.page.replace(self.url, m.UFC + '/event/ufc-333')}
        self.assertFalse(m.synchronize(feed, pages.__getitem__, self.now))
        self.assertEqual(feed['events'], [old])
        self.assertEqual(feed['synchronizedAt'], '2026-10-29T12:00:00+00:00')
        self.assertEqual(feed['scheduleVerification']['failedIds'], [self.slug])


if __name__=='__main__':unittest.main()
