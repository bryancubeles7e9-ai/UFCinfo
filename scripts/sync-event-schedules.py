"""Discover upcoming UFC events and reconcile their public cards and block times."""
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import importlib.util
import json
import re
import unicodedata
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import urlopen, Request

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('card_html', ROOT / 'scripts/import-fight-nights.py')
html = importlib.util.module_from_spec(spec)
spec.loader.exec_module(html)


def parse_schedule(page, event, now, *, allow_header=False):
    parser = html.Parser(); parser.feed(page)
    starts = {}
    for card_id, section in [('main-card', 'main'), ('prelims-card', 'prelims'), ('early-prelims', 'early-prelims')]:
        cards = parser.root.find(id=card_id)
        if len(cards) > 1:
            raise ValueError('Ambiguous section')
        stamps = {n.attrs['data-timestamp'] for card in cards for n in card.find('c-event-fight-card-broadcaster__time') if n.attrs.get('data-timestamp')}
        if len(stamps) > 1:
            raise ValueError('Ambiguous start time')
        if stamps:
            starts[section] = datetime.fromtimestamp(int(stamps.pop()), timezone.utc)
    # UFC sometimes publishes an ungrouped list before assigning fights to blocks.
    # Its Watch section can already provide block times on those pages.
    labels = {'main card': 'main', 'prelims': 'prelims', 'early prelims': 'early-prelims'}
    watch = {}
    for option in parser.root.find('c-listing-viewing-option'):
        section = labels.get(html.first(option, 'c-listing-viewing-option__fight-card').lower())
        if section:
            for node in option.find('c-listing-viewing-option__time'):
                if node.attrs.get('data-timestamp'):
                    watch.setdefault(section, set()).add(int(node.attrs['data-timestamp']))
    for section, values in watch.items():
        if section not in starts and len(values) == 1:
            starts[section] = datetime.fromtimestamp(next(iter(values)), timezone.utc)
    main = datetime.fromisoformat(event['date'].replace('Z', '+00:00'))
    if allow_header:
        starts.setdefault('main', main)
    if starts.get('main') != main:
        raise ValueError('Official main start missing or conflicts with event header')
    ordered = [starts[s] for s in ('early-prelims', 'prelims', 'main') if s in starts]
    if any(t > main or (main-t).total_seconds() > 43200 for t in ordered) or any(a >= b for a,b in zip(ordered,ordered[1:])):
        raise ValueError('Invalid section chronology')
    return {'eventDate': event['date'], 'source': event['source'], 'checkedAt': now.isoformat(), 'starts': {k:v.isoformat() for k,v in starts.items()}}


def confirm_title_rounds(page, event):
    """Read title bouts from the already fetched official page; match both fighters."""
    parser = html.Parser(); parser.feed(page)
    stamps = {n.attrs.get('data-timestamp') for n in parser.root.find('c-hero__headline-suffix') if n.attrs.get('data-timestamp')}
    expected = datetime.fromisoformat(event['date'].replace('Z','+00:00'))
    if not stamps or any(datetime.fromtimestamp(int(stamp),timezone.utc) != expected for stamp in stamps):
        return
    def name(text):
        return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFKD', text).encode('ascii','ignore').decode().lower())
    def pair(red, blue):
        return frozenset((name(red), name(blue)))
    confirmed = set()
    for fight in parser.root.find('c-listing-fight'):
        label = html.first(fight, 'c-listing-fight__class-text').lower()
        if not re.search(r'\b(title|championship|bmf)\b', label):
            continue
        red = html.first(fight, 'c-listing-fight__corner-name--red')
        blue = html.first(fight, 'c-listing-fight__corner-name--blue')
        if red and blue: confirmed.add(pair(red, blue))
    for bout in event.get('bouts', []):
        if pair(bout['red'],bout['blue']) in confirmed:
            bout.update(scheduledRounds=5, roundsSource=event['source'])


UFC = 'https://www.ufc.com'
SECTIONS = (('main-card', 'main'), ('prelims-card', 'prelims'), ('early-prelims', 'early-prelims'))
EVENT_ID = re.compile(r'ufc-(?:\d{3}|fight-night-[a-z]+-\d{2}-\d{4}|freedom-250)')
merge_spec = importlib.util.spec_from_file_location('card_merge', ROOT / 'scripts/sync-cito-events.py')
merge = importlib.util.module_from_spec(merge_spec)
merge_spec.loader.exec_module(merge)
save_spec = importlib.util.spec_from_file_location('sync_monitor', ROOT / 'scripts/run-data-sync.py')
monitor = importlib.util.module_from_spec(save_spec)
save_spec.loader.exec_module(monitor)


def parse(page):
    parser = html.Parser()
    parser.feed(page)
    return parser.root


def calendar_ids(page):
    upcoming = parse(page).find(id='events-list-upcoming')
    if len(upcoming) != 1:
        raise ValueError('Upcoming UFC calendar missing or ambiguous')
    ids = {}
    for entry in upcoming[0].find('c-card-event--result__date'):
        for node in entry.children:
            if not isinstance(node, html.Node) or node.tag != 'a':
                continue
            url = urljoin(UFC, node.attrs.get('href', ''))
            if url.startswith(UFC + '/event/'):
                slug = url.removeprefix(UFC + '/event/')
                if EVENT_ID.fullmatch(slug):
                    ids[slug] = None
    if not ids or len(ids) > 20:
        raise ValueError('Invalid upcoming UFC calendar size')
    return list(ids)


def public_page(url):
    with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=15) as response:
        if response.geturl() != url:
            raise ValueError('Unexpected redirect from UFC')
        data = response.read(3_000_001)
    if len(data) > 3_000_000:
        raise ValueError('Official response too large')
    return data.decode('utf-8')


def update_card(page, slug, saved, now):
    tree = parse(page)
    number = int(slug[4:]) if re.fullmatch(r'ufc-\d{3}', slug) else None
    kind = 'numbered' if number else 'fight-night' if 'fight-night' in slug else 'special'
    source = f'{UFC}/event/{slug}'
    # Canonical tags are nested in <head>; the page must name this exact event.
    canonicals = re.findall(r'<link\s+[^>]*rel="canonical"[^>]*href="([^"]+)"', page, re.I)
    if canonicals != [source]:
        raise ValueError('Official card identity mismatch')
    stamps = {int(n.attrs['data-timestamp']) for n in tree.find('c-hero__headline-suffix') if n.attrs.get('data-timestamp')}
    if len(stamps) != 1:
        raise ValueError('Official main start missing or ambiguous')
    main = datetime.fromtimestamp(stamps.pop(), timezone.utc)
    if main <= now:
        raise ValueError('Official card already started')
    event = deepcopy(saved) if saved else {}
    old_date = event.get('date')
    date = main.isoformat()
    # The official hero gives the main start even when TV times are still pending.
    schedule = parse_schedule(page, {'date': date, 'source': source}, now, allow_header=True)
    if min(datetime.fromisoformat(value) for value in schedule['starts'].values()) <= now:
        raise ValueError('Official card already started')
    groups = [(section, card.find('c-listing-fight'))
              for card_id, section in SECTIONS for card in tree.find(id=card_id)]
    if not any(fights for _, fights in groups):
        views = tree.find('view-event-fights')
        if len(views) == 1:
            groups = [(None, views[0].find('c-listing-fight'))]
    bouts = []
    for section, fights in groups:
        for fight in fights:
            red = html.first(fight, 'c-listing-fight__corner-name--red')
            blue = html.first(fight, 'c-listing-fight__corner-name--blue')
            if not red or not blue:
                continue  # UFC may show an opponent slot as TBD.
            division = html.first(fight, 'c-listing-fight__class-text')
            bouts.append(dict(section=section, red=red, blue=blue, division=division,
                              winner=None, outcome=None, method='', round='', time=''))
    prior_bouts = event.get('bouts', [])
    if len(bouts) > 30 or (prior_bouts and len(bouts) < (len(prior_bouts) + 1) // 2):
        raise ValueError('Official card appears incomplete; preserved saved bouts')
    headliner = next((bout for bout in bouts if bout['section'] == 'main'), None)
    subtitle = f"{headliner['red']} vs {headliner['blue']}" if headliner else html.first(tree, 'c-hero__headline')
    event.update(id=slug, number=number, eventKind=kind, type='official', source=source,
                 title=event.get('title') or (f'UFC {number}' if number else 'UFC Fight Night' if kind == 'fight-night' else 'UFC Freedom 250'),
                 subtitle=subtitle or event.get('subtitle') or 'Cartelera pendiente de anuncio',
                 location=html.first(tree, 'field--name-venue') or event.get('location') or 'Recinto no indicado',
                 date=date, status='scheduled' if bouts else 'announced', dataSource='UFC',
                 checkedAt=now.date().isoformat(), scheduleSource=source, sectionSchedule=schedule)
    event['bouts'] = merge.merge_bouts(event, bouts, set(), now, source='UFC')
    event['bouts'].sort(key=lambda bout: dict(main=0, prelims=1, **{'early-prelims': 2}).get(bout.get('section'), 0))
    if len(event['bouts']) > 30:
        raise ValueError('Merged card exceeds limit')
    confirm_title_rounds(page, event)
    if old_date and datetime.fromisoformat(old_date) != main:
        old_schedule = saved.get('sectionSchedule', {})
        was_first_block = datetime.fromisoformat(old_date) in [
            datetime.fromisoformat(value) for key, value in schedule['starts'].items() if key != 'main']
        same_main = old_schedule.get('starts', {}).get('main') == date
        merge.change(event, 'schedule-corrected' if was_first_block or same_main else 'rescheduled',
                     now, source='UFC', previousDate=old_date, date=date)
    return event


def synchronize(feed, fetch=public_page, now=None):
    now = now or datetime.now(timezone.utc)
    saved = {event['id']: event for event in feed['events']}
    slugs = calendar_ids(fetch(UFC + '/events'))
    updated, failed = [], []
    for slug in slugs:
        event = saved.get(slug)
        if event:
            if event.get('status') not in ('announced', 'scheduled'):
                continue
            # Leave ongoing cards and cards awaiting results to the results importer.
            if datetime.fromisoformat(event['date']) <= now or any(
                b.get('winner') or b.get('outcome') for b in event['bouts']
            ):
                continue
        try:
            saved[slug] = update_card(fetch(f'{UFC}/event/{slug}'), slug, event, now)
            updated.append(slug)
            print(f'Official card verified: {slug} ({len(saved[slug]["bouts"])} bouts)')
        except (OSError, ValueError, KeyError, OverflowError, merge.SyncError) as error:
            failed.append(slug)
            print(f'::warning::Official card preserved for {slug}: {error}')
    # Absence from the public list alone does not prove a cancellation.
    for slug, event in saved.items():
        if (slug not in slugs and event.get('status') in ('announced', 'scheduled')
                and now < datetime.fromisoformat(event['date']) <= now + timedelta(days=14)):
            failed.append(slug)
            print(f'::warning::Upcoming card absent from UFC calendar, preserved: {slug}')
    if not updated:
        print('::warning::No upcoming UFC card could be verified')
    if len(saved) > 100:
        raise ValueError('Combined events exceed the published feed limit')
    feed['events'] = sorted(saved.values(), key=lambda e: datetime.fromisoformat(e['date']), reverse=True)
    feed['scheduleVerification'] = {'checkedAt': now.isoformat(), 'verifiedIds': updated, 'failedIds': failed}
    if updated:
        feed.update(source='UFC', sourceUrl=UFC, synchronizedAt=now.isoformat())
    return bool(updated)


def main():
    import argparse
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--output', type=Path, default=ROOT / 'assets/data/ufc-events.json')
    cli.add_argument('--input', type=Path, default=ROOT / 'assets/data/ufc-events.json')
    args = cli.parse_args()
    try:
        feed = json.loads(args.input.read_text())
        verified = synchronize(feed)
        monitor.write(args.output, feed)
    except (OSError, ValueError, KeyError, OverflowError) as error:
        print(f'::warning::Official UFC calendar not verified: {error}')
        return 1
    return 0 if verified else 1


if __name__ == '__main__':
    raise SystemExit(main())
