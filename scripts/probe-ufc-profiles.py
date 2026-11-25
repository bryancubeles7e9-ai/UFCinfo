"""Print official UFC and UFC Stats data for a few athletes, without changing files.

Used from the manual `fighter-probe.yml` workflow when a profile needs human review:
UFC's CDN refuses many non-Actions networks, so the runner fetches and logs the data.
"""
from datetime import date
import html
import importlib.util
import json
import re
import sys
import unicodedata
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("fighter_directory", ROOT / "scripts/import-fighter-directory.py")
directory = importlib.util.module_from_spec(spec)
spec.loader.exec_module(directory)


def get(url, limit=2_000_000):
    with urlopen(Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; UFCinfo/1.0)"}), timeout=25) as response:
        return response.read(limit).decode("utf-8", "replace")


def plain(value):
    return unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower().strip()


def ufc_stats_record(name):
    """UFC Stats lists the full professional record, including pre-UFC fights."""
    last = name.split()[-1]
    page = get("http://ufcstats.com/statistics/fighters/search?query=" + quote(last))
    for row in re.findall(r"<tr class=\"b-statistics__table-row\">(.*?)</tr>", page, re.S):
        cells = [html.unescape(re.sub(r"<[^>]+>", "", c)).strip() for c in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]
        link = re.search(r'href="(http://ufcstats\.com/fighter-details/[a-f0-9]+)"', row)
        if len(cells) >= 10 and link and plain(f"{cells[0]} {cells[1]}") == plain(name):
            details = get(link[1])
            record = re.search(r"Record:\s*(\d+-\d+-\d+)", html.unescape(re.sub(r"<[^>]+>", " ", details)))
            return {"url": link[1], "record": record[1] if record else None}
    return None


def main():
    today = date.today().isoformat()
    for slug in sys.argv[1:]:
        if not re.fullmatch(r"[a-z0-9-]{3,80}", slug):
            raise SystemExit(f"Invalid athlete slug: {slug}")
        source = f"https://www.ufc.com/athlete/{slug}"
        result = {"slug": slug}
        try:
            profile = directory.parse_profile(get(source), {"id": "ufc-" + slug, "source": source}, today)
            result["ufc"] = profile
            result["ufcStats"] = ufc_stats_record(profile["name"])
        except Exception as error:  # Report every athlete, even when one source fails.
            result["error"] = f"{type(error).__name__}: {error}"
        print("PROBE " + json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
