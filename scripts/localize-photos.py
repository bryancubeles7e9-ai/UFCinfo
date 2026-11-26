#!/usr/bin/env python3
"""Store official UFC photos of catalogue profiles on this site, as WebP.

Profiles imported automatically point at UFC.com; this replaces each such address with a local
copy (assets/images/fighters/<id>.webp, at most 700 px tall) so photos load faster, work offline
and do not depend on UFC's image server. The original address stays in photoSource. A photo that
cannot be downloaded keeps its UFC.com address. Run from the repository root (needs Pillow):
    python3 scripts/localize-photos.py
"""
from concurrent.futures import ThreadPoolExecutor
import io
import json
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'assets/js/fighter-directory-data.js'
FOLDER = ROOT / 'assets/images/fighters'


def official(url):
    parts = urlsplit(url or '')
    return parts.scheme == 'https' and parts.hostname == 'www.ufc.com' and parts.path.startswith('/images/')


def localize(fighter):
    url = fighter['image']
    try:
        with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; UFCinfo/1.0)'}), timeout=30) as response:
            data = response.read(8_000_001)
        if len(data) > 8_000_000:
            raise ValueError('too large')
        with Image.open(io.BytesIO(data)) as image:
            image.load()
            image = image.convert('RGBA' if 'A' in image.getbands() or 'transparency' in image.info else 'RGB')
            image.thumbnail((700, 700), Image.LANCZOS)
            target = FOLDER / f"{fighter['id']}.webp"
            image.save(target, 'WEBP', quality=82, method=6)
        return fighter, f"assets/images/fighters/{fighter['id']}.webp"
    except Exception as error:
        return fighter, error


def main():
    prefix, raw = DATA.read_text().split('export const additionalFighters = ', 1)
    profiles = json.loads(raw.strip().removesuffix(';'))
    remote = [f for f in profiles if official(f.get('image'))]
    done, failed = 0, []
    with ThreadPoolExecutor(max_workers=6) as pool:
        for fighter, result in pool.map(localize, remote):
            if isinstance(result, Exception):
                failed.append(f"{fighter['name']} ({type(result).__name__})")
                continue
            fighter.setdefault('photoSource', fighter['image'])
            fighter['image'] = result
            done += 1
    DATA.write_text(prefix + 'export const additionalFighters = ' + json.dumps(profiles, ensure_ascii=False, indent=2) + ';\n')
    print(f'Fotos guardadas en la web: {done} de {len(remote)}')
    for name in failed:
        print(f'::warning::No se pudo guardar la foto de {name}; se mantiene la de UFC.com.')


if __name__ == '__main__':
    main()
