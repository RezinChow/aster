import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import deferred_launch


class ReservationBoundaryTests(unittest.TestCase):
    def test_gpu_selector_matches_verified_cluster_label_case(self):
        command = deferred_launch.submission_command('resource-regression')
        start = command.index('--positive-tags') + 1
        end = command.index('--mount')
        self.assertEqual(command[start:end], ['H200', 'feature/gpfs=yes'])

    def test_missing_parts_never_reserve_gpus(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(deferred_launch, 'STAGING', Path(directory)), \
                patch.object(deferred_launch, 'run_preflight'):
            with patch.object(deferred_launch.subprocess, 'run') as run, \
                    patch.object(deferred_launch.time, 'sleep', side_effect=RuntimeError('still waiting')):
                with self.assertRaisesRegex(RuntimeError, 'still waiting'):
                    deferred_launch.main()
                run.assert_not_called()

    def test_ambiguous_submission_cannot_create_a_duplicate_reservation(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(deferred_launch, 'STAGING', Path(directory)), \
                patch.object(deferred_launch, 'run_preflight'):
            root = Path(directory)
            (root/'assets/v3').mkdir(parents=True)
            for index in range(1, 17):
                (root/f'assets/v3/V41-XQ-1017-v3.gguf.part-{index:02d}-of-16').touch()
            responses = [subprocess.CompletedProcess([], 1, '', ''),
                         subprocess.CompletedProcess([], 0, '{"items":[]}', '')]
            with patch.object(deferred_launch.subprocess, 'run', side_effect=responses) as run:
                with self.assertRaisesRegex(RuntimeError, 'exactly one owned RJob'):
                    deferred_launch.main()
                self.assertEqual(run.call_count, 2)
            self.assertEqual(json.loads((root/'deployment-state.json').read_text())['phase'],
                             'submission_needs_inspection')
            with patch.object(deferred_launch.subprocess, 'run') as run:
                with self.assertRaisesRegex(RuntimeError, 'submission record already exists'):
                    deferred_launch.main()
                run.assert_not_called()

    def test_missing_preparation_never_reserves_gpus(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(deferred_launch, 'STAGING', Path(directory)), \
                patch.object(deferred_launch, 'run_preflight', side_effect=RuntimeError('missing preparation')), \
                patch.object(deferred_launch.subprocess, 'run') as run:
            with self.assertRaisesRegex(RuntimeError, 'missing preparation'):
                deferred_launch.main()
            run.assert_not_called()


if __name__ == '__main__':
    unittest.main()
