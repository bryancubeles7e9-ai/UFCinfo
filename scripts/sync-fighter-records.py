"""Refresh only UFCinfo fighters who appeared on newly completed cards.

The committed fighter-records.json is a cursor as well as a small override feed.
No key means no network access or changes. Unrecognized API responses are never
published. The old profile snapshots remain the fallback in the browser.
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
import re
import sys
import tempfile
import unicodedata
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
EVENTS = ROOT / "assets/data/ufc-events.json"
STATE = ROOT / "assets/data/fighter-records.json"
BASE = "https://v1.mma.api-sports.io"
MAX_REQUESTS = 80  # Keep headroom under the free daily limit of 100.


def normalize(name):
    return re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower())


def api_name(row):
    name = row.get("name")
    if isinstance(name, str):
        return name
    if isinstance(name, dict):
        return " ".join(str(name.get(k) or "") for k in ("first", "last")).strip()
    return " ".join(str(row.get(k) or "") for k in ("first", "last")).strip()


def record_from_row(row):
    """Accept only an explicit career V-D-E triple, never infer from a fight."""
    total = row.get("total")
    if isinstance(total, dict):
        values = [total.get(k) for k in ("win", "loss", "draw")]
        if all(isinstance(v, int) and not isinstance(v, bool) and 0 <= v <= 200 for v in values):
            return "-".join(map(str, values))
    candidates = [row]
    for key in ("record", "records"):
        if isinstance(row.get(key), dict):
            candidates.append(row[key])
    for item in candidates:
        if all(key in item for key in ("wins", "losses", "draws")):
            values = []
            for key in ("wins", "losses", "draws"):
                value = item[key]
                if isinstance(value, dict):
                    value = value.get("total")
                if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= 200:
                    break
                values.append(value)
            if len(values) == 3:
                return "-".join(map(str, values))
        value = item.get("record")
        if isinstance(value, str) and re.fullmatch(r"\d{1,3}-\d{1,3}-\d{1,3}", value):
            return value
    raise ValueError("API record has no valid career V-D-E triple")


class Client:
    def __init__(self, key, limit=MAX_REQUESTS):
        self.key, self.limit, self.used = key, limit, 0

    def get(self, endpoint, **params):
        if self.used >= self.limit:
            raise RuntimeError("Daily request budget reached")
        self.used += 1  # Count even rejected and failed requests.
        request = Request(BASE + endpoint + "?" + urlencode(params), headers={"x-apisports-key": self.key, "Accept": "application/json"})
        with urlopen(request, timeout=20) as response:
            payload = json.load(response)
        if not isinstance(payload, dict) or payload.get("errors") or not isinstance(payload.get("response"), list):
            raise ValueError("API error or unexpected response")
        return payload["response"]


def resolve(client, name):
    rows = client.get("/fighters", search=name)
    matches = [row for row in rows if isinstance(row, dict) and normalize(api_name(row)) == normalize(name)]
    if len(matches) != 1 or isinstance(matches[0].get("id"), bool) or not isinstance(matches[0].get("id"), int):
        raise ValueError("Fighter identity missing or ambiguous: " + name)
    return matches[0]["id"]


def fighter_names():
    """The curated directory determines which profiles the site can display."""
    import subprocess

    output = subprocess.check_output(["node", "--input-type=module", "-e", """
      import { fighters } from './assets/js/data.js';
      import { additionalFighters } from './assets/js/fighter-directory-data.js';
      console.log(JSON.stringify([...fighters, ...additionalFighters].map(f =>
        ({id:f.id, name:f.name || `${f.first} ${f.last}`, aliases:f.aliases || []}))));
    """], cwd=ROOT, text=True)
    return json.loads(output)


def save(state):
    STATE.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=STATE.parent, delete=False) as tmp:
        json.dump(state, tmp, ensure_ascii=False, indent=2, sort_keys=True)
        tmp.write("\n")
    Path(tmp.name).replace(STATE)


def sync(client, events, state, directory):
    by_name = {}
    ambiguous = set()
    for fighter in directory:
        for name in [fighter["name"], *fighter.get("aliases", [])]:
            key = normalize(name)
            if key in by_name and by_name[key]["id"] != fighter["id"]:
                ambiguous.add(key)
            by_name[key] = fighter
    for name in ambiguous:
        by_name.pop(name, None)

    completed = sorted((e for e in events if e.get("status") == "completed"), key=lambda e: e["date"])
    for event in completed:
        event_id = event["id"]
        if event_id in state["processedEventIds"]:
            continue
        if not event.get("bouts") or any(not b.get("winner") and b.get("outcome") not in ("draw", "no-contest") for b in event["bouts"]):
            continue  # Wait until the results have landed.
        names = {b[side] for b in event["bouts"] for side in ("red", "blue")}
        seen = state["completedFighters"].setdefault(event_id, [])
        for name in sorted(names):
            fighter = by_name.get(normalize(name))
            if not fighter or fighter["id"] in seen:
                continue
            if client.used + (1 if fighter["id"] in state["apiIds"] else 2) > client.limit:
                save(state)
                return
            try:
                api_id = state["apiIds"].get(fighter["id"])
                if api_id is None:
                    api_id = resolve(client, fighter["name"])
                    state["apiIds"][fighter["id"]] = api_id
                rows = client.get("/fighters/records", id=api_id)
                if len(rows) != 1 or not isinstance(rows[0], dict):
                    raise ValueError("No unique fighter record")
                if rows[0].get("fighter", {}).get("id") != api_id:
                    raise ValueError("Record identity mismatch")
                record = record_from_row(rows[0])
                state["records"][fighter["id"]] = {"record": record, "source": "API-Sports MMA", "apiId": api_id,
                                                   "updatedAt": datetime.now(timezone.utc).isoformat()}
                seen.append(fighter["id"])
            except Exception as error:
                print(f"Record unchanged for {fighter['id']}: {error}", file=sys.stderr)
                save(state)
                return  # Retry later; never mark a partially updated event done.
            save(state)  # Checkpoint avoids paying for successful calls again.
        state["processedEventIds"].append(event_id)
        state["completedFighters"].pop(event_id, None)
        save(state)


def probe(key):
    """Read-only coverage check; never edits the public record snapshot."""
    client = Client(key, limit=8)
    valid = 0
    for name in ("Joshua Van", "Ilia Topuria", "Deiveson Figueiredo", "Natalia Silva"):
        api_id = resolve(client, name)
        rows = client.get("/fighters/records", id=api_id)
        print("PROBE", name, json.dumps(rows, ensure_ascii=False))
        try:
            if len(rows) != 1 or rows[0].get("fighter", {}).get("id") != api_id:
                raise ValueError("Record identity mismatch")
            print("PROBE parsed", name, record_from_row(rows[0]))
            valid += 1
        except ValueError as error:
            print("PROBE unavailable", name, str(error))
    print("PROBE valid records:", valid, "requests:", client.used)
    if not valid:
        raise SystemExit("No complete records in sample; API coverage insufficient")


def main():
    key = os.environ.get("API_SPORTS_MMA_KEY")
    if not key and "--probe" in sys.argv:
        raise SystemExit("API_SPORTS_MMA_KEY absent; live check cannot run")
    if not key:
        print("API_SPORTS_MMA_KEY absent; fighter records unchanged")
        return
    if "--probe" in sys.argv:
        return probe(key)
    if not STATE.exists():
        raise SystemExit("Missing baseline fighter-records.json; refusing to replay history")
    state = json.loads(STATE.read_text(encoding="utf-8"))
    events = json.loads(EVENTS.read_text(encoding="utf-8"))["events"]
    sync(Client(key), events, state, fighter_names())


if __name__ == "__main__":
    main()
