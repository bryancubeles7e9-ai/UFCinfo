"""Octagon website and same-origin account API. Python standard library only."""
import argparse
from datetime import datetime
import gzip
import hashlib
import hmac
import json
import os
import re
import secrets
import shutil
import tempfile
import sqlite3
import threading
import time
import uuid
from contextlib import contextmanager
from html import escape
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, unquote, parse_qs
from pickem import Competition, PickemError
from adsense import publisher_id, ads_txt

ROOT = Path(__file__).resolve().parent
SESSION_SECONDS = 30 * 24 * 60 * 60
COOKIE = "octagon_session"
MAX_BODY = 16_384
MIN_FREE_DISK = 50 * 1024 * 1024
CLIENT_ERROR_LIMIT = (20, 500)  # Per address and in total, per hour.
# Text assets are sent gzip-compressed: the fighter catalogue alone drops from about 1 MB to under 200 KB.
COMPRESSIBLE = {".js", ".mjs", ".css", ".json", ".html", ".svg", ".txt", ".xml", ".webmanifest"}
_compressed = {}
_compressed_lock = threading.Lock()


def compressed_file(target):
    """Returns (gzip bytes, etag) for a file, reusing the result until the file changes."""
    stat = target.stat()
    key = (stat.st_mtime_ns, stat.st_size)
    with _compressed_lock:
        cached = _compressed.get(target)
    if cached and cached[0] == key:
        return cached[1], cached[2]
    payload = gzip.compress(target.read_bytes(), compresslevel=6, mtime=0)
    etag = f'W/"{stat.st_mtime_ns:x}-{stat.st_size:x}"'
    with _compressed_lock:
        _compressed[target] = (key, payload, etag)
    return payload, etag


_share = {"key": None, "data": {}}


def share_index():
    """assets/data/share-index.json (built by scripts/build-share-index.mjs), reloaded when it changes."""
    target = ROOT / "assets/data/share-index.json"
    try:
        stat = target.stat()
        key = (stat.st_mtime_ns, stat.st_size)
        if _share["key"] != key:
            _share.update(key=key, data=json.loads(target.read_text()))
    except (OSError, ValueError):
        return {}
    return _share["data"]


_poster = {"key": None, "value": None}


def home_poster():
    """Poster of the next main event, preloaded on the home page because it is the largest image."""
    target = ROOT / "assets/data/ufc-events.json"
    try:
        stat = target.stat()
        key = (stat.st_mtime_ns, stat.st_size, int(time.time() // 600))
        if _poster["key"] != key:
            now = time.time()
            events = [e for e in json.loads(target.read_text()).get("events", [])
                      if e.get("type") == "official" and e.get("status") in ("live", "scheduled", "announced")]
            def starts(event):
                try:
                    return datetime.fromisoformat(event["date"].replace("Z", "+00:00")).timestamp()
                except (KeyError, ValueError):
                    return float("inf")
            events = sorted((e for e in events if e.get("status") == "live" or starts(e) > now - 6 * 3600),
                            key=lambda e: (e.get("status") != "live", starts(e)))
            poster = events[0].get("poster") if events else None
            _poster.update(key=key, value=poster if isinstance(poster, str) and re.fullmatch(r"assets/images/events/[\w.-]+", poster) else None)
    except (OSError, ValueError):
        return None
    return _poster["value"]


def share_pages():
    data = share_index()
    return ([f"luchadores/{slug}" for slug in data.get("fighters", {})] + [f"carteleras/{slug}" for slug in data.get("events", {})]
            + [f"rankings/{slug}" for slug in data.get("rankings", {})])


def accepts_gzip(header):
    for part in (header or "").split(","):
        name, _, params = part.strip().partition(";")
        if name.strip().lower() in {"gzip", "*"}:
            return params.replace(" ", "").lower() not in {"q=0", "q=0.0", "q=0.00", "q=0.000"}
    return False


def password_hash(password, salt):
    return hashlib.scrypt(password.encode(), salt=salt, n=131072, r=8, p=1, maxmem=256 * 1024 * 1024)


class APIError(Exception):
    def __init__(self, status, message, **fields):
        self.status, self.body = status, {"error": message, **fields}


class Database:
    def __init__(self, path):
        self.path = str(path)
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript("""
              PRAGMA journal_mode=WAL;
              CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, salt BLOB NOT NULL,
                password BLOB NOT NULL, favorites TEXT NOT NULL DEFAULT '[]',
                revision INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL);
              CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
                csrf TEXT NOT NULL, expires_at INTEGER NOT NULL);
              CREATE INDEX IF NOT EXISTS session_user ON sessions(user_id);
              CREATE TABLE IF NOT EXISTS auth_attempts (
                scope TEXT NOT NULL, at INTEGER NOT NULL);
              CREATE INDEX IF NOT EXISTS attempt_scope ON auth_attempts(scope, at);
            """)
            # Upgrade existing email accounts without changing IDs, passwords or sessions.
            columns = {row["name"] for row in db.execute("PRAGMA table_info(users)")}
            if "email" in columns and "username" not in columns:
                db.execute("ALTER TABLE users RENAME COLUMN email TO username")
            db.execute("CREATE UNIQUE INDEX IF NOT EXISTS unique_username ON users(username COLLATE NOCASE)")
        os.chmod(self.path, 0o600)

    def health(self):
        checks = {}
        try:
            with self.connect() as db:
                db.execute("SELECT COUNT(*) FROM users").fetchone()
                checks["database"] = True
                db.execute("BEGIN IMMEDIATE")  # Proves the write lock is available; rolled back below.
                db.rollback()
                checks["writable"] = True
        except sqlite3.Error:
            checks.setdefault("database", False)
            checks.setdefault("writable", False)
        free = shutil.disk_usage(Path(self.path).parent).free
        checks["disk"] = free >= MIN_FREE_DISK
        return all(checks.values()), {**checks, "freeMB": free // (1024 * 1024)}

    def backup_bytes(self):
        """A consistent copy of the live database, taken without stopping the site."""
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "backup.sqlite3"
            source, copy = sqlite3.connect(self.path, timeout=10), sqlite3.connect(target)
            try:
                source.backup(copy)
            finally:
                copy.close(); source.close()
            return target.read_bytes()

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        try:
            with db:
                yield db
        finally:
            db.close()

    def rate_limit(self, ip, username):
        now = int(time.time())
        scopes = [("ip:" + ip, 30), ("username:" + username, 10)]
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            db.execute("DELETE FROM auth_attempts WHERE at < ?", (now - 900,))
            for scope, maximum in scopes:
                count = db.execute("SELECT COUNT(*) FROM auth_attempts WHERE scope=?", (scope,)).fetchone()[0]
                if count >= maximum:
                    raise APIError(429, "Demasiados intentos. Espera 15 minutos antes de volver a intentarlo.")
            db.executemany("INSERT INTO auth_attempts VALUES (?, ?)", [(scope, now) for scope, _ in scopes])


def make_handler(database, public_origin, fighter_ids):
    secure = public_origin.startswith("https://")
    allowed_origins = {public_origin}
    parsed = urlsplit(public_origin)
    if parsed.hostname in {"localhost", "127.0.0.1"}:
        allowed_origins.add(f"{parsed.scheme}://{'localhost' if parsed.hostname == '127.0.0.1' else '127.0.0.1'}:{parsed.port}")
    allowed_hosts = {urlsplit(origin).netloc for origin in allowed_origins}
    password_slots = threading.BoundedSemaphore(2)
    competition = Competition(database, ROOT / "assets/data/ufc-events.json")
    client_errors = {"window": 0, "total": 0, "by_address": {}}
    client_errors_lock = threading.Lock()

    def accept_client_error(address):
        """Hourly caps keep a broken page or a script from flooding the logs."""
        hour = int(time.time() // 3600)
        with client_errors_lock:
            if client_errors["window"] != hour:
                client_errors.update(window=hour, total=0, by_address={})
            per_address = client_errors["by_address"].get(address, 0)
            if per_address >= CLIENT_ERROR_LIMIT[0] or client_errors["total"] >= CLIENT_ERROR_LIMIT[1]:
                return False
            client_errors["by_address"][address] = per_address + 1
            client_errors["total"] += 1
            return True

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(ROOT), **kwargs)

        def end_headers(self):
            # Assets use stable URLs: revalidate after deployments to avoid mixing versions.
            if urlsplit(self.path).path.startswith('/assets/fonts/'):
                # Font files carry a content hash in their name, so they never change.
                self.send_header('Cache-Control', 'public, max-age=31536000, immutable')
            elif urlsplit(self.path).path.startswith('/assets/images/fighter-variants/'):
                # Named after a hash of their content.
                self.send_header('Cache-Control', 'public, max-age=31536000, immutable')
            elif urlsplit(self.path).path.startswith('/assets/images/'):
                # Photos rarely change: reuse them for an hour, then refresh them in the background.
                self.send_header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=604800')
            elif urlsplit(self.path).path.startswith('/assets/'):
                self.send_header('Cache-Control', 'no-cache')
            if urlsplit(self.path).path == '/assets/sw.js':
                self.send_header('Service-Worker-Allowed', '/')
            if getattr(self, 'vary', None):
                # The same photo URL may be answered with a WebP copy for other browsers.
                self.send_header('Vary', self.vary)
                self.vary = None
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
            self.send_header("X-Frame-Options", "SAMEORIGIN")
            super().end_headers()

        def log_message(self, format, *args):
            # API URLs contain no credentials; do not log request bodies or cookies.
            super().log_message(format, *args)

        def json_response(self, status, body, cookie=None):
            payload = json.dumps(body, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(payload)))
            if cookie:
                self.send_header("Set-Cookie", cookie)
            self.end_headers()
            self.wfile.write(payload)

        def cookie(self, token="", clear=False):
            return f"{COOKIE}={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={0 if clear else SESSION_SECONDS}" + ("; Secure" if secure else "")

        def session_token(self):
            try:
                cookie = SimpleCookie(self.headers.get("Cookie", ""))
                return cookie[COOKIE].value if COOKIE in cookie else ""
            except Exception:
                return ""

        def session(self, required=True):
            token = self.session_token()
            with database.connect() as db:
                row = db.execute("""SELECT users.*, sessions.csrf FROM sessions JOIN users ON users.id=sessions.user_id
                  WHERE token_hash=? AND expires_at>?""", (hashlib.sha256(token.encode()).hexdigest(), int(time.time()))).fetchone() if token else None
            if required and not row:
                raise APIError(401, "Inicia sesión para guardar en tu cuenta.")
            return row

        def body(self):
            if self.headers.get_content_type() != "application/json":
                raise APIError(415, "Envía los datos como JSON.")
            try:
                size = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                raise APIError(400, "Solicitud no válida.")
            if not 0 < size <= MAX_BODY:
                raise APIError(413, "Solicitud demasiado grande o vacía.")
            try:
                data = json.loads(self.rfile.read(size))
                if not isinstance(data, dict):
                    raise ValueError()
                return data
            except (ValueError, UnicodeDecodeError):
                raise APIError(400, "Datos JSON no válidos.")

        def favorites(self, data):
            ids = data.get("favorites")
            if not isinstance(ids, list) or len(ids) > len(fighter_ids) or any(not isinstance(i, str) or i not in fighter_ids for i in ids) or len(set(ids)) != len(ids):
                raise APIError(400, "La lista de luchadores no es válida.")
            return ids

        def user_response(self, row):
            return {"user": {"id": row["id"], "username": row["username"]}, "csrf": row["csrf"],
                    "favorites": json.loads(row["favorites"]), "revision": row["revision"], "updatedAt": row["updated_at"]}

        def verify_origin(self):
            if self.headers.get("Host") not in allowed_hosts:
                raise APIError(403, "Origen no permitido.")
            if self.command != "GET" and self.headers.get("Origin") not in allowed_origins:
                raise APIError(403, "Origen no permitido.")
            if self.headers.get("Sec-Fetch-Site") == "cross-site":
                raise APIError(403, "Origen no permitido.")

        def handle_api(self):
            try:
                path = urlsplit(self.path).path
                if self.command == "GET" and path == "/api/health":
                    return self.json_response(200, {"ok": True})
                if self.command == "GET" and path == "/api/health/full":
                    # Liveness stays minimal for Render; this one is for the external uptime monitor.
                    ok, checks = database.health()
                    return self.json_response(200 if ok else 503, {"ok": ok, **checks})
                if self.command == "GET" and path == "/api/admin/backup":
                    # Only for the backup workflow; disabled unless the server has a token.
                    expected = os.environ.get("OCTAGON_BACKUP_TOKEN", "")
                    supplied = self.headers.get("Authorization", "").removeprefix("Bearer ")
                    if len(expected) < 32 or not hmac.compare_digest(supplied.encode(), expected.encode()):
                        raise APIError(404, "Ruta no disponible.")
                    payload = database.backup_bytes()
                    self.send_response(200)
                    self.send_header("Content-Type", "application/vnd.sqlite3")
                    self.send_header("Cache-Control", "no-store")
                    self.send_header("Content-Length", str(len(payload)))
                    self.end_headers()
                    return self.wfile.write(payload)
                self.verify_origin()
                if self.command == "POST" and path == "/api/client-errors":
                    data = self.body()
                    if accept_client_error(self.client_address[0]):
                        fields = {key: str(data.get(key, ""))[:limit] for key, limit in
                                  (("message", 300), ("source", 200), ("view", 40), ("browser", 160))}
                        for key in ("line", "column"):
                            fields[key] = data.get(key) if isinstance(data.get(key), int) and 0 <= data[key] < 10_000_000 else None
                        # One JSON line per error, without cookies, IP addresses or request bodies.
                        print("client_error " + json.dumps(fields, ensure_ascii=False), flush=True)
                    return self.json_response(202, {"ok": True})
                if self.command == "GET" and path == "/api/pickem/state":
                    row = self.session(False)
                    return self.json_response(200, competition.state(row["id"] if row else None))
                if self.command == "GET" and path == "/api/pickem/ranking":
                    query = parse_qs(urlsplit(self.path).query)
                    scope = query.get("scope", ["all"])[0]
                    try:
                        page = int(query.get("page", ["1"])[0])
                        if not 1 <= page <= 100000: raise ValueError()
                    except ValueError:
                        raise APIError(400, "Página no válida.")
                    row = self.session(False)
                    return self.json_response(200, competition.leaderboard(scope, page, row["id"] if row else None))
                if self.command == "PUT" and path == "/api/me/pickem":
                    row = self.session()
                    if not hmac.compare_digest(self.headers.get("X-Octagon-CSRF", ""), row["csrf"]):
                        raise APIError(403, "La sesión no pudo validar la solicitud.")
                    return self.json_response(200, competition.save(row["id"], self.body()))
                if self.command == "GET" and path == "/api/auth/session":
                    row = self.session(False)
                    return self.json_response(200, self.user_response(row) if row else {"user": None})
                if self.command == "GET" and path == "/api/me/following":
                    return self.json_response(200, self.user_response(self.session()))
                if self.command == "POST" and path in {"/api/auth/register", "/api/auth/login"}:
                    data = self.body()
                    username, password = data.get("username"), data.get("password")
                    if not isinstance(username, str) or not isinstance(password, str):
                        raise APIError(400, "Introduce nombre de usuario y contraseña.")
                    username = username.strip().lower()
                    registering = path.endswith("register")
                    # Existing email accounts retain their original identifier for login.
                    if len(password) > 256 or not username or len(username) > 254:
                        raise APIError(400, "Nombre de usuario o contraseña no válidos.")
                    if registering and not re.fullmatch(r"[a-z0-9_\-]{3,24}", username):
                        raise APIError(400, "El nombre de usuario debe tener entre 3 y 24 caracteres: letras, números, guiones o guiones bajos.")
                    if registering and len(password) < 12:
                        raise APIError(400, "La contraseña debe tener al menos 12 caracteres.")
                    initial = self.favorites({"favorites": data.get("favorites", [])}) if registering else []
                    database.rate_limit(self.client_address[0], username)
                    if not password_slots.acquire(blocking=False):
                        raise APIError(503, "El servidor está ocupado. Inténtalo de nuevo.")
                    try:
                        with database.connect() as db:
                            existing = db.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
                        salt = existing["salt"] if existing and not registering else secrets.token_bytes(16)
                        hashed = password_hash(password, salt)
                        if registering:
                            user_id = str(uuid.uuid4())
                            try:
                                with database.connect() as db:
                                    db.execute("INSERT INTO users (id,username,salt,password,favorites,updated_at) VALUES (?,?,?,?,?,?)", (user_id,username,salt,hashed,json.dumps(initial),int(time.time())))
                            except sqlite3.IntegrityError:
                                raise APIError(409, "Este nombre de usuario ya está registrado. Elige otro o inicia sesión.")
                        else:
                            if not existing or not hmac.compare_digest(hashed, existing["password"]):
                                raise APIError(401, "Nombre de usuario o contraseña incorrectos.")
                            user_id = existing["id"]
                    finally:
                        password_slots.release()
                    token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
                    with database.connect() as db:
                        db.execute("DELETE FROM sessions WHERE expires_at<=?", (int(time.time()),))
                        old = self.session_token()
                        if old:
                            db.execute("DELETE FROM sessions WHERE token_hash=?", (hashlib.sha256(old.encode()).hexdigest(),))
                        db.execute("INSERT INTO sessions VALUES (?,?,?,?)", (hashlib.sha256(token.encode()).hexdigest(),user_id,csrf,int(time.time())+SESSION_SECONDS))
                        row = dict(db.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone())
                        row["csrf"] = csrf
                    return self.json_response(201 if registering else 200, self.user_response(row), self.cookie(token))
                if self.command == "GET" and path == "/api/me/export":
                    # Right of access: everything the server keeps about the account, as a JSON download.
                    row = self.session()
                    with database.connect() as db:
                        tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
                        alias = db.execute("SELECT alias FROM pickem_profiles WHERE user_id=?", (row["id"],)).fetchone() if "pickem_profiles" in tables else None
                        entries = [{"event": e["event_id"], "picks": json.loads(e["picks"]), "updatedAt": e["updated_at"]}
                                   for e in db.execute("SELECT * FROM pickem_entries WHERE user_id=? ORDER BY updated_at", (row["id"],))] if "pickem_entries" in tables else []
                    payload = json.dumps({"exportedAt": int(time.time()), "account": {"username": row["username"], "updatedAt": row["updated_at"]},
                                          "following": json.loads(row["favorites"]), "pickem": {"alias": alias[0] if alias else None, "entries": entries},
                                          "note": "Las contraseñas se guardan solo como huella cifrada (scrypt) y no se pueden recuperar."},
                                         ensure_ascii=False, indent=2).encode()
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.send_header("Content-Disposition", 'attachment; filename="ufcinfo-mis-datos.json"')
                    self.send_header("Cache-Control", "no-store")
                    self.send_header("Content-Length", str(len(payload)))
                    self.end_headers()
                    return self.wfile.write(payload)
                if self.command == "POST" and path == "/api/me/delete":
                    # Right to erasure: the password confirms the request; everything linked to the account goes.
                    row = self.session()
                    if not hmac.compare_digest(self.headers.get("X-Octagon-CSRF", ""), row["csrf"]):
                        raise APIError(403, "La sesión no pudo validar la solicitud.")
                    password = self.body().get("password")
                    if not isinstance(password, str) or not password or len(password) > 256:
                        raise APIError(400, "Escribe tu contraseña para confirmar.")
                    database.rate_limit(self.client_address[0], row["username"])
                    if not password_slots.acquire(blocking=False):
                        raise APIError(503, "El servidor está ocupado. Inténtalo de nuevo.")
                    try:
                        with database.connect() as db:
                            account = db.execute("SELECT salt,password FROM users WHERE id=?", (row["id"],)).fetchone()
                        if not account or not hmac.compare_digest(password_hash(password, account["salt"]), account["password"]):
                            raise APIError(401, "La contraseña no es correcta.")
                    finally:
                        password_slots.release()
                    with database.connect() as db:
                        tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
                        for table in ("pickem_entries", "pickem_profiles"):
                            if table in tables:
                                db.execute(f"DELETE FROM {table} WHERE user_id=?", (row["id"],))
                        db.execute("DELETE FROM sessions WHERE user_id=?", (row["id"],))
                        db.execute("DELETE FROM users WHERE id=?", (row["id"],))
                    return self.json_response(200, {"user": None, "deleted": True}, self.cookie(clear=True))
                if (self.command, path) in {("POST", "/api/auth/logout"), ("PUT", "/api/me/following")}:
                    row = self.session()
                    if not hmac.compare_digest(self.headers.get("X-Octagon-CSRF", ""), row["csrf"]):
                        raise APIError(403, "La sesión no pudo validar la solicitud.")
                    data = self.body()
                    if path.endswith("logout"):
                        with database.connect() as db:
                            db.execute("DELETE FROM sessions WHERE token_hash=?", (hashlib.sha256(self.session_token().encode()).hexdigest(),))
                        return self.json_response(200, {"user": None}, self.cookie(clear=True))
                    favorites = self.favorites(data)
                    revision = data.get("revision")
                    if type(revision) is not int or revision < 0:
                        raise APIError(400, "Versión de seguimiento no válida.")
                    with database.connect() as db:
                        cursor = db.execute("UPDATE users SET favorites=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?", (json.dumps(favorites),int(time.time()),row["id"],revision))
                        latest = dict(db.execute("SELECT * FROM users WHERE id=?", (row["id"],)).fetchone())
                        latest["csrf"] = row["csrf"]
                    if cursor.rowcount != 1:
                        raise APIError(409, "Hay cambios desde otro dispositivo.", **self.user_response(latest))
                    return self.json_response(200, self.user_response(latest))
                raise APIError(404, "Ruta no disponible.")
            except (APIError, PickemError) as error:
                self.json_response(error.status, error.body)
            except (sqlite3.Error, OSError, ValueError):
                self.json_response(500, {"error": "No se pudieron guardar los datos. Inténtalo de nuevo."})

        def do_GET(self):
            if urlsplit(self.path).path.startswith("/api/"):
                return self.handle_api()
            if self.headers.get("Host") not in allowed_hosts:
                return self.send_error(403)
            path = unquote(urlsplit(self.path).path)
            if path == '/ads.txt':
                client = publisher_id(ROOT)
                if not client:
                    return self.send_error(404)
                payload = ads_txt(client).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'text/plain; charset=utf-8')
                self.send_header('Cache-Control', 'no-cache')
                self.send_header('Content-Length', str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                return
            share = re.fullmatch(r"/(luchadores|carteleras|rankings)/([a-z0-9-]{1,120})/?", path)
            if share:
                # Shareable fighter or event address: the app opens that profile or card,
                # and the page carries its own title, description and photo for previews.
                section = {"luchadores": "fighters", "carteleras": "events", "rankings": "rankings"}[share[1]]
                entry = share_index().get(section, {}).get(share[2])
                if not entry:
                    return self.send_error(404)
                home = public_origin.rstrip("/") + "/"
                payload = self.index_page(home, f"{home}{share[1]}/{share[2]}", entry).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Vary", "Accept-Encoding")
                if accepts_gzip(self.headers.get("Accept-Encoding")):
                    payload = gzip.compress(payload, compresslevel=6, mtime=0)
                    self.send_header("Content-Encoding", "gzip")
                self.send_header("Content-Length", str(len(payload)))
                self.send_header("Cache-Control", "no-cache")
                self.end_headers()
                self.wfile.write(payload)
                return
            if path in {"/privacidad", "/privacy"}:
                # Owner and contact come from Render's settings (PRIVACY_OWNER, PRIVACY_CONTACT), not from the repository.
                owner = os.environ.get("PRIVACY_OWNER", "").strip() or "Pendiente de indicar"
                contact = os.environ.get("PRIVACY_CONTACT", "").strip()
                if not re.fullmatch(r"[^@\s<>\"']+@[^@\s<>\"']+\.[a-z]{2,}", contact, re.I):
                    contact = ""
                body = (ROOT / "privacy.html").read_text().replace("{{OWNER}}", escape(owner))
                body = body.replace('<a href="mailto:{{CONTACT}}">{{CONTACT}}</a>', f'<a href="mailto:{escape(contact, quote=True)}">{escape(contact)}</a>' if contact else "pendiente de indicar")
                payload = body.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Cache-Control", "no-cache")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                return
            if path in {"/", "/index.html", "/robots.txt", "/sitemap.xml"}:
                home = public_origin.rstrip("/") + "/"
                if path == "/robots.txt":
                    body = f"User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: {home}sitemap.xml\n"
                    content_type = "text/plain; charset=utf-8"
                elif path == "/sitemap.xml":
                    body = '<?xml version="1.0" encoding="UTF-8"?>\n' + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + "".join(f"<url><loc>{escape(home + page)}</loc></url>" for page in ["", "privacidad", *share_pages()]) + "</urlset>\n"
                    content_type = "application/xml; charset=utf-8"
                else:
                    body = self.index_page(home, home)
                    metadata = ''
                    verification = os.environ.get("GOOGLE_SITE_VERIFICATION", "")
                    if verification:
                        metadata += f'\n<meta name="google-site-verification" content="{escape(verification, quote=True)}" />'
                    client = publisher_id(ROOT)
                    if client:
                        metadata += f'\n<meta name="google-adsense-account" content="{client}" />'
                    body = body.replace("</head>", metadata + "\n</head>", 1)
                    content_type = "text/html; charset=utf-8"
                payload = body.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", content_type)
                self.send_header("Vary", "Accept-Encoding")
                if accepts_gzip(self.headers.get("Accept-Encoding")):
                    payload = gzip.compress(payload, compresslevel=6, mtime=0)
                    self.send_header("Content-Encoding", "gzip")
                self.send_header("Content-Length", str(len(payload)))
                self.send_header("Cache-Control", "no-cache")
                self.end_headers()
                self.wfile.write(payload)
                return
            # Publish only website assets, never database, source, hidden files or listings.
            relative = Path(path.lstrip("/"))
            target = (ROOT / relative).resolve()
            if ".." in relative.parts or any(part.startswith(".") for part in relative.parts) or not target.is_relative_to(ROOT):
                return self.send_error(404)
            if path not in {"/", "/index.html"} and not (path.startswith("/assets/") and target.is_file()):
                return self.send_error(404)
            if target.suffix.lower() in COMPRESSIBLE and accepts_gzip(self.headers.get("Accept-Encoding")):
                try:
                    payload, etag = compressed_file(target)
                except OSError:
                    return self.send_error(404)
                return self.send_asset(target, payload, etag, "Accept-Encoding", encoding="gzip")
            # Photos have a lighter WebP copy (scripts/optimize-images.py) for browsers that accept it.
            webp = target.with_suffix(".webp")
            if target.suffix.lower() in {".png", ".jpg", ".jpeg"} and "image/webp" in self.headers.get("Accept", "") and webp.is_file() and "/brand/" not in path:
                try:
                    stat = webp.stat()
                    payload = webp.read_bytes()
                except OSError:
                    return super().do_GET()
                return self.send_asset(webp, payload, f'W/"{stat.st_mtime_ns:x}-{stat.st_size:x}"', "Accept")
            if target.suffix.lower() in {".png", ".jpg", ".jpeg"}:
                self.vary = "Accept"
            return super().do_GET()

        def send_asset(self, target, payload, etag, vary, encoding=None):
            # The ETag lets returning visitors revalidate without downloading the file again.
            if etag in {tag.strip() for tag in self.headers.get("If-None-Match", "").split(",")}:
                self.send_response(304)
                self.send_header("ETag", etag)
                self.send_header("Vary", vary)
                self.end_headers()
                return
            self.send_response(200)
            self.send_header("Content-Type", self.guess_type(str(target)))
            if encoding:
                self.send_header("Content-Encoding", encoding)
            self.send_header("Vary", vary)
            self.send_header("ETag", etag)
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def index_page(self, home, url, entry=None):
            """index.html with absolute asset paths and, for shared addresses, that page's own metadata."""
            body = (ROOT / "index.html").read_text()
            # Shared addresses live below /, so relative asset paths must resolve from the root.
            body = body.replace('<meta charset="utf-8" />', '<meta charset="utf-8" />\n    <base href="/" />', 1)
            metadata = f'<link rel="canonical" href="{escape(url, quote=True)}" />\n<meta property="og:url" content="{escape(url, quote=True)}" />'
            poster = home_poster()
            if poster and not entry:
                metadata += f'\n<link rel="preload" as="image" href="/{escape(poster, quote=True)}" fetchpriority="high" />'
            # Shared links always carry an image: the page's own photo, or the UFCinfo card.
            if not (entry and entry.get("image")):
                metadata += (f'\n<meta property="og:image" content="{escape(home, quote=True)}assets/images/brand/ufcinfo-share.jpg" />'
                             '\n<meta property="og:image:width" content="1200" />\n<meta property="og:image:height" content="630" />'
                             '\n<meta property="og:image:alt" content="UFCinfo: carteleras, luchadores, rankings y Pick’em de UFC" />'
                             '\n<meta name="twitter:card" content="summary_large_image" />')
            if entry:
                title, description = escape(entry["title"]), escape(entry["description"], quote=True)
                body = re.sub(r"<title>.*?</title>", f"<title>{title}</title>", body, count=1, flags=re.S)
                body = re.sub(r'(<meta\s+name="description"\s+content=")[^"]*', lambda m: m[1] + description, body, count=1)
                body = re.sub(r'(<meta property="og:title" content=")[^"]*', lambda m: m[1] + escape(entry["title"], quote=True), body, count=1)
                body = re.sub(r'(<meta property="og:description" content=")[^"]*', lambda m: m[1] + description, body, count=1)
                body = body.replace('<meta property="og:type" content="website" />', '<meta property="og:type" content="profile" />' if "/luchadores/" in url else '<meta property="og:type" content="website" />', 1)
                image = entry.get("image")
                if image:
                    image = image if image.startswith("https://") else home + image.lstrip("/")
                    metadata += f'\n<meta property="og:image" content="{escape(image, quote=True)}" />\n<meta name="twitter:card" content="summary_large_image" />'
            return body.replace("</head>", metadata + "\n</head>", 1)

        def send_error(self, code, message=None, explain=None):
            # Visitors who follow a broken link get a branded page instead of Python's default one.
            if code == 404 and self.command == "GET" and not urlsplit(self.path).path.startswith("/api/"):
                try:
                    payload = (ROOT / "assets/404.html").read_bytes()
                except OSError:
                    return super().send_error(code, message, explain)
                self.send_response(404)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Cache-Control", "no-cache")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                return
            return super().send_error(code, message, explain)

        def do_HEAD(self):
            # Avoid SimpleHTTPRequestHandler bypassing the static-file allowlist.
            self.send_error(405)

        def do_POST(self):
            self.handle_api()

        def do_PUT(self):
            self.handle_api()

    return Handler


def fighter_ids():
    initial = json.loads((ROOT / "docs/fighter-details-sources.json").read_text())
    additional = json.loads((ROOT / "docs/fighter-directory-sources.json").read_text())
    return set(initial) | {f["id"] for f in additional}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8780)
    parser.add_argument("--database", default=str(ROOT / ".ufcinfo-data/accounts.sqlite3"))
    parser.add_argument("--public-origin", default=os.environ.get("OCTAGON_PUBLIC_ORIGIN") or os.environ.get("RENDER_EXTERNAL_URL"))
    args = parser.parse_args()
    origin = args.public_origin or f"http://127.0.0.1:{args.port}"
    parsed = urlsplit(origin)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc or parsed.path or parsed.query or parsed.fragment:
        parser.error("--public-origin must be an origin such as https://octagon.example.com")
    if parsed.hostname not in {"127.0.0.1", "localhost", "::1"} and parsed.scheme != "https":
        parser.error("Public accounts require an HTTPS origin.")
    if args.host not in {"127.0.0.1", "localhost", "::1"} and not args.public_origin:
        parser.error("A public listener requires --public-origin; use HTTPS through a reverse proxy.")
    server = ThreadingHTTPServer((args.host, args.port), make_handler(Database(args.database), origin, fighter_ids()))
    print(f"Octagon: {origin} — database: {args.database}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()


if __name__ == "__main__":
    main()

