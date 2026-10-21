import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from status import progress


class DownloadMeasurementTests(unittest.TestCase):
    def test_sparse_file_size_is_not_counted_as_downloaded_data(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            name = 'V41-XQ-1017-v3.gguf.part-01-of-16'
            (root/(name+'.ranges.json')).write_text(json.dumps(
                {'size': 1024**3, 'chunk_size': 32, 'completed': [0, 1]}))
            with (root/(name+'.download')).open('wb') as stream:
                stream.truncate(1024**3)
            (root/(name+'.chunk-0002')).write_bytes(b'1234')
            (root/(name+'.chunk-0002.tail')).write_bytes(b'56')
            result = progress(root)
            self.assertEqual(result['completed_range_bytes'], 64)
            self.assertEqual(result['transferred_bytes'], 70)

    def test_published_parts_are_counted_after_resume_state_is_removed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root/'V41-XQ-1017-v3.gguf.part-01-of-16').write_bytes(b'published')
            self.assertEqual(progress(root)['transferred_bytes'], 9)

    def test_a_chunk_removed_after_its_first_stat_does_not_abort_observation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            name = 'V41-XQ-1017-v3.gguf.part-01-of-16'
            (root/(name+'.ranges.json')).write_text(json.dumps(
                {'size': 64, 'chunk_size': 32, 'completed': [0]}))
            chunk = root/(name+'.chunk-0001.tail')
            chunk.write_bytes(b'new')
            original = Path.stat

            def disappearing(path, *args, **kwargs):
                metadata = original(path, *args, **kwargs)
                if path == chunk:
                    path.unlink()
                return metadata

            with patch.object(Path, 'stat', disappearing):
                self.assertEqual(progress(root)['transferred_bytes'], 35)

    def test_a_resume_record_removed_during_publication_does_not_abort_observation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            record = root/'V41-XQ-1017-v3.gguf.part-01-of-16.ranges.json'
            record.write_text('{}')
            original = Path.read_text

            def disappearing(path, *args, **kwargs):
                if path == record:
                    path.unlink()
                return original(path, *args, **kwargs)

            with patch.object(Path, 'read_text', disappearing):
                self.assertEqual(progress(root)['transferred_bytes'], 0)


if __name__ == '__main__':
    unittest.main()
