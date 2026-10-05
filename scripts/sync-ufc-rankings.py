"""Import official UFC media rankings, preserving the last valid feed on failure."""
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
import tempfile
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://www.ufc.com/rankings'
CATEGORIES = {
    "Men's Pound-for-Pound": 'p4p-men',
    "Women's Pound-for-Pound": 'p4p-women',
    'Flyweight': 'flyweight',
    'Bantamweight': 'bantamweight',
    'Featherweight': 'featherweight',
    'Lightweight': 'lightweight',
    'Welterweight': 'welterweight',
    'Middleweight': 'middleweight',
    'Light Heavyweight': 'light-heavyweight',
    'Heavyweight': 'heavyweight',
    "Women's Strawweight": 'strawweight-women',
    "Women's Flyweight": 'flyweight-women',
    "Women's Bantamweight": 'bantamweight-women',
}

class Node:
    def __init__(self, tag='', attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []
    def text(self):
        return ' '.join(''.join(c.text() if isinstance(c, Node) else c for c in self.children).split())
    def find(self, predicate):
        found = [self] if predicate(self) else []
        for c in self.children:
            if isinstance(c, Node):
                found.extend(c.find(predicate))
        return found
    def has(self, cls):
        return cls in self.attrs.get('class', '').split()

class Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]
    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in ('area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'):
            self.stack.append(node)
    def handle_endtag(self, tag):
        for i in range(len(self.stack)-1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                break
    def handle_data(self, data):
        self.stack[-1].children.append(data)


def parse_rankings(html, now):
    parser = Parser()
    parser.feed(html)
    views = parser.root.find(lambda n: n.has('view-athlete-rankings') and n.has('view-display-id-block_1'))
    if len(views) != 1:
        raise ValueError('Official All Rankings section missing or ambiguous')
    categories = []
    for group in views[0].find(lambda n: n.has('view-grouping')):
        headers = group.find(lambda n: n.has('view-grouping-header'))
        label = headers[0].text().replace(' Top Rank', '') if headers else ''
        if label not in CATEGORIES:
            continue
        leaders = group.find(lambda n: n.tag == 'h5')
        champion = leaders[0].text() if leaders else None
        rows = []
        for row in group.find(lambda n: n.tag == 'tr'):
            ranks = row.find(lambda n: n.has('views-field-weight-class-rank'))
            names = row.find(lambda n: n.has('views-field-title'))
            if not ranks or not names:
                raise ValueError('Incomplete ranking row')
            value = ranks[0].text()
            if not re.fullmatch(r'\d+', value):
                raise ValueError('Invalid ranking position')
            rank = int(value)
            if 1 <= rank <= 10:
                rows.append((rank, names[0].text()))
        if len(rows) < 10 or max((r for r, _ in rows), default=0) != 10 or any(r > i + 1 for i, (r, _) in enumerate(rows)) or len(rows) > 20 or any(not name for _, name in rows) or len({name for _, name in rows}) != len(rows):
            raise ValueError('Incomplete or duplicate top 10')
        if rows != sorted(rows, key=lambda row: row[0]):
            raise ValueError('Ranking positions out of order')
        p4p = CATEGORIES[label].startswith('p4p-')
        if not p4p and not champion:
            raise ValueError('Champion missing')
        categories.append({'id': CATEGORIES[label], 'champion': None if p4p else champion, 'names': [n for _, n in rows], 'ranks': [r for r, _ in rows]})
    if len(categories) != len(CATEGORIES) or {c['id'] for c in categories} != set(CATEGORIES.values()):
        raise ValueError('Required categories missing or duplicated')
    dates = parser.root.find(lambda n: n.attrs.get('data-rankings-footer') == 'media')
    published = dates[0].text().replace('Last updated:', '').strip() if dates else None
    return {'schemaVersion': 1, 'source': SOURCE, 'synchronizedAt': now.isoformat(), 'published': published, 'categories': categories}


def main():
    try:
        request = Request(SOURCE, headers={'User-Agent': 'Mozilla/5.0 (compatible; Octagon/1.0)', 'Accept': 'text/html'})
        with urlopen(request, timeout=30) as response:
            html = response.read(3_000_001)
        if len(html) > 3_000_000:
            raise ValueError('Response too large')
        feed = parse_rankings(html.decode('utf-8'), datetime.now(timezone.utc))
        target = ROOT / 'assets/data/ufc-rankings.json'
        target.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=target.parent, delete=False) as tmp:
            json.dump(feed, tmp, ensure_ascii=False, indent=2)
            tmp.write('\n')
        Path(tmp.name).replace(target)
        print(f'Updated {len(feed["categories"])} official UFC ranking categories')
    except Exception as error:
        print(f'Rankings unchanged: {error}', file=sys.stderr)
        return 1
    return 0

if __name__ == '__main__':
    sys.exit(main())
