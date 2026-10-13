import importlib.util
from pathlib import Path
import unittest
s=importlib.util.spec_from_file_location('season',Path(__file__).resolve().parents[1]/'scripts/import-season-fighters.py')
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class SeasonTests(unittest.TestCase):
    athlete={'id':'ufc-test','name':'Test Fighter','aliases':[],'source':'https://www.ufc.com/athlete/test'}
    page='<h1 class="hero-profile__name">Test Fighter</h1><p class="hero-profile__division-body">12-3-0 (W-L-D)</p>'
    def test_verified_identity_and_missing_fields(self):
        f=m.verified_profile(self.page,self.athlete,'2026-10-13')
        self.assertEqual(f['record'],'12-3-0')
        self.assertIsNone(f['info']['strikesLanded'])
        self.assertNotIn('stance',f)
        self.assertEqual(f['image'],'assets/images/fighter-placeholder.svg')
    def test_wrong_identity(self):
        with self.assertRaises(ValueError):m.verified_profile(self.page.replace('Test Fighter','Someone Else'),self.athlete,'2026-10-13')
if __name__=='__main__':unittest.main()
