"""Refresh verified UFC profiles after cards, with an explicit full refresh mode."""
from concurrent.futures import ThreadPoolExecutor
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
from html import unescape
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / "assets/data/fighter-records.json"
MAX_PROFILES = 40
# An official correction that UFC keeps publishing unchanged for this long is accepted.
CONFIRM_HOURS = 72
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
        raise ValueError("Official combat statistics incomplete")
    return {"record": record, "info": stats}


UFC_STATS = "http://ufcstats.com"
# UFC Stats labels for the same per-minute, per-15-minute and percentage figures.
UFC_STATS_LABELS = {"strikesLanded": r"SLpM", "strikesAbsorbed": r"SApM", "strikingAccuracy": r"Str\. Acc\.",
                    "strikingDefense": r"Str\. Def\.?", "takedownAverage": r"TD Avg\.", "takedownAccuracy": r"TD Acc\.",
                    "takedownDefense": r"TD Def\.", "submissionAverage": r"Sub\. Avg\."}


def read_page(url, limit=2_000_000):
    request = Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; UFCinfo/1.0)", "Accept": "text/html"})
    with urlopen(request, timeout=25) as response:
        html = response.read(limit + 1)
    if len(html) > limit:
        raise ValueError("Source response too large")
    return html.decode("utf-8", "replace")


def text_of(html):
    return " ".join(unescape(re.sub(r"<[^>]+>", " ", html)).split())


def parse_ufc_stats(html, fighter, record):
    """Core statistics from a UFC Stats page, accepted only for the same name and record."""
    name = re.search(r'class="b-content__title-highlight">(.*?)</span>', html, re.S)
    allowed = {normalize(n) for n in [fighter["name"], *fighter.get("aliases", [])]}
    if not name or normalize(text_of(name[1])) not in allowed:
        raise ValueError("UFC Stats identity mismatch")
    text = text_of(html)
    found = re.search(r"Record:\s*(\d{1,3}-\d{1,3}-\d{1,3})", text)
    if not found or found[1] != record:
        raise ValueError("UFC Stats record differs from UFC.com")
    stats = {}
    for key, label in UFC_STATS_LABELS.items():
        value = re.search(label + r":\s*(\d+(?:\.\d+)?)\s*(%?)", text)
        if not value or bool(value[2]) != (key in PERCENT_STATS):
            raise ValueError("UFC Stats statistic missing: " + key)
        stats[key] = float(value[1]) if key not in PERCENT_STATS else int(float(value[1]))
    return stats


def ufc_stats_url(fighter, read=read_page):
    """Find the UFC Stats profile whose first and last name links match the fighter.

    Each search row links the first name, last name and nickname to the same
    profile, so links are grouped by profile instead of relying on table markup.
    """
    allowed = {normalize(n) for n in [fighter["name"], *fighter.get("aliases", [])]}
    last = fighter["name"].split()[-1]
    page = read(f"{UFC_STATS}/statistics/fighters/search?query={quote(last)}")
    names = {}
    for profile, label in re.findall(r'<a[^>]+href="https?://(?:www\.)?ufcstats\.com/fighter-details/([a-f0-9]{16})"[^>]*>(.*?)</a>', page, re.S):
        names.setdefault(profile, []).append(text_of(label))
    matches = {profile for profile, labels in names.items()
               if normalize(" ".join(labels[:2])) in allowed or any(normalize(label) in allowed for label in labels)}
    if len(matches) != 1:
        title = re.search(r"<title[^>]*>(.*?)</title>", page, re.S | re.I)
        raise ValueError(f"UFC Stats profile missing or ambiguous ({len(names)} profiles in search, {len(matches)} matching; "
                         f"page {len(page)} chars, title {text_of(title[1])[:60] if title else 'none'!r})")
    return f"{UFC_STATS}/fighter-details/{matches.pop()}"


def complete_from_ufc_stats(fighter, record, page, read=read_page):
    """Fill core statistics UFC.com omits; its own figures and finishes stay first."""
    url = ufc_stats_url(fighter, read)
    official = {k: v for k, v in info_parser.parse_profile(page).items()
                if k in STAT_KEYS and isinstance(v, (int, float)) and not isinstance(v, bool)}
    return {"record": record, "info": {**parse_ufc_stats(read(url), fighter, record), **official},
            "statisticsSource": url}


def fetch_profile(fighter):
    url = fighter["source"]
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.netloc != "www.ufc.com" or not parsed.path.startswith("/athlete/"):
        raise ValueError("Unexpected profile source")
    page = read_page(url)
    try:
        return parse_profile(page, fighter)
    except ValueError as error:
        if str(error) != "Official combat statistics incomplete":
            raise
        # UFC can publish the record before all statistics, especially on debuts.
        record = parse_record(page, fighter)
        try:
            return complete_from_ufc_stats(fighter, record, page)
        except (OSError, ValueError) as fallback:
            print(f"::notice::UFC Stats fallback unavailable for {fighter['id']}: {fallback}", file=sys.stderr)
            return {"record": record, "info": None}


def directory():
    output = subprocess.check_output(["node", "--input-type=module", "-e", """
      import { fighters } from './assets/js/data.js';
      import { additionalFighters } from './assets/js/fighter-directory-data.js';
      console.log(JSON.stringify([...fighters, ...additionalFighters].map(f =>
        ({id:f.id, name:f.name || `${f.first} ${f.last}`, aliases:[...(f.aliases || []), ...(f.id === "zhang" ? ["Zhang Weili"] : [])], source:f.source, record:f.record, info:f.info}))));
    """], cwd=ROOT, text=True)
    return json.loads(output)


def save(state):
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=STATE.parent, delete=False) as tmp:
        json.dump(state, tmp, ensure_ascii=False, indent=2)
        tmp.write("\n")
    Path(tmp.name).replace(STATE)


def validate_progress(fighter, previous, profile):
    """Quarantine regressions; official corrections require human review.

    Rates and percentages may legitimately decrease after a fight. Career
    totals may not silently decrease or replace the directory's verified record.
    """
    def record_parts(value):
        if isinstance(value, str) and re.fullmatch(r"\d{1,3}-\d{1,3}-\d{1,3}", value):
            return tuple(map(int, value.split('-')))
        return None

    incoming = record_parts(profile.get('record'))
    if incoming is None or any(value > 200 for value in incoming):
        raise ValueError('Invalid incoming career record')
    # After an accepted official correction, the saved profile supersedes the directory.
    baselines = (previous,) if previous.get('acceptedCorrection') else (fighter, previous)
    for baseline in baselines:
        old = record_parts(baseline.get('record'))
        if old and any(new < saved for new, saved in zip(incoming, old)):
            raise ValueError(f"Career record regression: {baseline['record']} -> {profile['record']}")
    stats = profile.get('info')
    if stats is None:
        return
    for key, value in stats.items():
        if key not in STAT_KEYS:
            continue
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
            raise ValueError('Invalid incoming statistic: ' + key)
        if key in PERCENT_STATS and value > 100:
            raise ValueError('Incoming percentage outside range: ' + key)
    for baseline in baselines:
        old_stats = baseline.get('info') or {}
        for key in ('koWins', 'submissionWins', 'firstRoundFinishes'):
            old = old_stats.get(key)
            if isinstance(old, (int, float)) and key in stats and stats[key] < old:
                raise ValueError('Career statistic regression: ' + key)
        if (all(stats.get(key) == 0 for key in CORE_STATS)
                and any(isinstance(old_stats.get(key), (int, float)) and old_stats[key] > 0 for key in CORE_STATS)):
            raise ValueError('Combat statistics unexpectedly reset to zero')


def store_profile(state, fighter, profile, now, accepted=None):
    previous = state["records"].get(fighter["id"], {})
    if accepted is None:
        validate_progress(fighter, previous, profile)
    correction = accepted or previous.get("acceptedCorrection")
    state["records"][fighter["id"]] = {
        **({"acceptedCorrection": correction} if correction else {}),
        "record": profile["record"], "source": "UFC", "sourceUrl": fighter["source"],
        "updatedAt": now.isoformat(),
        **({"info": {**previous.get("info", {}), **profile["info"],
                 "statisticsSource": profile.get("statisticsSource", fighter["source"]),
                 "statisticsConsulted": now.date().isoformat()}}
           if profile["info"] is not None else ({"info": previous["info"]} if "info" in previous else {})),
    }
    save(state)


def correction_signature(profile):
    stats = {k: v for k, v in (profile.get("info") or {}).items() if k in STAT_KEYS}
    return json.dumps({"record": profile.get("record"), "stats": stats}, sort_keys=True)


def acceptable_correction(reason, fighter, previous, profile):
    """Official corrections, not broken pages: finishes or a small record change."""
    if reason.startswith("Career statistic regression"):
        return True
    if not reason.startswith("Career record regression"):
        return False  # Invalid data or statistics reset to zero always need a person.
    totals = [sum(map(int, r.split("-"))) for r in (previous.get("record") or fighter.get("record") or "", profile["record"])
              if re.fullmatch(r"\d{1,3}-\d{1,3}-\d{1,3}", r or "")]
    return len(totals) == 2 and abs(totals[0] - totals[1]) <= 2


def sync(events, state, fighters, fetch=fetch_profile, now=None, full=False):
    now = now or datetime.now(timezone.utc)
    by_name = {}
    for fighter in fighters:
        for name in [fighter["name"], *fighter.get("aliases", [])]:
            key = normalize(name)
            if key in by_name and by_name[key] != fighter:
                raise ValueError("Duplicate fighter identity in directory")
            by_name[key] = fighter
    targets = {}
    eligible = {}
    unmatched = {}
    for event in sorted(events, key=lambda e: e["date"], reverse=True):
        start = datetime.fromisoformat(event["date"].replace("Z", "+00:00"))
        if event.get("status") != "completed" or start > now:
            continue
        recent = start >= now - timedelta(days=14)
        if event["id"] in state["processedEventIds"] and not recent:
            continue
        required = set()
        for bout in event.get("bouts", []):
            if not bout.get("winner") and bout.get("outcome") not in ("draw", "no-contest", "Empate", "Sin resultado (No contest)"):
                continue
            for side in ("red", "blue"):
                fighter = by_name.get(normalize(bout[side]))
                if not fighter:
                    unmatched.setdefault(event['id'], set()).add(bout[side])
                if fighter:
                    required.add(fighter["id"])
                    if recent or fighter["id"] not in state["completedFighters"].get(event["id"], []):
                        targets[fighter["id"]] = fighter
        if required:
            eligible[event["id"]] = required
    pending = set(state.get("pendingProfileIds", state.get("lastSync", {}).get("failedIds", [])))
    for fighter in fighters:
        if fighter["id"] in pending:
            targets[fighter["id"]] = fighter
    targets = list(fighters) if full else list(targets.values())
    # Oldest consultation first prevents starvation when recent cards exceed the cap.
    if not full:
        targets.sort(key=lambda f: state["records"].get(f["id"], {}).get("updatedAt", ""))
        # Reserve up to ten slots for retries; an updated record must not push
        # its still-missing statistics behind every fully refreshed profile.
        retries = [f for f in targets if f["id"] in pending][:10]
        retry_ids = {f["id"] for f in retries}
        targets = retries + [f for f in targets if f["id"] not in retry_ids][:MAX_PROFILES-len(retries)]
    successes, failures, record_only = set(), [], []
    def consult(fighter):
        try:
            return fighter, fetch(fighter), None
        except Exception as error:
            return fighter, None, str(error)
    with ThreadPoolExecutor(max_workers=4) as pool:
        for fighter, profile, error in pool.map(consult, targets):
            if error:
                failures.append(fighter["id"])
                print(f"::warning::Profile preserved for {fighter['id']}: {error}", file=sys.stderr)
                continue
            # A successful consultation is not proof UFC has incorporated the last
            # fight. Recent events stay eligible for repeated checks for 14 days.
            try:
                store_profile(state, fighter, profile, now)
            except ValueError as error:
                previous = state['records'].get(fighter['id'], {})
                review = state.get('profileReview', {}).get(fighter['id'], {})
                signature = correction_signature(profile)
                first_seen = review.get('firstSeenAt') if review.get('signature') == signature else None
                confirmed = first_seen and now - datetime.fromisoformat(first_seen) >= timedelta(hours=CONFIRM_HOURS)
                if confirmed and acceptable_correction(str(error), fighter, previous, profile):
                    store_profile(state, fighter, profile, now, accepted={
                        'acceptedAt': now.isoformat(), 'reason': str(error), 'firstSeenAt': first_seen,
                        'previousRecord': previous.get('record') or fighter.get('record')})
                    print(f"::notice::Official correction accepted for {fighter['id']} after {CONFIRM_HOURS} h unchanged: {error}", file=sys.stderr)
                else:
                    failures.append(fighter['id'])
                    state.setdefault('profileReview', {})[fighter['id']] = {
                        'checkedAt': now.isoformat(), 'reason': str(error),
                        'sourceUrl': fighter['source'], 'receivedRecord': profile.get('record'),
                        'savedRecord': previous.get('record'), 'directoryRecord': fighter.get('record'),
                        'signature': signature, 'firstSeenAt': first_seen or now.isoformat(),
                    }
                    print(f"::warning::Profile preserved for {fighter['id']}: {error}", file=sys.stderr)
                    continue
            state.get('profileReview', {}).pop(fighter['id'], None)
            if profile["info"] is None:
                failures.append(fighter["id"])
                record_only.append(fighter["id"])
                print(f"::warning::Record updated; statistics still pending for {fighter['id']}", file=sys.stderr)
            else:
                successes.add(fighter["id"])
    for event_id, required in eligible.items():
        done = (set(state["completedFighters"].get(event_id, [])) - set(failures)) | (required & successes)
        if required.issubset(done) and event_id not in unmatched:
            if event_id not in state["processedEventIds"]:
                state["processedEventIds"].append(event_id)
            state["completedFighters"].pop(event_id, None)
        else:
            if event_id in state["processedEventIds"]:
                state["processedEventIds"].remove(event_id)
            state["completedFighters"][event_id] = sorted(done)
    state["unmatchedEventFighters"] = {eid: sorted(names) for eid, names in unmatched.items()}
    for eid, names in state["unmatchedEventFighters"].items():
        print(f"::warning::Unmatched participants in {eid}: {names}", file=sys.stderr)
    state["lastSync"] = {"checkedAt": now.isoformat(), "mode": "all" if full else "events",
                         "attempted": len(targets), "succeeded": len(successes), "failedIds": failures, "recordOnlyIds": record_only}
    state["pendingProfileIds"] = sorted((pending - successes) | set(failures))
    if full:
        state["fullRefreshAttemptedAt"] = now.isoformat()
    if state.get("fullRefreshAttemptedAt") and not state["pendingProfileIds"]:
        state.setdefault("fullRefreshCompletedAt", now.isoformat())
    save(state)
    print(f"Profiles checked: {len(targets)}; saved: {len(successes)}; preserved after error: {len(failures)}")
    return len(targets)


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
    if state.get("lastSync", {}).get("mode") == "all":
        state.setdefault("fullRefreshAttemptedAt", state["lastSync"]["checkedAt"])
    full = "--all" in sys.argv or ("--ensure-full" in sys.argv and not state.get("fullRefreshAttemptedAt"))
    print("Official UFC profiles consulted:", sync(events, state, fighters, full=full))


if __name__ == "__main__":
    main()
