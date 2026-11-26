"""Profiles imported from UFC.com are cleaned before they reach the website."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('directory', Path(__file__).resolve().parents[1] / 'scripts/import-fighter-directory.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class ProfileTidyTests(unittest.TestCase):
    def test_text_spacing_and_entities(self):
        p = m.tidy_profile({'birthplace': 'Nova Bila, Bosnia &amp; Herzegovina', 'nickname': 'The Phenom ', 'info': {}})
        self.assertEqual(p['birthplace'], 'Nova Bila, Bosnia & Herzegovina')
        self.assertEqual(p['nickname'], 'The Phenom')
        self.assertEqual(m.tidy_text('Manaus , Brazil'), 'Manaus, Brazil')

    def test_impossible_measurements_are_left_empty(self):
        p = m.tidy_profile({'heightCm': 394, 'reachCm': 0, 'info': {'weightKg': 33.1, 'legReachCm': 99}})
        self.assertIsNone(p['heightCm'])
        self.assertIsNone(p['reachCm'])
        self.assertIsNone(p['info']['weightKg'])
        self.assertEqual(p['info']['legReachCm'], 99)
        kept = m.tidy_profile({'heightCm': 180, 'reachCm': 185, 'info': {'weightKg': 70.3}})
        self.assertEqual((kept['heightCm'], kept['reachCm'], kept['info']['weightKg']), (180, 185, 70.3))

    def test_division_from_official_bouts(self):
        self.assertEqual(m.bout_division('Lightweight Bout'), 'Peso ligero')
        self.assertEqual(m.bout_division("Women's Strawweight Bout"), 'Peso paja femenino')
        self.assertEqual(m.bout_division('Heavyweight Interim Title Bout'), 'Peso pesado')
        self.assertEqual(m.bout_division('UFC Bantamweight Title Bout'), 'Peso gallo')
        self.assertEqual(m.bout_division('Catchweight Bout'), None)
        events = [{'date': '2026-01-01', 'bouts': [{'red': 'Test Fighter', 'blue': 'X', 'division': 'Featherweight Bout'}]},
                  {'date': '2026-06-01', 'bouts': [{'red': 'Y', 'blue': 'Test Fighter', 'division': 'Lightweight Bout'}]}]
        self.assertEqual(m.division_from_events('Test Fighter', events), 'Peso ligero')
        self.assertIsNone(m.division_from_events('Nobody', events))


if __name__ == '__main__':
    unittest.main()
