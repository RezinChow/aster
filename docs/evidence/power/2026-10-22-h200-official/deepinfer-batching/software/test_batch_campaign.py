import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import batch_campaign


class RestorationTests(unittest.TestCase):
    def test_benchmark_failure_restores_original_private_admission(self):
        with tempfile.TemporaryDirectory() as directory, \
                patch.object(batch_campaign.validate, 'ROOT', Path(directory)), \
                patch.object(batch_campaign.validate, 'active_requests', return_value=0):
            root = Path(directory)
            (root/'run').mkdir()
            (root/'logs').mkdir()
            (root/'run/frontend.json').write_text('{"exact_benchmark_usage":false,"max_concurrent_requests":4}')
            (root/'run/qualification.json').write_text('{"passed":true}')
            calls = []
            def execute(command, **kwargs):
                calls.append(command[2:])
                if 'benchmark' in command:
                    raise RuntimeError('synthetic benchmark failure')
            with patch.object(batch_campaign.subprocess, 'run', side_effect=execute):
                with self.assertRaisesRegex(RuntimeError, 'synthetic benchmark failure'):
                    batch_campaign.run()
            self.assertEqual(calls[-3:], [['stop'], ['start', '--max-concurrent', '4'], ['check']])
            record = json.loads((root/'logs/deepinfer-batching/campaign.json').read_text())
            self.assertFalse(record['complete'])
            self.assertTrue(record['normal_privacy_restored'])
            self.assertIn('campaign_error', record)


if __name__ == '__main__':
    unittest.main()
