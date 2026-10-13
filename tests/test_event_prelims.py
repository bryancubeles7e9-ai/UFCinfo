import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('prelims', Path(__file__).resolve().parents[1] / 'scripts/import-event-prelims.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def fight(red, blue):
    return f'<div class="c-listing-fight"><div class="c-listing-fight__corner-name--red">{red}</div><div class="c-listing-fight__corner-name--blue">{blue}</div><div class="c-listing-fight__corner--blue"><span class="c-listing-fight__outcome--win">Win</span></div><span class="method">Decision</span></div>'


class PreliminaryTests(unittest.TestCase):
    event = {'bouts': [{'red': 'A', 'blue': 'B'}]}

    def test_sections_results_and_order(self):
        text = '<div id="main-card">' + fight('A', 'B') + '</div><div id="prelims-card">' + fight('C', 'D') + '</div><div id="early-prelims">' + fight('E', 'F') + '</div>'
        bouts = module.preliminary_bouts(text, self.event)
        self.assertEqual([b['section'] for b in bouts], ['prelims', 'early-prelims'])
        self.assertEqual([b['winner'] for b in bouts], ['D', 'F'])
        self.assertEqual(self.event['bouts'], [{'red': 'A', 'blue': 'B'}])

    def test_wrong_page_and_duplicate_rejected(self):
        for text in ['<div id="main-card">' + fight('X', 'Y') + '</div>', '<div id="main-card">' + fight('A', 'B') + '</div><div id="prelims-card">' + fight('A', 'B') + '</div>']:
            with self.assertRaises(ValueError):
                module.preliminary_bouts(text, self.event)


if __name__ == '__main__':
    unittest.main()
