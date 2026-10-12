import importlib.util
from pathlib import Path
import unittest
spec = importlib.util.spec_from_file_location('photos', Path(__file__).resolve().parents[1] / 'scripts/sync-fighter-photos.py')
photos = importlib.util.module_from_spec(spec)
spec.loader.exec_module(photos)

class PhotoTests(unittest.TestCase):
    def test_identity_and_image_source(self):
        fighter = {'id':'silva', 'name':'Natalia Silva', 'source':'https://www.ufc.com/athlete/natalia-silva'}
        html = '<h1 class="hero-profile__name">Natalia Silva</h1><p class="hero-profile__division-body">21-5-1 (W-L-D)</p><img class="hero-profile__image" src="https://ufc.com/images/natalia.png?x=1&amp;y=2">'
        self.assertEqual(photos.photo_url(html, fighter), 'https://www.ufc.com/images/natalia.png?x=1&y=2')
        with self.assertRaises(ValueError): photos.photo_url(html.replace('Natalia Silva','Other Athlete'), fighter)
        with self.assertRaises(ValueError): photos.photo_url(html.replace('ufc.com/images','evil.test/images'), fighter)
    def test_former_belt_rejected_and_neutral_fallback(self):
        url = 'https://www.ufc.com/images/ATHLETE_BELT.png'
        self.assertIsNone(photos.choose_photo(url, {'id':'unknown'}, False))
        self.assertEqual(photos.choose_photo(url, {'id':'shevchenko'}, False)['source'], 'ESPN')
    def test_previous_variants_and_failure_preserved(self):
        fighter = {'id':'silva','name':'Natalia Silva','source':'https://www.ufc.com/athlete/natalia-silva'}
        rankings={'categories':[{'champion':'Natalia Silva'}]}
        state={'photos':{'silva':{'regular':{'url':'saved-neutral'}}}}
        photos.sync([fighter],rankings,state,consult=lambda f:'https://www.ufc.com/images/ATHLETE_BELT.png',verify=lambda u:None)
        self.assertEqual(state['photos']['silva']['regular']['url'],'saved-neutral')
        def fail(f): raise ValueError('offline')
        photos.sync([fighter],rankings,state,consult=fail,verify=lambda u:None)
        self.assertIn('champion',state['photos']['silva'])
        self.assertEqual(state['failedIds'],['silva'])

if __name__ == '__main__': unittest.main()
