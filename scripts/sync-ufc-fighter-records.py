"""Read official UFC profiles only for fighters on newly completed cards."""
from datetime import datetime, timezone, timedelta
from html.parser import HTMLParser
import json
import importlib.util
import math
from pathlib import Path
import re
import subprocess
import tempfile
import sys
import unicodedata
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / "assets/data/fighter-records.json"
MAX_PROFILES = 40
STAT_KEYS = ("strikesLanded", "strikesAbsorbed", "takedownAverage", "submissionAverage",
             "strikingDefense", "takedownDefense", "knockdownAverage", "strikingAccuracy",
             "takedownAccuracy", "koWins", "submissionWins", "firstRoundFinishes")
CORE_STATS = ("strikesLanded", "strikesAbsorbed", "takedownAverage", "submissionAverage")
PERCENT_STATS = ("strikingDefense", "takedownDefense", "strikingAccuracy", "takedownAccuracy")
spec = importlib.util.spec_from_file_location("official_fighter_info", ROOT / "scripts/import-fighter-info.py")
info_parser = importlib.util.module_from_spec(spec)
spec.loader.exec_module(info_parser)


def normalize(name):
    return re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower())


class ProfileParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.fields = {"hero-profile__name": [], "hero-profile__division-body": []}
        self.active = []

    def handle_starttag(self, tag, attrs):
        classes = dict(attrs).get("class", "").split()
        for key in self.fields:
            if key in classes:
                self.active.append((tag, key, []))

    def handle_data(self, data):
        for _, _, chunks in self.active:
            chunks.append(data)

    def handle_endtag(self, tag):
        for index in range(len(self.active) - 1, -1, -1):
            opening, key, chunks = self.active[index]
            if opening == tag:
                self.fields[key].append(" ".join("".join(chunks).split()))
                self.active.pop(index)


def parse_record(html, fighter):
    parser = ProfileParser()
    parser.feed(html)
    names = parser.fields["hero-profile__name"]
    allowed = {normalize(n) for n in [fighter["name"], *fighter.get("aliases", [])]}
    if len(names) != 1 or normalize(names[0]) not in allowed:
        raise ValueError("Official profile identity missing or ambiguous")
    records = set()
    for text in parser.fields["hero-profile__division-body"]:
        match = re.fullmatch(r"(\d{1,3})\s*-\s*(\d{1,3})\s*-\s*(\d{1,3})(?:\s*\(W-L-D\))?", text)
        if match:
            values = [int(v) for v in match.groups()]
            if all(0 <= v <= 200 for v in values):
                records.add("-".join(map(str, values)))
    if len(records) != 1:
        raise ValueError("Official career record missing or ambiguous")
    return records.pop()


def parse_profile(html, fighter):
    record = parse_record(html, fighter)
    raw = info_parser.parse_profile(html)
    stats = {}
    for key in STAT_KEYS:
        value = raw.get(key)
        if value is None:
            continue  # Keep the previous optional statistic when UFC omits it.
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
            raise ValueError("Invalid official statistic: " + key)
        if key in PERCENT_STATS and value > 100:
            raise ValueError("Official percentage outside range: " + key)
        stats[key] = value
    if any(key not in stats for key in CORE_STATS):
        raise ValueError("Official combat statistics incomplete: " + json.dumps(raw) + " HTML: " + json.dumps(re.findall(r'[^<>]{0,40}c-stat-compare[^>]{0,120}>.{0,160}', html)[:20]))
    return {"record": record, "info": stats}


def fetch_profile(fighter):
    url = fighter["source"]
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.netloc != "www.ufc.com" or not parsed.path.startswith("/athlete/"):
        raise ValueError("Unexpected profile source")
    request = Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; UFCinfo/1.0)", "Accept": "text/html"})
    with urlopen(request, timeout=25) as response:
        html = response.read(2_000_001)
    if len(html) > 2_000_000:
        raise ValueError("Official profile response too large")
    return parse_profile(html.decode("utf-8"), fighter)


def directory():
    output = subprocess.check_output(["node", "--input-type=module", "-e", """
      import { fighters } from './assets/js/data.js';
      import { additionalFighters } from './assets/js/fighter-directory-data.js';
      console.log(JSON.stringify([...fighters, ...additionalFighters].map(f =>
        ({id:f.id, name:f.name || `${f.first} ${f.last}`, aliases:f.aliases || [], source:f.source, record:f.record}))));
    """], cwd=ROOT, text=True)
    return json.loads(output)


def save(state):
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=STATE.parent, delete=False) as tmp:
        json.dump(state, tmp, ensure_ascii=False, indent=2)
        tmp.write("\n")
    Path(tmp.name).replace(STATE)


def sync(events, state, fighters, fetch=fetch_profile, now=None):
    now = now or datetime.now(timezone.utc)
    by_name = {}
    for fighter in fighters:
        for name in [fighter["name"], *fighter.get("aliases", [])]:
            key = normalize(name)
            if key in by_name and by_name[key] != fighter:
                raise ValueError("Duplicate fighter identity in directory")
            by_name[key] = fighter
    used = 0
    for event in sorted(events, key=lambda e: e["date"]):
        if event.get("status") != "completed" or event["id"] in state["processedEventIds"]:
            continue
        if datetime.fromisoformat(event["date"].replace("Z", "+00:00")) > now - timedelta(hours=24):
            continue  # Give official profile editors time after the event starts.
        if not event.get("bouts") or any(not b.get("winner") and b.get("outcome") not in ("draw", "no-contest") for b in event["bouts"]):
            continue
        done = state["completedFighters"].setdefault(event["id"], [])
        required = set()
        for bout in event["bouts"]:
            for side in ("red", "blue"):
                fighter = by_name.get(normalize(bout[side]))
                if not fighter:
                    continue
                required.add(fighter["id"])
                if fighter["id"] in done:
                    continue
                if used >= MAX_PROFILES:
                    save(state)
                    return used
                used += 1
                try:
                    profile = fetch(fighter)
                    record = profile["record"]
                    previous = state["records"].get(fighter["id"], {}).get("record", fighter["record"])
                    if record == previous and bout.get("outcome") != "no-contest":
                        raise ValueError("Official record unchanged; retry after profile update")
                    state["records"][fighter["id"]] = {"record": record, "source": "UFC", "sourceUrl": fighter["source"], "updatedAt": now.isoformat(),
                        "info": {**profile["info"], "statisticsSource": fighter["source"], "statisticsConsulted": now.date().isoformat()}}
                    done.append(fighter["id"])
                    save(state)
                except Exception as error:
                    print(f"Record unchanged for {fighter['id']}: {error}", file=sys.stderr)
        if required.issubset(done):
            state["processedEventIds"].append(event["id"])
            state["completedFighters"].pop(event["id"], None)
            save(state)
    return used


def main():
    fighters = directory()
    if "--probe" in sys.argv:
        for name in ("Joshua Van", "Ilia Topuria", "Deiveson Figueiredo", "Natalia Silva"):
            fighter = next(f for f in fighters if normalize(f["name"]) == normalize(name))
            print("Official UFC record and statistics:", name, json.dumps(fetch_profile(fighter), ensure_ascii=False))
        return
    state = json.loads(STATE.read_text(encoding="utf-8"))
    if state.get("source") != "UFC":
        raise SystemExit("Official UFC baseline missing")
    events = json.loads((ROOT / "assets/data/ufc-events.json").read_text(encoding="utf-8"))["events"]
    print("Official UFC profiles consulted:", sync(events, state, fighters))


if __name__ == "__main__":
    main()
