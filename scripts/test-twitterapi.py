"""One filtered TwitterAPI.io search; keep candidates private for review."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import tempfile
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
ENDPOINT = 'https://api.twitterapi.io/twitter/tweet/advanced_search'
KEYWORDS = '("in talks" OR "targeted" OR "expected to face" OR "set to face" OR "booking" OR "negociaciones" OR "pelea" OR "combate" OR "vs")'


def build_query(sources, start, end):
    if not sources or any(not re.fullmatch(r'[A-Za-z0-9_]{1,15}', s['handle']) for s in sources):
        raise ValueError('Invalid source handles')
    authors = '(' + ' OR '.join('from:' + s['handle'] for s in sources) + ')'
    return f'{authors} {KEYWORDS} -filter:retweets -filter:replies since_time:{start} until_time:{end}'


def search(query, key, opener=urlopen):
    request = Request(ENDPOINT + '?' + urlencode({'query': query, 'queryType': 'Latest'}), headers={'X-API-Key': key, 'Accept': 'application/json'})
    with opener(request, timeout=25) as response:
        data = json.loads(response.read(2_000_001))
    if not isinstance(data, dict) or not isinstance(data.get('tweets'), list):
        raise ValueError('Unexpected API response')
    return data


def candidates(data, sources):
    known = {s['handle'].lower(): s for s in sources}
    found = {}
    for tweet in data['tweets']:
        if not isinstance(tweet, dict):
            continue
        author = tweet.get('author') or {}
        source = known.get(str(author.get('userName', '')).lower())
        post_id = tweet.get('id')
        text = tweet.get('text')
        if not source or not isinstance(post_id, str) or not re.fullmatch(r'[0-9]{10,22}', post_id) or not isinstance(text, str) or not text.strip():
            continue
        if tweet.get('isReply') or tweet.get('retweeted_tweet') or text.startswith('RT @'):
            continue
        found[post_id] = {'id': post_id, 'sourceId': source['id'], 'postUrl': f'https://x.com/{source["handle"]}/status/{post_id}', 'text': text, 'publishedAt': tweet.get('createdAt'), 'language': tweet.get('lang'), 'status': 'pending-review'}
    return list(found.values())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fetch', action='store_true', help='Execute ONE API request; otherwise preview only')
    parser.add_argument('--source', action='append', help='Source ID; repeat to select multiple journalists')
    parser.add_argument('--hours', type=int, default=24, help='Look back 1–168 hours (default 24)')
    args = parser.parse_args()
    if not 1 <= args.hours <= 168:
        parser.error('--hours must be between 1 and 168')
    feed = json.loads((ROOT / 'assets/data/ufc-rumors.json').read_text())
    selected = set(args.source or [s['id'] for s in feed['sources']])
    sources = [s for s in feed['sources'] if s['id'] in selected]
    if {s['id'] for s in sources} != selected:
        parser.error('Unknown source ID')
    end = int(datetime.now(timezone.utc).timestamp())
    query = build_query(sources, end - args.hours * 3600, end)
    print('Search:', query)
    print('One request, first page only (provider documents up to 20 posts). No pagination or retries.')
    if not args.fetch:
        print('Preview only: no network request or charge. Add --fetch to test.')
        return
    key_path = ROOT / '.octagon-data/twitterapi.key'
    key = os.environ.get('TWITTERAPI_IO_KEY', '').strip()
    if not key and key_path.is_file():
        key = key_path.read_text().strip()
    if not key:
        parser.exit(2, 'Missing key: set TWITTERAPI_IO_KEY or save it in .octagon-data/twitterapi.key.\n')
    try:
        data = search(query, key)
        results = candidates(data, sources)
    except HTTPError as error:
        parser.exit(1, f'API HTTP {error.code}. No automatic retry. Check key, credits or limits in your dashboard.\n')
    except (URLError, ValueError, TimeoutError, OSError):
        parser.exit(1, 'Could not retrieve valid data. No automatic retry; check provider status.\n')
    target = ROOT / '.octagon-data/twitterapi-candidates.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    payload = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'query': query, 'returned': len(data['tweets']), 'hasMore': bool(data.get('has_next_page')), 'candidates': results}
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=target.parent, delete=False) as tmp:
        json.dump(payload, tmp, ensure_ascii=False, indent=2)
        tmp.write('\n')
    Path(tmp.name).replace(target)
    os.chmod(target, 0o600)
    print(f'Returned {len(data["tweets"])} posts; retained {len(results)} candidates. Saved privately to {target}.')
    if payload['hasMore']:
        print('More results exist; they were not requested to keep this test limited.')
    print('Candidates are not published rumors. Review before publishing with scripts/add-rumor.py.')


if __name__ == '__main__':
    main()
