"""Past seasons join the permanent fight history only when they look complete."""
import importlib.util
from datetime import datetime, timezone
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('history_year', Path(__file__).resolve().parents[1] / 'scripts/import-history-year.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def fight(red, blue, outcome='red'):
    corner = lambda side: (f'<div class="c-listing-fight__corner--{side}">'
                           + ('<div class="c-listing-fight__outcome--win">Win</div>' if outcome == side else '') + '</div>')
    extra = '<div class="c-listing-fight__outcome--draw">Draw</div>' if outcome == 'draw' else '<div class="c-listing-fight__outcome--nc">NC</div>' if outcome == 'nc' else ''
    return (f'<div class="c-listing-fight">{corner("red")}{corner("blue")}{extra}'
            f'<div class="c-listing-fight__corner-name--red">{red}</div><div class="c-listing-fight__corner-name--blue">{blue}</div>'
            f'<div class="method">KO/TKO</div><div class="round">2</div><div class="time">1:00</div></div>')


def page(when, main, prelims=()):
    stamp = int(datetime(*when, tzinfo=timezone.utc).timestamp())
    return (f'<div class="c-hero__headline-suffix" data-timestamp="{stamp}"></div>'
            f'<div id="main-card">{"".join(main)}</div><div id="prelims-card">{"".join(prelims)}</div>')


class HistoryYearTests(unittest.TestCase):
    def test_parses_results_of_that_year_only(self):
        event = m.parse_event(page((2025, 3, 8, 23), [fight('Ana Uno', 'Bea Dos'), fight('Cris Tres', 'Dani Cuatro', 'blue')],
                                   [fight('Eva Cinco', 'Fer Seis', 'draw'), fight('Gil Siete', 'Hugo Ocho', 'nc'), fight('Ines', 'Juan', None)]),
                              'ufc-fight-night-march-08-2025', 2025)
        self.assertEqual([b['result'] for b in event['bouts']], ['red', 'blue', 'draw', 'nc'])
        self.assertEqual(event['incomplete'], 1)
        self.assertEqual(event['bouts'][0]['title'], 'UFC Fight Night')
        self.assertIsNone(m.parse_event(page((2024, 12, 14, 23), [fight('A', 'B')]), 'ufc-310', 2025))
        self.assertEqual(m.parse_event(page((2025, 1, 18, 23), [fight('A', 'B')]), 'ufc-311', 2025)['bouts'][0]['title'], 'UFC 311')

    def test_whole_year_and_season_check(self):
        cards = {f'ufc-fight-night-{m.MONTHS[i % 12]}-{(i % 27) + 1:02d}-2025': page((2025, i % 12 + 1, (i % 27) + 1, 23),
                 [fight(f'R{i}-{j}', f'B{i}-{j}') for j in range(12)]) for i in range(35)}
        events, missing = m.import_year(2025, [], read=cards.get, workers=2)
        self.assertEqual(len(events), 35)
        self.assertEqual(missing, 365 - 35)
        self.assertEqual(m.check_season(events, 2025), [])
        self.assertTrue(m.check_season(events[:10], 2025))   # Too few cards: nothing is written.

    def test_merge_keeps_saved_results(self):
        saved = {'schemaVersion': 1, 'bouts': [{'date': '2025-03-08T23:00:00+00:00', 'event': 'e', 'title': 'UFC 1', 'red': 'A', 'blue': 'B', 'result': 'nc'}]}
        events = [{'bouts': [{'date': '2025-03-08T23:00:00+00:00', 'event': 'e', 'title': 'UFC 1', 'red': 'A', 'blue': 'B', 'result': 'red'},
                             {'date': '2025-03-08T23:00:00+00:00', 'event': 'e', 'title': 'UFC 1', 'red': 'C', 'blue': 'D', 'result': 'blue'}]}]
        merged, added = m.merge(saved, events)
        self.assertEqual(added, 1)
        self.assertEqual(next(b for b in merged['bouts'] if b['red'] == 'A')['result'], 'nc')


if __name__ == '__main__':
    unittest.main()
