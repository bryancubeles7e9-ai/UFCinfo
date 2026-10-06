import http.client
import json
import tempfile
import threading
import time
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path

from server import Database, fighter_ids, make_handler


class AccountAPITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory()
        cls.database = Database(Path(cls.directory.name) / "accounts.sqlite3")
        # Allocate the port first; origin checks use this actual listening origin.
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(cls.database, "http://127.0.0.1:1", fighter_ids()))
        cls.port = cls.server.server_port
        cls.origin = f"http://127.0.0.1:{cls.port}"
        cls.server.RequestHandlerClass = make_handler(cls.database, cls.origin, fighter_ids())
        cls.server.RequestHandlerClass.log_message = lambda *args: None
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.directory.cleanup()

    def request(self, method, path, data=None, cookie=None, csrf=None, origin=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        headers = {"Origin": origin or self.origin}
        if cookie:
            headers["Cookie"] = cookie
        if csrf:
            headers["X-Octagon-CSRF"] = csrf
        payload = json.dumps(data) if data is not None else None
        if payload:
            headers["Content-Type"] = "application/json"
        conn.request(method, path, payload, headers)
        response = conn.getresponse()
        raw = response.read()
        result = json.loads(raw) if response.getheader("Content-Type", "").startswith("application/json") else raw
        status, headers = response.status, dict(response.getheaders())
        conn.close()
        return status, result, headers

    def register(self, email, favorites=None):
        status, data, headers = self.request("POST", "/api/auth/register", {"email":email,"password":"testing-password-12345","favorites":favorites or []})
        self.assertEqual(status, 201, data)
        return data, headers["Set-Cookie"].split(";")[0]

    def test_two_computers_and_isolated_accounts(self):
        alice, cookie = self.register("alice@example.test", ["topuria"])
        status, saved, _ = self.request("PUT", "/api/me/following", {"favorites":["topuria","ufc-diego-lopes"],"revision":0}, cookie, alice["csrf"])
        self.assertEqual(status, 200)
        status, computer2, headers = self.request("POST", "/api/auth/login", {"email":"ALICE@example.test","password":"testing-password-12345"})
        self.assertEqual(status, 200)
        self.assertEqual(computer2["favorites"], saved["favorites"])
        second_cookie = headers["Set-Cookie"].split(";")[0]
        bob, bob_cookie = self.register("bob@example.test")
        self.assertEqual(bob["favorites"], [])
        self.assertNotEqual(bob["user"]["id"], alice["user"]["id"])
        status, _, _ = self.request("PUT", "/api/me/following", {"favorites":["holloway"],"revision":computer2["revision"]}, second_cookie, computer2["csrf"])
        self.assertEqual(status, 200)
        self.assertEqual(self.request("GET", "/api/me/following", cookie=bob_cookie)[1]["favorites"], [])
        status, conflict, _ = self.request("PUT", "/api/me/following", {"favorites":["topuria"],"revision":saved["revision"]}, cookie, alice["csrf"])
        self.assertEqual(status, 409)
        self.assertEqual(conflict["favorites"], ["holloway"])
        self.assertEqual(self.request("GET", "/api/me/following", cookie=cookie)[1]["favorites"], ["holloway"])

    def test_validation_origin_csrf_and_password_storage(self):
        user, cookie = self.register("security@example.test", ["ufc-joshua-van"])
        for favorites in [["invalid"], ["topuria","topuria"], [2], None]:
            status, _, _ = self.request("PUT", "/api/me/following", {"favorites":favorites,"revision":0}, cookie, user["csrf"])
            self.assertEqual(status, 400)
        self.assertEqual(self.request("PUT", "/api/me/following", {"favorites":[],"revision":0}, cookie)[0], 403)
        self.assertEqual(self.request("PUT", "/api/me/following", {"favorites":[],"revision":0}, cookie, user["csrf"], "https://attacker.test")[0], 403)
        self.assertEqual(self.request("GET", "/api/me/following")[0], 401)
        self.assertEqual(self.request("POST", "/api/auth/login", {"email":"security@example.test","password":"wrong-password"})[0], 401)
        self.assertEqual(self.request("POST", "/api/auth/register", {"email":"short@example.test","password":"123"})[0], 400)
        with self.database.connect() as db:
            row = db.execute("SELECT password,salt FROM users WHERE id=?", (user["user"]["id"],)).fetchone()
            self.assertNotEqual(row["password"], b"testing-password-12345")
            self.assertEqual(len(row["salt"]), 16)
            tokens = [r[0] for r in db.execute("SELECT token_hash FROM sessions")]
            self.assertNotIn(cookie.split("=",1)[1], tokens)
        headers = self.request("POST", "/api/auth/login", {"email":"security@example.test","password":"testing-password-12345"})[2]
        self.assertIn("HttpOnly", headers["Set-Cookie"])
        self.assertIn("SameSite=Lax", headers["Set-Cookie"])

    def test_logout_expiry_private_files_and_database_persistence(self):
        user, cookie = self.register("logout@example.test", ["oliveira"])
        self.assertEqual(self.request("POST", "/api/auth/logout", {}, cookie, user["csrf"])[0], 200)
        self.assertIsNone(self.request("GET", "/api/auth/session", cookie=cookie)[1]["user"])
        login = self.request("POST", "/api/auth/login", {"email":"logout@example.test","password":"testing-password-12345"})
        cookie2 = login[2]["Set-Cookie"].split(";")[0]
        with self.database.connect() as db:
            db.execute("UPDATE sessions SET expires_at=? WHERE user_id=?", (int(time.time())-1,user["user"]["id"]))
        self.assertEqual(self.request("GET", "/api/me/following", cookie=cookie2)[0], 401)
        for path in ["/server.py","/.git/config","/.octagon-data/accounts.sqlite3","/assets/../server.py","/docs/fighter-directory-sources.json"]:
            self.assertEqual(self.request("GET", path)[0], 404, path)
        self.assertEqual(self.request("GET", "/api/health")[0], 200)
        self.assertEqual(self.request("GET", "/index.html")[0], 200)
        self.assertEqual(self.request("GET", "/assets/js/account.js")[0], 200)
        again = Database(self.database.path)
        with again.connect() as db:
            favorites = db.execute("SELECT favorites FROM users WHERE id=?", (user["user"]["id"],)).fetchone()[0]
            self.assertEqual(json.loads(favorites), ["oliveira"])

    def test_rate_limit(self):
        for _ in range(10):
            self.database.rate_limit("isolated-test-address", "limited@example.test")
        from server import APIError
        with self.assertRaises(APIError) as result:
            self.database.rate_limit("isolated-test-address", "limited@example.test")
        self.assertEqual(result.exception.status, 429)


if __name__ == "__main__":
    unittest.main()
