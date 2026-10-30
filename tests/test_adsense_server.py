import http.client
import json
from pathlib import Path
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
import server


class AdSenseRoutesTests(unittest.TestCase):
    def test_verification_ads_txt_and_static_allowlist(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'assets/data').mkdir(parents=True)
            (root / 'index.html').write_text('<html><head></head><body>UFCinfo</body></html>')
            config = root / 'assets/data/adsense.json'
            config.write_text('{"enabled":false,"client":""}')
            previous = server.ROOT
            server.ROOT = root
            httpd = None
            try:
                db = server.Database(root / 'private.sqlite3')
                httpd = ThreadingHTTPServer(('127.0.0.1', 0), server.make_handler(db, 'http://ufcinfo.example', set()))
                thread = threading.Thread(target=httpd.serve_forever, daemon=True)
                thread.start()

                def get(path, host='ufcinfo.example'):
                    conn = http.client.HTTPConnection('127.0.0.1', httpd.server_port, timeout=5)
                    conn.request('GET', path, headers={'Host': host})
                    response = conn.getresponse()
                    status, content_type, body = response.status, response.getheader('Content-Type'), response.read().decode()
                    conn.close()
                    return status, content_type, body

                self.assertEqual(get('/ads.txt')[0], 404)
                self.assertNotIn('google-adsense-account', get('/')[2])
                config.write_text(json.dumps({'enabled':False,'client':'ca-pub-1234567890123456'}))
                status, content_type, body = get('/ads.txt')
                self.assertEqual(status, 200)
                self.assertIn('text/plain', content_type)
                self.assertEqual(body, 'google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n')
                self.assertIn('name="google-adsense-account" content="ca-pub-1234567890123456"', get('/')[2])
                self.assertEqual(get('/ads.txt', 'untrusted.example')[0], 403)
                self.assertEqual(get('/adsense.py')[0], 404)
                self.assertEqual(get('/private.sqlite3')[0], 404)
            finally:
                if httpd:
                    httpd.shutdown()
                    httpd.server_close()
                    thread.join(timeout=5)
                server.ROOT = previous


if __name__ == '__main__':
    unittest.main()
