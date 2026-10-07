"""Octagon website and same-origin account API. Python standard library only."""
import argparse
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import threading
import time
import uuid
from contextlib import contextmanager
from html import escape
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parent
SESSION_SECONDS = 30 * 24 * 60 * 60
COOKIE = "octagon_session"
MAX_BODY = 16_384


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

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(ROOT), **kwargs)

        def end_headers(self):
            # Assets use stable URLs: revalidate after deployments to avoid mixing versions.
            if urlsplit(self.path).path.startswith('/assets/'):
                self.send_header('Cache-Control', 'no-cache')
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
                self.verify_origin()
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
            except APIError as error:
                self.json_response(error.status, error.body)
            except (sqlite3.Error, OSError, ValueError):
                self.json_response(500, {"error": "No se pudieron guardar los datos. Inténtalo de nuevo."})

        def do_GET(self):
            if urlsplit(self.path).path.startswith("/api/"):
                return self.handle_api()
            if self.headers.get("Host") not in allowed_hosts:
                return self.send_error(403)
            path = unquote(urlsplit(self.path).path)
            if path in {"/", "/index.html", "/robots.txt", "/sitemap.xml"}:
                home = public_origin.rstrip("/") + "/"
                if path == "/robots.txt":
                    body = f"User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: {home}sitemap.xml\n"
                    content_type = "text/plain; charset=utf-8"
                elif path == "/sitemap.xml":
                    body = '<?xml version="1.0" encoding="UTF-8"?>\n' + f'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>{escape(home)}</loc></url></urlset>\n'
                    content_type = "application/xml; charset=utf-8"
                else:
                    body = (ROOT / "index.html").read_text()
                    metadata = f'<link rel="canonical" href="{escape(home, quote=True)}" />\n<meta property="og:url" content="{escape(home, quote=True)}" />'
                    verification = os.environ.get("GOOGLE_SITE_VERIFICATION", "")
                    if verification:
                        metadata += f'\n<meta name="google-site-verification" content="{escape(verification, quote=True)}" />'
                    body = body.replace("</head>", metadata + "\n</head>", 1)
                    content_type = "text/html; charset=utf-8"
                payload = body.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", content_type)
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
            return super().do_GET()

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
    parser.add_argument("--database", default=str(ROOT / ".octagon-data/accounts.sqlite3"))
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
