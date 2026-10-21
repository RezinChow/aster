import json
import os
import signal
import subprocess
import sys
import tempfile
import unittest
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import MagicMock, patch

import service


class ActivationBoundaryTests(unittest.TestCase):
    def environment(self, directory, stack):
        root = Path(directory)/'nvme'
        private = Path(directory)/'private'
        stack.enter_context(patch.object(service, 'ROOT', root))
        stack.enter_context(patch.object(service, 'PRIVATE', private))
        stack.enter_context(patch.object(service, 'STAGING', Path(directory)/'staging'))
        stack.enter_context(patch.object(service, 'require_hardware', return_value=[]))
        stack.enter_context(patch.object(sys, 'argv', ['service.py', 'start']))
        return root, private

    def test_missing_weight_identity_never_starts_or_stops_a_service(self):
        with tempfile.TemporaryDirectory() as directory, ExitStack() as stack:
            self.environment(directory, stack)
            start = stack.enter_context(patch.object(service, 'start_process'))
            stop = stack.enter_context(patch.object(service, 'stop_owned'))
            with self.assertRaisesRegex(RuntimeError, 'checksum gate'):
                service.main()
            start.assert_not_called()
            stop.assert_not_called()

    def test_a_changed_model_cannot_replace_an_existing_service(self):
        with tempfile.TemporaryDirectory() as directory, ExitStack() as stack:
            root, _ = self.environment(directory, stack)
            (root/'models').mkdir(parents=True)
            (root/'models/V41-XQ-1017-v3.gguf').write_bytes(b'changed')
            (root/'models/verified-model.json').write_text(json.dumps(
                {'sha256': service.MODEL_SHA256, 'size': 1, 'mtime_ns': 1}))
            start = stack.enter_context(patch.object(service, 'start_process'))
            stop = stack.enter_context(patch.object(service, 'stop_owned'))
            with self.assertRaisesRegex(RuntimeError, 'changed after checksum verification'):
                service.main()
            start.assert_not_called()
            stop.assert_not_called()

    def test_an_unverified_draft_model_cannot_enable_speculation(self):
        with tempfile.TemporaryDirectory() as directory, ExitStack() as stack:
            self.environment(directory, stack)
            staging = Path(directory)/'staging/assets'
            staging.mkdir(parents=True)
            (staging/'V41-MTP-Vision-1017.Q2_K.gguf').write_bytes(b'incomplete draft')
            with self.assertRaisesRegex(RuntimeError, 'sidecar failed the pinned SHA-256'):
                service.engine_config('split8', 'dspark', 131072)

    def test_batching_is_enabled_only_without_layer_splitting(self):
        for parallel in (4, 8, 16):
            with self.subTest(parallel=parallel):
                config = service.engine_config('replica8x1', 'exact', 32768, parallel=parallel)
                self.assertEqual(config['replicas'], 8)
                self.assertEqual(config['parallel'], parallel)
                self.assertNotIn('--layer-split', config['args'])
                self.assertNotIn('layer_split', config)
            for layout in ('split8', 'replica4x2'):
                with self.subTest(layout=layout, parallel=parallel), self.assertRaisesRegex(ValueError, 'batch slots require'):
                    service.engine_config(layout, 'exact', 32768, parallel=parallel)
        for invalid in (0, 3, 17, True):
            with self.subTest(invalid=invalid), self.assertRaisesRegex(ValueError, 'parallel slots'):
                service.engine_config('replica8x1', 'exact', 32768, parallel=invalid)

    def test_http_200_without_loaded_weights_does_not_pass_engine_readiness(self):
        process = MagicMock()
        process.poll.side_effect = [None, 3]
        response = MagicMock()
        response.__enter__.return_value = response
        response.status = 200
        response.read.return_value = b'{"status":"ok","loaded":false}'
        with patch.object(service.urllib.request, 'urlopen', return_value=response), patch.object(service.time, 'sleep'):
            with self.assertRaisesRegex(RuntimeError, 'exited before becoming healthy'):
                service.wait_health(process, 8150, 30, require_loaded=True)

    @unittest.skipUnless(sys.platform == 'linux', 'Linux process ownership gate')
    def test_owned_children_are_stopped_even_after_the_launcher_exits(self):
        with tempfile.TemporaryDirectory() as directory, ExitStack() as stack:
            root, private = self.environment(directory, stack)
            (root/'logs').mkdir(parents=True)
            private.mkdir(parents=True)
            child_file = Path(directory)/'child.pid'
            script = Path(directory)/'launcher.py'
            script.write_text(
                'import subprocess,sys\nfrom pathlib import Path\n'
                'p=subprocess.Popen([sys.executable,"-c","import time;time.sleep(60)"])\n'
                f'Path({str(child_file)!r}).write_text(str(p.pid))\n')
            parent = service.start_process('xolotl', [sys.executable, str(script)], dict(os.environ))
            child = None
            try:
                parent.wait(timeout=5)
                child = int(child_file.read_text())
                self.assertTrue(Path(f'/proc/{child}/cmdline').read_bytes())
                service.stop_owned('xolotl', script)
                command = Path(f'/proc/{child}/cmdline')
                self.assertFalse(command.exists() and bool(command.read_bytes()),
                                 'the exited launcher left its owned child running')
            finally:
                try:
                    os.killpg(parent.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                if parent.poll() is None:
                    parent.wait(timeout=5)

    @unittest.skipUnless(sys.platform == 'linux', 'Linux process ownership gate')
    def test_a_matching_command_with_a_different_owner_is_not_stopped(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(service, 'PRIVATE', Path(directory)):
            script = Path(directory)/'other.py'
            script.write_text('import time;time.sleep(60)')
            child = subprocess.Popen([sys.executable, str(script)], start_new_session=True)
            try:
                (Path(directory)/'power.pid').write_text(json.dumps({'pid': child.pid, 'marker': 'f'*32}))
                with self.assertRaisesRegex(RuntimeError, 'unrelated process group'):
                    service.stop_owned('power', script)
                self.assertIsNone(child.poll())
            finally:
                child.terminate()
                child.wait(timeout=5)

    @unittest.skipUnless(sys.platform == 'linux', 'Linux process ownership gate')
    def test_a_reused_pid_does_not_terminate_an_unrelated_process(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(service, 'PRIVATE', Path(directory)):
            child = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)'], start_new_session=True)
            try:
                (Path(directory)/'power.pid').write_text(str(child.pid))
                with self.assertRaisesRegex(RuntimeError, 'unrelated'):
                    service.stop_owned('power', Path('/not/this/deployment/a3s-power'))
                self.assertIsNone(child.poll())
            finally:
                child.terminate()
                child.wait(timeout=5)


if __name__ == '__main__':
    unittest.main()
