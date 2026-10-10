import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('countries', Path(__file__).resolve().parents[1] / 'scripts/sync-fighter-countries.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class CountriesTest(unittest.TestCase):
    def test_country_is_bound_to_corner_and_athlete(self):
        html = '''<div class="c-listing-fight">
        <div class="c-listing-fight__corner-name--red"><a href="/athlete/example">Example</a></div>
        <div class="c-listing-fight__country--red"><img src="https://ufc.com/images/flags/PT.PNG"><div class="c-listing-fight__country-text">Portugal</div></div>
        <div class="c-listing-fight__country--blue"><img src="https://ufc.com/images/flags/BR.PNG"><div class="c-listing-fight__country-text">Brazil</div></div>
        </div>'''
        self.assertEqual(module.parse_countries(html), {'example': {'code': 'PT', 'country': 'Portugal'}})
    def test_birthplace_is_not_representation(self):
        self.assertEqual(module.parse_countries('<p>Place of Birth: Brazil</p>'), {})

if __name__ == '__main__':
    unittest.main()
