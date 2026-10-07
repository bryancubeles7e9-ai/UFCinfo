import importlib.util
import io
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('twitterapi_test', Path(__file__).resolve().parents[1] / 'scripts/test-twitterapi.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class TwitterAPITests(unittest.TestCase):
    sources = [{'id': 'reporter', 'handle': 'Reporter'}]

    def test_query_filters_before_fetch(self):
        query = module.build_query(self.sources, 100, 200)
        for expected in ['from:Reporter', 'since_time:100', 'until_time:200', '-filter:retweets', '-filter:replies', '"in talks"']:
            self.assertIn(expected, query)
        with self.assertRaises(ValueError):
            module.build_query([{'handle': 'bad OR from:someone'}], 100, 200)

    def test_single_authenticated_request_without_pagination(self):
        calls = []
        def opener(request, timeout):
            calls.append(request)
            return io.BytesIO(json.dumps({'tweets': [], 'has_next_page': True, 'next_cursor': 'next'}).encode())
        data = module.search('from:Reporter', 'test-secret', opener)
        self.assertTrue(data['has_next_page'])
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0].get_header('X-api-key'), 'test-secret')
        self.assertNotIn('test-secret', calls[0].full_url)
        self.assertNotIn('cursor=', calls[0].full_url)

    def test_unknown_authors_duplicates_and_reposts(self):
        tweet = {'id': '1234567890123456789', 'text': 'Fight targeted', 'author': {'userName': 'REPORTER'}}
        data = {'tweets': [tweet, tweet, {**tweet, 'author': {'userName': 'Other'}}, {**tweet, 'isReply': True}, {**tweet, 'retweeted_tweet': {'id': 'x'}}, {'id': 'bad'}]}
        result = module.candidates(data, self.sources)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['postUrl'], 'https://x.com/Reporter/status/1234567890123456789')
        self.assertEqual(result[0]['status'], 'pending-review')

    def test_invalid_api_response(self):
        with self.assertRaises(ValueError):
            module.search('query', 'key', lambda *a, **k: io.BytesIO(b'{"error":"invalid"}'))

    def test_boxing_excluded_but_ufc_matchup_retained(self):
        for text in ['TKO offered Anthony Joshua $10 MILLION for Fury vs Joshua',
                     'BOXING fight booking', 'Nueva pelea de boxeo',
                     'Tyson Fury is expected to face AJ', 'AJ-Fury in America']:
            with self.subTest(text=text):
                tweet = {'id': '1234567890123456789', 'text': text, 'author': {'userName': 'Reporter'}}
                self.assertEqual(module.candidates({'tweets': [tweet]}, self.sources), [])
        tweet = {'id': '1234567890123456789', 'text': 'Hecher Sosa vs Abdul Hussein is set for UFC Saudi Arabia', 'author': {'userName': 'Reporter'}}
        self.assertEqual(len(module.candidates({'tweets': [tweet]}, self.sources)), 1)

if __name__ == '__main__':
    unittest.main()
