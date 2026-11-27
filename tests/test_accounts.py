import contextlib
import http.client
import io
import unittest.mock
from types import SimpleNamespace
import json
import tempfile
import sqlite3
import threading
import time
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path

from server import Database, fighter_ids, make_handler, password_hash


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

    def register(self, username, favorites=None):
        status, data, headers = self.request("POST", "/api/auth/register", {"username":username,"password":"testing-password-12345","favorites":favorites or []})
        self.assertEqual(status, 201, data)
        return data, headers["Set-Cookie"].split(";")[0]

    def test_two_computers_and_isolated_accounts(self):
        alice, cookie = self.register("alice", ["topuria"])
        status, saved, _ = self.request("PUT", "/api/me/following", {"favorites":["topuria","ufc-diego-lopes"],"revision":0}, cookie, alice["csrf"])
        self.assertEqual(status, 200)
        status, computer2, headers = self.request("POST", "/api/auth/login", {"username":"ALICE","password":"testing-password-12345"})
        self.assertEqual(status, 200)
        self.assertEqual(computer2["favorites"], saved["favorites"])
        second_cookie = headers["Set-Cookie"].split(";")[0]
        bob, bob_cookie = self.register("bob")
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
        user, cookie = self.register("security", ["ufc-joshua-van"])
        for favorites in [["invalid"], ["topuria","topuria"], [2], None]:
            status, _, _ = self.request("PUT", "/api/me/following", {"favorites":favorites,"revision":0}, cookie, user["csrf"])
            self.assertEqual(status, 400)
        self.assertEqual(self.request("PUT", "/api/me/following", {"favorites":[],"revision":0}, cookie)[0], 403)
        self.assertEqual(self.request("PUT", "/api/me/following", {"favorites":[],"revision":0}, cookie, user["csrf"], "https://attacker.test")[0], 403)
        self.assertEqual(self.request("GET", "/api/me/following")[0], 401)
        self.assertEqual(self.request("POST", "/api/auth/login", {"username":"security","password":"wrong-password"})[0], 401)
        self.assertEqual(self.request("POST", "/api/auth/register", {"username":"short","password":"123"})[0], 400)
        with self.database.connect() as db:
            row = db.execute("SELECT password,salt FROM users WHERE id=?", (user["user"]["id"],)).fetchone()
            self.assertNotEqual(row["password"], b"testing-password-12345")
            self.assertEqual(len(row["salt"]), 16)
            tokens = [r[0] for r in db.execute("SELECT token_hash FROM sessions")]
            self.assertNotIn(cookie.split("=",1)[1], tokens)
        headers = self.request("POST", "/api/auth/login", {"username":"security","password":"testing-password-12345"})[2]
        self.assertIn("HttpOnly", headers["Set-Cookie"])
        self.assertIn("SameSite=Lax", headers["Set-Cookie"])

    def test_logout_expiry_private_files_and_database_persistence(self):
        user, cookie = self.register("logout", ["oliveira"])
        self.assertEqual(self.request("POST", "/api/auth/logout", {}, cookie, user["csrf"])[0], 200)
        self.assertIsNone(self.request("GET", "/api/auth/session", cookie=cookie)[1]["user"])
        login = self.request("POST", "/api/auth/login", {"username":"logout","password":"testing-password-12345"})
        cookie2 = login[2]["Set-Cookie"].split(";")[0]
        with self.database.connect() as db:
            db.execute("UPDATE sessions SET expires_at=? WHERE user_id=?", (int(time.time())-1,user["user"]["id"]))
        self.assertEqual(self.request("GET", "/api/me/following", cookie=cookie2)[0], 401)
        for path in ["/server.py","/.git/config","/.ufcinfo-data/accounts.sqlite3","/assets/../server.py","/docs/fighter-directory-sources.json"]:
            status, body, _ = self.request("GET", path)
            self.assertEqual(status, 404, path)
            self.assertIn("Esta página no existe".encode(), body, path)
            self.assertNotIn(b"import ", body, path)
        self.assertEqual(self.request("GET", "/api/health")[0], 200)
        self.assertEqual(self.request("GET", "/index.html")[0], 200)
        self.assertEqual(self.request("GET", "/assets/js/account.js")[0], 200)
        again = Database(self.database.path)
        with again.connect() as db:
            favorites = db.execute("SELECT favorites FROM users WHERE id=?", (user["user"]["id"],)).fetchone()[0]
            self.assertEqual(json.loads(favorites), ["oliveira"])

    def test_unique_usernames_and_validation(self):
        user, _ = self.register("Unique_User")
        self.assertEqual(user["user"]["username"], "unique_user")
        for name in ["unique_user", "UNIQUE_USER", " unique_user "]:
            status, result, _ = self.request("POST", "/api/auth/register", {"username": name, "password": "testing-password-12345"})
            self.assertEqual(status, 409, result)
        for name in ["ab", "a" * 25, "with space", "new@example.test"]:
            self.assertEqual(self.request("POST", "/api/auth/register", {"username": name, "password": "testing-password-12345"})[0], 400)
        self.assertEqual(self.request("POST", "/api/auth/login", {"username": "UNIQUE_USER", "password": "testing-password-12345"})[0], 200)

    def test_full_health_checks_database_writes_and_disk(self):
        status, data, _ = self.request("GET", "/api/health/full")
        self.assertEqual(status, 200, data)
        self.assertTrue(data["ok"] and data["database"] and data["writable"] and data["disk"])
        self.assertGreater(data["freeMB"], 0)
        with unittest.mock.patch("server.shutil.disk_usage", return_value=SimpleNamespace(free=1024)):
            status, data, _ = self.request("GET", "/api/health/full")
        self.assertEqual(status, 503)
        self.assertFalse(data["ok"] or data["disk"])

    def test_client_errors_are_logged_briefly_and_capped(self):
        report = {"message": "x" * 900, "source": "/assets/js/app.js", "line": 12, "column": "bad", "view": "#pickem"}
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            status, _, _ = self.request("POST", "/api/client-errors", report)
            for _ in range(25):
                self.request("POST", "/api/client-errors", {"message": "repeat"})
        self.assertEqual(status, 202)
        lines = [json.loads(line.split(" ", 1)[1]) for line in output.getvalue().splitlines() if line.startswith("client_error ")]
        self.assertEqual(len(lines), 20, "per-address hourly cap")
        self.assertEqual(len(lines[0]["message"]), 300)
        self.assertIsNone(lines[0]["column"])
        status, _, _ = self.request("POST", "/api/client-errors", report, origin="https://evil.example")
        self.assertEqual(status, 403)

    def test_backup_requires_server_token_and_returns_a_working_copy(self):
        self.register("backupuser")
        status, _, _ = self.request("GET", "/api/admin/backup")
        self.assertEqual(status, 404, "disabled without a configured token")
        token = "t" * 40
        with unittest.mock.patch.dict("os.environ", {"OCTAGON_BACKUP_TOKEN": token}):
            conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
            conn.request("GET", "/api/admin/backup", headers={"Authorization": "Bearer wrong"})
            self.assertEqual(conn.getresponse().status, 404)
            conn.close()
            conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
            conn.request("GET", "/api/admin/backup", headers={"Authorization": "Bearer " + token})
            response = conn.getresponse()
            body = response.read()
            conn.close()
        self.assertEqual(response.status, 200)
        copy = Path(self.directory.name) / "restored.sqlite3"
        copy.write_bytes(body)
        with sqlite3.connect(copy) as db:
            self.assertEqual(db.execute("PRAGMA integrity_check").fetchone()[0], "ok")
            self.assertEqual(db.execute("SELECT COUNT(*) FROM users WHERE username='backupuser'").fetchone()[0], 1)

    def test_text_assets_are_compressed_and_revalidated(self):
        import gzip
        def get(path, **headers):
            conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
            conn.request("GET", path, headers=headers)
            response = conn.getresponse()
            body, result = response.read(), (response.status, dict(response.getheaders()))
            conn.close()
            return result + (body,)
        original = Path("assets/js/fighter-directory-data.js").read_bytes()
        status, headers, body = get("/assets/js/fighter-directory-data.js", **{"Accept-Encoding": "gzip, br"})
        self.assertEqual((status, headers["Content-Encoding"], headers["Vary"]), (200, "gzip", "Accept-Encoding"))
        self.assertEqual(gzip.decompress(body), original)
        self.assertLess(len(body), len(original) / 4)
        self.assertEqual(get("/assets/js/fighter-directory-data.js", **{"Accept-Encoding": "gzip", "If-None-Match": headers["ETag"]})[0], 304)
        status, headers, body = get("/assets/js/fighter-directory-data.js")
        self.assertNotIn("Content-Encoding", headers)
        self.assertEqual(body, original)
        self.assertNotIn("Content-Encoding", get("/assets/js/app.js", **{"Accept-Encoding": "gzip;q=0"})[1])
        status, headers, body = get("/", **{"Accept-Encoding": "gzip"})
        self.assertIn(b"<html", gzip.decompress(body))
        self.assertEqual(get("/assets/../server.py", **{"Accept-Encoding": "gzip"})[0], 404)
        # Larger API answers are compressed too; short ones are not worth it.
        status, headers, body = get("/api/pickem/state", **{"Accept-Encoding": "gzip"})
        self.assertEqual((status, headers.get("Content-Encoding"), headers.get("Cache-Control")), (200, "gzip", "no-store"))
        self.assertIn("events", json.loads(gzip.decompress(body)))
        status, headers, body = get("/api/pickem/state")
        self.assertNotIn("Content-Encoding", headers)
        self.assertIn("events", json.loads(body))
        self.assertNotIn("Content-Encoding", get("/api/health", **{"Accept-Encoding": "gzip"})[1])

    def test_photos_use_the_lighter_webp_copy_when_the_browser_accepts_it(self):
        def get(path, **headers):
            conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
            conn.request("GET", path, headers=headers)
            response = conn.getresponse()
            result = (response.status, dict(response.getheaders()), response.read())
            conn.close()
            return result
        photo = "/assets/images/fighters/alex-pereira.png"
        status, headers, body = get(photo, Accept="image/avif,image/webp,*/*")
        self.assertEqual((status, headers["Content-Type"], headers["Vary"]), (200, "image/webp", "Accept"))
        self.assertEqual(body, Path("assets/images/fighters/alex-pereira.webp").read_bytes())
        self.assertEqual(get(photo, Accept="image/webp", **{"If-None-Match": headers["ETag"]})[0], 304)
        status, headers, body = get(photo, Accept="image/png")
        self.assertEqual((status, headers["Vary"]), (200, "Accept"))
        self.assertEqual(body, Path("assets/images/fighters/alex-pereira.png").read_bytes())

    def test_users_can_download_and_delete_their_data(self):
        user, cookie = self.register("borrame", ["oliveira"])
        status, data, headers = self.request("GET", "/api/me/export", cookie=cookie)
        self.assertEqual(status, 200)
        self.assertIn("attachment", headers["Content-Disposition"])
        self.assertEqual((data["account"]["username"], data["following"]), ("borrame", ["oliveira"]))
        self.assertNotIn("password", json.dumps(data["account"]))
        self.assertEqual(self.request("GET", "/api/me/export")[0], 401)
        # Wrong password, or a request without the CSRF token, deletes nothing.
        self.assertEqual(self.request("POST", "/api/me/delete", {"password": "otra-contrasena-123"}, cookie, user["csrf"])[0], 401)
        self.assertEqual(self.request("POST", "/api/me/delete", {"password": "testing-password-12345"}, cookie)[0], 403)
        with self.database.connect() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM users WHERE username='borrame'").fetchone()[0], 1)
        status, data, headers = self.request("POST", "/api/me/delete", {"password": "testing-password-12345"}, cookie, user["csrf"])
        self.assertEqual((status, data["deleted"]), (200, True))
        self.assertIn("Max-Age=0", headers["Set-Cookie"])
        with self.database.connect() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM users WHERE username='borrame'").fetchone()[0], 0)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM sessions WHERE user_id=?", (user["user"]["id"],)).fetchone()[0], 0)
        self.assertIsNone(self.request("GET", "/api/auth/session", cookie=cookie)[1]["user"])
        self.assertEqual(self.request("POST", "/api/auth/login", {"username": "borrame", "password": "testing-password-12345"})[0], 401)

    def test_privacy_page_uses_the_configured_owner(self):
        with unittest.mock.patch.dict("os.environ", {"PRIVACY_OWNER": "Ana <b>Prueba</b>", "PRIVACY_CONTACT": "ana@example.com"}):
            status, body, headers = self.request("GET", "/privacidad")
        page = body.decode()
        self.assertEqual(status, 200)
        self.assertIn("Ana &lt;b&gt;Prueba&lt;/b&gt;", page)
        self.assertIn('mailto:ana@example.com', page)
        self.assertNotIn("{{", page)
        with unittest.mock.patch.dict("os.environ", {"PRIVACY_OWNER": "", "PRIVACY_CONTACT": "no es un correo"}):
            page = self.request("GET", "/privacy")[1].decode()
        self.assertIn("Pendiente de indicar", page)
        self.assertNotIn("mailto:", page)
        self.assertEqual(self.request("GET", "/privacy.html")[0], 404)
        self.assertIn(b"/privacidad", self.request("GET", "/sitemap.xml")[1])

    def test_shared_addresses_carry_their_own_title_and_photo(self):
        status, body, headers = self.request("GET", "/luchadores/ilia-topuria")
        page = body.decode()
        self.assertEqual(status, 200)
        self.assertIn("<title>Ilia Topuria", page)
        self.assertIn('<base href="/" />', page)
        self.assertIn(f'<link rel="canonical" href="{self.origin}/luchadores/ilia-topuria"', page)
        self.assertIn(f'<meta property="og:image" content="{self.origin}/assets/images/fighters/ilia-topuria.png"', page)
        self.assertIn("récord", page)
        page = self.request("GET", "/carteleras/ufc-335")[1].decode()
        self.assertIn("<title>UFC 335:", page)
        self.assertIn('og:image', page)
        for path in ["/luchadores/no-existe", "/carteleras/no-existe", "/luchadores/../server.py", "/luchadores/a/b"]:
            self.assertEqual(self.request("GET", path)[0], 404, path)
        home = self.request("GET", "/")[1].decode()
        self.assertIn(f'<link rel="canonical" href="{self.origin}/"', home)
        self.assertIn(b"/luchadores/ilia-topuria", self.request("GET", "/sitemap.xml")[1])
        page = self.request("GET", "/rankings/peso-ligero")[1].decode()
        self.assertIn("<title>Ranking UFC · Peso ligero", page)
        self.assertEqual(self.request("GET", "/rankings/no-existe")[0], 404)
        self.assertIn(b"/rankings/peso-paja-femenino", self.request("GET", "/sitemap.xml")[1])

    def test_home_preview_image_and_installable_app(self):
        home = self.request("GET", "/")[1].decode()
        self.assertIn(f'<meta property="og:image" content="{self.origin}/assets/images/brand/ufcinfo-share.jpg"', home)
        self.assertIn('rel="manifest" href="assets/manifest.webmanifest"', home)
        status, manifest, headers = self.request("GET", "/assets/manifest.webmanifest")
        self.assertEqual(status, 200)
        manifest = json.loads(manifest)
        self.assertEqual((manifest["start_url"], manifest["display"]), ("/", "standalone"))
        for icon in manifest["icons"]:
            conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
            conn.request("GET", icon["src"], headers={"Accept": "image/avif,image/webp,*/*"})
            response = conn.getresponse()
            body = response.read()
            conn.close()
            # Icons keep the PNG format the manifest declares.
            self.assertEqual((response.status, response.getheader("Content-Type"), body[:4]), (200, "image/png", b"\x89PNG"), icon["src"])
        # A shared fighter keeps its own photo instead of the generic card.
        fighter = self.request("GET", "/luchadores/ilia-topuria")[1].decode()
        self.assertNotIn("ufcinfo-share.jpg", fighter)

    def test_rate_limit(self):
        for _ in range(10):
            self.database.rate_limit("isolated-test-address", "limited")
        from server import APIError
        with self.assertRaises(APIError) as result:
            self.database.rate_limit("isolated-test-address", "limited")
        self.assertEqual(result.exception.status, 429)




class AccountMigrationTests(unittest.TestCase):
    def test_legacy_accounts_keep_password_following_and_sessions(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "old.sqlite3"
            hashed = password_hash("testing-password-12345", b"0123456789abcdef")
            with sqlite3.connect(path) as db:
                db.execute("CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, salt BLOB NOT NULL, password BLOB NOT NULL, favorites TEXT NOT NULL DEFAULT '[]', revision INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL)")
                db.execute("INSERT INTO users VALUES (?,?,?,?,?,?,?)", ("legacy", "old@example.test", b"0123456789abcdef", hashed, '["topuria"]', 2, 1))
                db.execute("CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), csrf TEXT NOT NULL, expires_at INTEGER NOT NULL)")
                db.execute("INSERT INTO sessions VALUES ('token', 'legacy', 'csrf', 9999999999)")
            database = Database(path)
            Database(path)  # Migration is safe to repeat on restart.
            with database.connect() as db:
                row = db.execute("SELECT * FROM users WHERE id='legacy'").fetchone()
                self.assertEqual(row["username"], "old@example.test")
                self.assertEqual(row["password"], hashed)
                self.assertEqual(json.loads(row["favorites"]), ["topuria"])
                self.assertEqual(db.execute("SELECT user_id FROM sessions").fetchone()[0], "legacy")
                with self.assertRaises(sqlite3.IntegrityError):
                    db.execute("INSERT INTO users VALUES (?,?,?,?,?,?,?)", ("duplicate", "OLD@example.test", row["salt"], hashed, '[]', 0, 1))

if __name__ == "__main__":
    unittest.main()
