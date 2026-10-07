"""Publish a reviewed, attributed X report with original provenance and bilingual summaries."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import tempfile

ROOT = Path(__file__).resolve().parents[1]

def timestamp_from_post(post_id):
    milliseconds = (int(post_id) >> 22) + 1288834974657
    return datetime.fromtimestamp(milliseconds / 1000, timezone.utc)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, help='Source ID from ufc-rumors.json')
    parser.add_argument('--post', required=True, help='Original post URL, not a profile or a repost')
    parser.add_argument('--fighters', nargs=2, required=True, help='Two fighter IDs from the catalog')
    parser.add_argument('--summary-es', required=True, help='Reviewed Spanish paraphrase')
    parser.add_argument('--summary-en', required=True, help='Reviewed English paraphrase')
    parser.add_argument('--language', choices=['es','en'], help='Language of the original post')
    parser.add_argument('--event', type=int, help='Numbered UFC event mentioned by the journalist')
    parser.add_argument('--no-spoilers', action='store_true', help='Use only after reviewing that the summaries contain no results')
    args = parser.parse_args()
    target = ROOT / 'assets/data/ufc-rumors.json'
    feed = json.loads(target.read_text())
    source = next((s for s in feed['sources'] if s['id'] == args.source), None)
    if not source:
        parser.error('Unknown journalist; add the original author to sources first')
    pattern = rf'https://(?:x\.com|twitter\.com)/{re.escape(source["handle"])}/status/([0-9]{{10,22}})(?:\?[^#]*)?'
    match = re.fullmatch(pattern, args.post, re.IGNORECASE)
    if not match:
        parser.error('The post URL must belong to the selected journalist')
    post_id = match.group(1)
    if any(r['id'] == post_id for r in feed['rumors']):
        parser.error('This post has already been published')
    initial = json.loads((ROOT / 'docs/fighter-details-sources.json').read_text())
    additional = json.loads((ROOT / 'docs/fighter-directory-sources.json').read_text())
    known = set(initial) | {f['id'] for f in additional}
    if len(set(args.fighters)) != 2 or not all(f in known for f in args.fighters):
        parser.error('Choose two distinct fighters from the catalog')
    summaries = {'es':args.summary_es.strip(), 'en':args.summary_en.strip()}
    if not all(1 <= len(s) <= 600 for s in summaries.values()):
        parser.error('Summaries must be between 1 and 600 characters')
    if args.event is not None and not 1 <= args.event <= 9999:
        parser.error('Invalid event number')
    now = datetime.now(timezone.utc)
    try:
        published = timestamp_from_post(post_id)
        if published > now or published.year < 2010:
            raise ValueError()
    except (ValueError, OverflowError, OSError):
        parser.error('Invalid post timestamp')
    feed['rumors'].append({
        'id':post_id, 'sourceId':source['id'], 'postUrl':f'https://x.com/{source["handle"]}/status/{post_id}',
        'publishedAt':published.isoformat(), 'reviewedAt':now.isoformat(),
        'language':args.language or source['language'], 'fighters':args.fighters, 'summary':summaries,
        'containsSpoilers':not args.no_spoilers, 'eventId':f'ufc-{args.event}' if args.event else None, 'official':None,
    })
    feed['updatedAt'] = now.isoformat()
    with tempfile.NamedTemporaryFile(mode='w',encoding='utf-8',dir=target.parent,delete=False) as tmp:
        json.dump(feed,tmp,ensure_ascii=False,indent=2); tmp.write('\n')
    Path(tmp.name).replace(target)
    print('Published one reviewed report. Official confirmation remains pending.')

if __name__ == '__main__':
    main()
