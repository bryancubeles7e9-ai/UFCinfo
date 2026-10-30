"""Public AdSense configuration. Never contains an API key or a fake publisher ID."""
import json
import re
from pathlib import Path


def publisher_id(root):
    try:
        config = json.loads((Path(root) / 'assets/data/adsense.json').read_text())
    except (OSError, ValueError):
        return None
    client = config.get('client') if isinstance(config, dict) else None
    return client if isinstance(client, str) and re.fullmatch(r'ca-pub-[0-9]{16}', client) else None


def ads_txt(client):
    return f'google.com, {client.removeprefix("ca-")}, DIRECT, f08c47fec0942fa0\n'
