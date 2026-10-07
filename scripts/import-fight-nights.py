"""Import all 2026 Fight Night pages downloaded from the official UFC calendar.
Usage: python3 scripts/import-fight-nights.py /tmp/ufc-fn-pages
Preserves numbered events and rejects incomplete completed main cards.
"""
from html.parser import HTMLParser
from pathlib import Path
from datetime import datetime, timezone
import json, sys
class Node:
    def __init__(self, tag='', attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []
    def text(self):
        return ' '.join(' '.join(c.text() if isinstance(c, Node) else c for c in self.children).split())
    def find(self, cls=None, id=None):
        result=[]
        for c in self.children:
            if isinstance(c, Node):
                if (cls and cls in c.attrs.get('class','').split()) or (id and c.attrs.get('id')==id): result.append(c)
                result.extend(c.find(cls,id))
        return result
class Parser(HTMLParser):
    def __init__(self):
        super().__init__(); self.root=Node(); self.stack=[self.root]
    def handle_starttag(self,t,a):
        n=Node(t,a); self.stack[-1].children.append(n)
        if t not in ['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']: self.stack.append(n)
    def handle_endtag(self,t):
        for i in range(len(self.stack)-1,0,-1):
            if self.stack[i].tag==t: self.stack=self.stack[:i]; break
    def handle_data(self,d): self.stack[-1].children.append(d)
def first(n,c):
    a=n.find(c); return a[0].text() if a else ''

def main():
    root=Path(__file__).resolve().parents[1]
    target=root/'assets/data/ufc-events.json'
    feed=json.loads(target.read_text())
    now=datetime.now(timezone.utc)
    imported=[]
    for page in sorted(Path(sys.argv[1]).glob('ufc-fight-night-*.html')):
        parser=Parser(); parser.feed(page.read_text()); tree=parser.root
        cards=tree.find(id='main-card')
        card=cards[0] if cards else tree
        times=card.find('c-event-fight-card-broadcaster__time') + tree.find('c-hero__headline-suffix')
        stamp=next((n.attrs.get('data-timestamp') for n in times if n.attrs.get('data-timestamp')),None)
        if not stamp: raise ValueError(f'Missing timestamp: {page.stem}')
        date=datetime.fromtimestamp(int(stamp),timezone.utc)
        if date.year != feed['year']: raise ValueError('Wrong calendar year')
        bouts=[]
        for fight in card.find('c-listing-fight'):
            red=first(fight,'c-listing-fight__corner-name--red'); blue=first(fight,'c-listing-fight__corner-name--blue')
            if not red or not blue: continue
            corners=[fight.find('c-listing-fight__corner--'+c) for c in ('red','blue')]
            winner=red if corners[0] and corners[0][0].find('c-listing-fight__outcome--win') else blue if corners[1] and corners[1][0].find('c-listing-fight__outcome--win') else None
            outcome='Empate' if fight.find('c-listing-fight__outcome--draw') else 'Sin resultado (No contest)' if fight.find('c-listing-fight__outcome--nc') else None
            bouts.append(dict(red=red,blue=blue,division=first(fight,'c-listing-fight__class-text'),winner=winner,outcome=outcome,method=first(fight,'method'),round=first(fight,'round'),time=first(fight,'time')))
        completed=date < now
        if completed and not bouts: raise ValueError(f'Empty completed card: {page.stem}')
        imported.append(dict(id=page.stem,number=None,eventKind='fight-night',title='UFC Fight Night',subtitle=first(tree,'c-hero__headline') or (f"{bouts[0]['red']} vs {bouts[0]['blue']}" if bouts else 'Cartelera pendiente de anuncio'),date=date.isoformat(),location=first(tree,'field--name-venue') or 'Recinto no indicado',status='completed' if completed else 'announced',type='official',source=f'https://www.ufc.com/event/{page.stem}',checkedAt=now.date().isoformat(),bouts=bouts,poster=None,posterAlt=None))
    if not imported: raise ValueError('No Fight Night pages supplied')
    previous={e['id']:e for e in feed['events']}
    for event in imported:
        prior=previous.get(event['id'],{})
        for field in ('poster','posterSource','posterAlt'):
            if prior.get(field): event[field]=prior[field]
    feed['events']=[e for e in feed['events'] if e.get('eventKind') != 'fight-night']+imported
    feed['events'].sort(key=lambda e:e['date'],reverse=True)
    target.write_text(json.dumps(feed,ensure_ascii=False,indent=2)+'\n')
    (root/'assets/js/official-events.js').write_text('// Official UFC main-card snapshot.\nexport const officialEvents = '+json.dumps(feed['events'],ensure_ascii=False,indent=2)+';\n')
    print(f'Imported {len(imported)} Fight Nights, {sum(len(e["bouts"]) for e in imported)} main-card bouts')
if __name__=='__main__': main()
