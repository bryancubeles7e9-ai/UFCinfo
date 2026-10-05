import importlib.util
from datetime import datetime, timezone
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('rankings_sync', Path(__file__).resolve().parents[1] / 'scripts/sync-ufc-rankings.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def fixture():
    groups = []
    for label in module.CATEGORIES:
        rows = ''.join(f'<tr><td class="views-field-weight-class-rank">{rank}</td><td class="views-field-title"><a>Athlete {rank}</a></td></tr>' for rank in range(1, 16))
        groups.append(f'<div class="view-grouping"><div class="view-grouping-header">{label}</div><table><caption><h5>Champion &amp; Name</h5></caption><tbody>{rows}</tbody></table></div>')
    return '<div class="view-athlete-rankings view-display-id-block_1">' + ''.join(groups) + '</div><div class="view-athlete-rankings view-display-id-block_2">META</div><p data-rankings-footer="media">Last updated: Tuesday, Sep. 29</p>'


class RankingsTests(unittest.TestCase):
    def parse(self, html):
        return module.parse_rankings(html, datetime(2026, 10, 5, tzinfo=timezone.utc))
    def test_official_section_champion_and_top_ten(self):
        feed = self.parse(fixture())
        self.assertEqual(len(feed['categories']), 13)
        self.assertEqual(feed['published'], 'Tuesday, Sep. 29')
        for c in feed['categories']:
            self.assertEqual(c['ranks'], list(range(1, 11)))
            self.assertEqual(c['champion'], None if c['id'].startswith('p4p-') else 'Champion & Name')
    def test_partial_or_meta_only_rejected(self):
        for html in (fixture().replace('>10</td>', '>11</td>'), fixture().replace('view-display-id-block_1', 'view-display-id-block_2'), fixture().replace('Lightweight', 'Unknown')):
            with self.assertRaises(ValueError):
                self.parse(html)
    def test_competition_tie_skips_next_position(self):
        feed = self.parse(fixture().replace('>4</td>', '>3</td>'))
        self.assertEqual(feed['categories'][-1]['ranks'][:5], [1, 2, 3, 3, 5])
    def test_missing_new_division_rejected(self):
        with self.assertRaises(ValueError):
            self.parse(fixture().replace("Women's Bantamweight", 'Unknown'))
    def test_tied_positions_preserved(self):
        html = fixture().replace('<tbody>', '<tbody><tr><td class="views-field-weight-class-rank">1</td><td class="views-field-title">Tied athlete</td></tr>')
        feed = self.parse(html)
        self.assertEqual(feed['categories'][0]['ranks'][:3], [1, 1, 2])

if __name__ == '__main__':
    unittest.main()
