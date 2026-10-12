import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
import tempfile
import io
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

    def test_archive_survives_url_changes(self):
        data = b'\x89PNG\r\n\x1a\n' + b'x' * 150
        with tempfile.TemporaryDirectory() as folder, patch.object(photos, 'ROOT', Path(folder)):
            with patch.object(photos, 'urlopen', return_value=io.BytesIO(data)):
                first = photos.verify_image('https://www.ufc.com/images/a.png')
            with patch.object(photos, 'urlopen', return_value=io.BytesIO(data)):
                second = photos.verify_image('https://www.ufc.com/images/b.png')
            self.assertEqual(first, second)
            self.assertEqual((Path(folder) / first).read_bytes(), data)

    def test_bmf_never_overwrites_regular(self):
        fighter={'id':'max','name':'Max Holloway','source':'https://www.ufc.com/athlete/max-holloway',
                 'championships':[{'name':'BMF','type':'special','status':'current'}]}
        state={'photos':{'max':{'regular':{'url':'neutral'}}}}
        photos.sync([fighter],{'categories':[]},state,consult=lambda f:'https://www.ufc.com/images/BMF_BELT.png',verify=lambda u:None)
        self.assertIn('bmf',state['photos']['max'])
        self.assertEqual(state['photos']['max']['regular']['url'],'neutral')
        fighter['championships'][0]['status']='former'
        photos.sync([fighter],{'categories':[]},state,consult=lambda f:'https://www.ufc.com/images/BMF_BELT.png',verify=lambda u:None)
        self.assertTrue(state['photos']['max']['pendingNeutral'])
        self.assertEqual(state['photos']['max']['regular']['url'],'neutral')

if __name__ == '__main__': unittest.main()
