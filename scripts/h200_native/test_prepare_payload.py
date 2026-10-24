import hashlib
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

from prepare_payload import merge_files


class PayloadPublicationTests(unittest.TestCase):
    def exercise(self, corrupt=False, expired=False):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            data = [b'GGUF\0\1', bytes(range(256))*3, b'last packed bytes']
            parts = []
            for index, content in enumerate(data):
                path = root/str(index)
                path.write_bytes(content)
                parts.append(dict(path=str(path), bytes=len(content), sha256=hashlib.sha256(content).hexdigest()))
            if corrupt:
                (root/'1').write_bytes(b'x'*len(data[1]))
            joined = b''.join(data)
            destination = root/'model.gguf'
            temporary = root/'model.incomplete'
            updates = []
            with patch('prepare_payload.shutil.disk_usage', return_value=type('Usage', (), {'free': 1024**4})()):
                if corrupt or expired:
                    with self.assertRaisesRegex(RuntimeError, 'SHA256|deadline'):
                        merge_files(parts, temporary, destination, len(joined), hashlib.sha256(joined).hexdigest(), time.monotonic()-1 if expired else time.monotonic()+10, updates.append)
                    self.assertFalse(destination.exists())
                    self.assertTrue(temporary.exists())
                    self.assertEqual((root/'0').read_bytes(), data[0])
                else:
                    result = merge_files(parts, temporary, destination, len(joined), hashlib.sha256(joined).hexdigest(), time.monotonic()+10, updates.append)
                    self.assertEqual(destination.read_bytes(), joined)
                    self.assertEqual(result['completed_parts'], 3)
                    self.assertFalse(temporary.exists())
                    self.assertEqual(updates[-1]['copied_bytes'], len(joined))
                    with self.assertRaisesRegex(RuntimeError, 'already exists'):
                        merge_files(parts, temporary, destination, len(joined), result['sha256'], time.monotonic()+10)
    def test_exact_parts_publish_only_the_complete_verified_payload(self):
        self.exercise()
    def test_corruption_retains_failure_and_never_publishes_or_changes_inputs(self):
        self.exercise(corrupt=True)
    def test_deadline_retains_incomplete_without_publishing(self):
        self.exercise(expired=True)


if __name__ == '__main__':
    unittest.main(verbosity=2)
