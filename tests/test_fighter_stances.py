import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('stances', Path(__file__).resolve().parents[1] / 'scripts/import-fighter-stances.py')
stances = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stances)

class Matching(unittest.TestCase):
    def test_no_guessing(self):
        fighter = {'name': 'Jean Silva'}
        self.assertIsNone(stances.match_stance(fighter, [{'name':'Jean Silva','stance':'Orthodox'}, {'name':'Jean Silva','stance':'Southpaw'}]))
        self.assertIsNone(stances.match_stance(fighter, [{'name':'Jean Silva','stance':'NA'}]))
        self.assertIsNone(stances.match_stance(fighter, [{'name':'Jean da Silva','stance':'Orthodox'}]))

    def test_names_and_aliases(self):
        self.assertEqual(stances.match_stance({'name':'Jan Błachowicz'}, [{'name':'Jan Blachowicz','stance':'Orthodox'}]), 'Orthodox')
        self.assertEqual(stances.match_stance({'name':'Test','aliases':['Other Name']}, [{'name':'Other Name','stance':'Switch'}]), 'Switch')

if __name__ == '__main__':
    unittest.main()
