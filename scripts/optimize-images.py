#!/usr/bin/env python3
"""Creates a lighter WebP copy next to every local PNG/JPG photo.

The server sends the WebP copy to browsers that accept it and the original to the rest,
so the data files keep pointing at the original names. Run it after adding photos:
    python3 scripts/optimize-images.py
Requires Pillow (pip install pillow). Existing, up-to-date copies are skipped.
"""
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / "assets/images"
MAX_SIDE = 900  # Enough for the largest place a photo is shown, on high-density screens.


def optimize(source):
    target = source.with_suffix(".webp")
    if target.exists() and target.stat().st_mtime >= source.stat().st_mtime:
        return None
    with Image.open(source) as image:
        image.load()
        if image.mode not in {"RGB", "RGBA"}:
            image = image.convert("RGBA" if "A" in image.getbands() or "transparency" in image.info else "RGB")
        image.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        image.save(target, "WEBP", quality=80, method=6)
    if target.stat().st_size >= source.stat().st_size:
        target.unlink()  # Not worth it: keep serving the original.
        return None
    return source.stat().st_size, target.stat().st_size


def main():
    before = after = count = 0
    for source in sorted(IMAGES.rglob("*")):
        if source.suffix.lower() in {".png", ".jpg", ".jpeg"} and source.is_file():
            sizes = optimize(source)
            if sizes:
                before, after, count = before + sizes[0], after + sizes[1], count + 1
    print(f"{count} copias WebP nuevas: {before / 1e6:.1f} MB -> {after / 1e6:.1f} MB")


if __name__ == "__main__":
    sys.exit(main())
