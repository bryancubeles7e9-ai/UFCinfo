"""Build missing fighter profiles from saved official UFC pages."""
import html
import importlib.util
import json
import re
import sys
from pathlib import Path

spec = importlib.util.spec_from_file_location("fighter_info", Path(__file__).with_name("import-fighter-info.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

DIVISIONS = {
    "Flyweight": "Peso mosca", "Bantamweight": "Peso gallo", "Featherweight": "Peso pluma",
    "Lightweight": "Peso ligero", "Welterweight": "Peso wélter", "Middleweight": "Peso medio",
    "Light Heavyweight": "Peso semipesado", "Heavyweight": "Peso pesado", "Strawweight": "Peso paja",
}


# UFC.com sometimes publishes typos (a height of 394 cm, a heavyweight of 33 kg): such values are left empty.
PLAUSIBLE = {"heightCm": (140, 230), "reachCm": (140, 235)}
PLAUSIBLE_INFO = {"weightKg": (45, 160), "legReachCm": (60, 140)}


def tidy_text(value):
    """Decode HTML entities and fix spacing such as "Manaus , Brazil"."""
    if not isinstance(value, str):
        return value
    text = re.sub(r"\s+", " ", html.unescape(value)).strip()
    return re.sub(r"\s+,", ",", text)


def tidy_profile(profile):
    for key in ("birthplace", "nickname", "officialStyle"):
        if profile.get(key):
            profile[key] = tidy_text(profile[key])
    for key in ("first", "last", "name"):
        if isinstance(profile.get(key), str):
            profile[key] = tidy_text(profile[key])
    for key, (low, high) in PLAUSIBLE.items():
        if profile.get(key) is not None and not low <= profile[key] <= high:
            profile[key] = None
    info = profile.get("info") or {}
    for key, (low, high) in PLAUSIBLE_INFO.items():
        if info.get(key) is not None and not low <= info[key] <= high:
            info[key] = None
    if info.get("gym"):
        info["gym"] = tidy_text(info["gym"])
    return profile


def bout_division(label):
    """Spanish division of an official bout label such as "Women's Strawweight Bout"."""
    text = re.sub(r"\b(UFC|Interim|Title|Bout)\b", " ", str(label or ""))
    text = re.sub(r"\s+", " ", text).strip()
    feminine = text.startswith("Women's ")
    text = text.replace("Women's ", "")
    if text not in DIVISIONS:
        return None
    return DIVISIONS[text] + (" femenino" if feminine and not DIVISIONS[text].endswith("femenino") else "")


def division_from_events(name, events):
    """Division of the fighter's most recent official bout, for profiles where UFC.com shows none."""
    key = re.sub(r"[^a-z0-9]+", " ", name.lower()).strip()
    for event in sorted(events, key=lambda e: e.get("date", ""), reverse=True):
        for bout in event.get("bouts", []):
            names = {re.sub(r"[^a-z0-9]+", " ", str(n).lower()).strip() for n in (bout.get("red"), bout.get("blue"))}
            if key in names and bout_division(bout.get("division")):
                return bout_division(bout.get("division"))
    return None


def parse_profile(page, athlete, date):
    def field(class_name, tag="p"):
        match = re.search(r'class="' + re.escape(class_name) + r'">(.*?)</' + tag + '>', page, re.S)
        return module.clean(match[1]) if match else None
    name = field("hero-profile__name", "h1")
    if not name:
        raise ValueError(f"Missing athlete profile: {athlete['name']}")
    bio = dict((module.clean(label), module.clean(value)) for label, value in re.findall(
        r'class="c-bio__label">(.*?)</div>\s*<div class="c-bio__text">(.*?)(?=</div>\s*</div>)', page, re.S))
    def cm(label):
        try:
            return round(float(bio[label]) * 2.54)
        except (KeyError, ValueError):
            return None
    photo = re.search(r'<img[^>]+src="([^"]+)"[^>]+class="hero-profile__image"', page)
    division = field("hero-profile__division-title") or "No indicada"
    division = division.replace(" Division", "")
    feminine = division.startswith("Women's ")
    division = division.replace("Women's ", "")
    division = DIVISIONS.get(division, division) + (" femenino" if feminine else "")
    parts = name.split(" ", 1)
    # Verified representation is retained from the manifest. Birthplace is separate.
    registry_path = Path(__file__).resolve().parents[1] / "docs/fighter-country-sources.json"
    registry = json.loads(registry_path.read_text()) if registry_path.exists() else {}
    country = registry.get(athlete["source"].rstrip("/").rsplit("/", 1)[-1], {})
    return tidy_profile({
        **athlete, "name": name, "first": parts[0], "last": parts[1] if len(parts) > 1 else "",
        **country,
        "supplemental": True, "division": division,
        "record": (field("hero-profile__division-body") or "No indicado").replace(" (W-L-D)", ""),
        "nickname": (field("hero-profile__nickname") or "").strip('"'),
        "birthplace": bio.get("Place of Birth") or None,
        "officialStyle": bio.get("Fighting style") or None,
        "heightCm": cm("Height"), "reachCm": cm("Reach"),
        "photoSource": module.clean(photo[1]) if photo else None,
        "image": f"assets/images/fighters/{athlete['id']}.png" if photo else None,
        "consulted": date, "info": {**module.parse_profile(page), "source": athlete["source"], "consulted": date},
    })


if __name__ == "__main__":
    folder, manifest, date, output = sys.argv[1:]
    athletes = json.loads(Path(manifest).read_text())
    profiles = [parse_profile((Path(folder) / f"octagon-{f['id']}.html").read_text(), f, date) for f in athletes]
    Path(output).write_text("// Official UFC profiles; generated by scripts/import-fighter-directory.py.\nexport const additionalFighters = " + json.dumps(profiles, ensure_ascii=False, indent=2) + ";\n")
