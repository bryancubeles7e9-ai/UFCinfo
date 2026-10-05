"""Import a reviewed main-card snapshot from downloaded official UFC event pages.
Usage: python3 scripts/import-ufc-events.py /tmp
No credentials or external Python dependencies required.
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
root=Path(__file__).resolve().parents[1]
events=[]
for num in range(324,333):
    p=Parser(); p.feed((Path(sys.argv[1])/f'ufc{num}.html').read_text()); s=p.root
    main=s.find(id='main-card')[0]
    timestamp=int(main.find('c-event-fight-card-broadcaster__time')[0].attrs['data-timestamp'])
    bouts=[]
    for f in main.find('c-listing-fight'):
        red=first(f,'c-listing-fight__corner-name--red'); blue=first(f,'c-listing-fight__corner-name--blue')
        corners=[f.find('c-listing-fight__corner--'+c)[0] for c in ['red','blue']]
        winner=red if corners[0].find('c-listing-fight__outcome--win') else blue if corners[1].find('c-listing-fight__outcome--win') else None
        bouts.append(dict(red=red,blue=blue,division=first(f,'c-listing-fight__class-text'),winner=winner,method=first(f,'method'),round=first(f,'round'),time=first(f,'time')))
    assert len(bouts)>=4 and all(b['red'] and b['blue'] for b in bouts), num
    events.append(dict(id=f'ufc-{num}',number=num,title=f'UFC {num}',subtitle=first(s,'c-hero__headline'),date=datetime.fromtimestamp(timestamp,timezone.utc).isoformat(),location=first(s,'field--name-venue'),type='official',source=f'https://www.ufc.com/event/ufc-{num}',checkedAt='2026-10-05',bouts=bouts))
(root/'assets/js/official-events.js').write_text('// Official UFC main-card snapshot. Refresh with scripts/import-ufc-events.py.\nexport const officialEvents = '+json.dumps(events,ensure_ascii=False,indent=2)+';\n')
for e in events: print(e['title'],e['date'],e['location'],len(e['bouts']),[(b['red'],b['blue'],b['winner']) for b in e['bouts']])
