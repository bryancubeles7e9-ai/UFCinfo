import json
from pathlib import Path
import tempfile
import unittest
from adsense import ads_txt, publisher_id


class AdSenseConfigurationTests(unittest.TestCase):
    def test_missing_or_invalid_publisher_is_not_published(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.assertIsNone(publisher_id(root))
            path = root / 'assets/data/adsense.json'
            path.parent.mkdir(parents=True)
            for value in ['invalid json', '[]', '{"client": "ca-pub-123"}',
                          '{"client": 123}', '{"client":"ca-pub-1234567890123456\\n"}']:
                path.write_text(value)
                self.assertIsNone(publisher_id(root))

    def test_real_publisher_format_is_shared_with_ads_txt(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / 'assets/data/adsense.json'
            path.parent.mkdir(parents=True)
            path.write_text(json.dumps({'client': 'ca-pub-1234567890123456', 'enabled': False}))
            client = publisher_id(root)
            self.assertEqual(client, 'ca-pub-1234567890123456')
            self.assertEqual(ads_txt(client), 'google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n')


if __name__ == '__main__':
    unittest.main()
