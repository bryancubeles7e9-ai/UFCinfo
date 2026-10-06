import http.client
import os
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch
from xml.etree import ElementTree
from http.server import ThreadingHTTPServer

from server import Database, fighter_ids, make_handler


class PublicationTests(unittest.TestCase):
    def test_public_origin_metadata_sitemap_and_private_file_protection(self):
        with tempfile.TemporaryDirectory() as directory:
            origin = "https://ufcinfo.example"
            server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(Database(Path(directory) / "accounts.sqlite3"), origin, fighter_ids()))
            server.RequestHandlerClass.log_message = lambda *args: None
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            def get(path, host="ufcinfo.example"):
                connection = http.client.HTTPConnection("127.0.0.1", server.server_port)
                connection.request("GET", path, headers={"Host": host})
                response = connection.getresponse()
                status, body = response.status, response.read().decode()
                connection.close()
                return status, body
            try:
                with patch.dict(os.environ, {"GOOGLE_SITE_VERIFICATION": 'token"<test>'}):
                    status, page = get("/")
                    self.assertEqual(status, 200)
                    self.assertIn('rel="canonical" href="https://ufcinfo.example/"', page)
                    self.assertIn('content="token&quot;&lt;test&gt;"', page)
                status, sitemap = get("/sitemap.xml")
                self.assertEqual(status, 200)
                locations = ElementTree.fromstring(sitemap).findall("{*}url/{*}loc")
                self.assertEqual([item.text for item in locations], [origin + "/"])
                status, robots = get("/robots.txt")
                self.assertEqual(status, 200)
                self.assertIn("Sitemap: https://ufcinfo.example/sitemap.xml", robots)
                self.assertEqual(get("/server.py")[0], 404)
                self.assertEqual(get("/sitemap.xml", "untrusted.example")[0], 403)
            finally:
                server.shutdown()
                server.server_close()
                thread.join()
