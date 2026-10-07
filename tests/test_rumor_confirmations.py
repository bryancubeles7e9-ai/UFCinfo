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
            module.parse_card(self.fight('Ilia Topuria','Max Holloway')+'<span class="c-event-fight-card-broadcaster__time" data-timestamp="1797127200"></span><span class="c-event-fight-card-broadcaster__time" data-timestamp="1797127201"></span>')
    def test_spelling_normalization(self):
        self.assertEqual(module.normalize('Jiří Procházka'),module.normalize('Jiri Prochazka'))

if __name__=='__main__':unittest.main()
