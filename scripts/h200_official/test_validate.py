import json
import unittest
import tempfile
import socket
import sys
from pathlib import Path
from unittest.mock import patch

import validate


class SafeStateTests(unittest.TestCase):
    def test_frontend_cannot_claim_more_slots_than_the_engine_reports(self):
        for capacity in (None, True, '32', 4):
            with self.subTest(capacity=capacity), self.assertRaisesRegex(RuntimeError, 'verified upstream capacity'):
                validate.serving_limit({'configuration': {'max_running_requests': capacity}}, 8)
        self.assertEqual(validate.serving_limit({'configuration': {'max_running_requests': 32}}, 16), 16)
        for concurrency in (0, 3, True, 64):
            with self.subTest(concurrency=concurrency), self.assertRaises(ValueError):
                validate.serving_limit({'configuration': {'max_running_requests': 32}}, concurrency)

    def test_benchmark_above_frontend_capacity_never_sends_requests(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(validate, 'ROOT', Path(directory)), \
                patch.object(validate, 'request_once') as request:
            root = Path(directory)/'run'
            root.mkdir()
            (root/'qualification.json').write_text('{"passed":true}')
            (root/'frontend.json').write_text('{"exact_benchmark_usage":true,"max_concurrent_requests":4}')
            with self.assertRaisesRegex(RuntimeError, 'frontend admission limit'):
                validate.benchmark((1, 8))
            request.assert_not_called()

    def test_benchmark_rejects_unbounded_or_ambiguous_campaigns(self):
        for concurrencies, rounds, name in [((1, 1), 3, 'out.json'), ((3,), 3, 'out.json'),
                                            ((1,), 4, 'out.json'), ((1,), 3, '../out.json')]:
            with self.subTest(case=(concurrencies, rounds, name)), self.assertRaises(ValueError):
                validate.benchmark(concurrencies, rounds, name)

    @unittest.skipUnless(sys.platform == 'linux', 'Linux listener reuse semantics')
    def test_a_live_listener_is_never_treated_as_a_free_port(self):
        with socket.socket() as listener:
            listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            listener.bind(('127.0.0.1', 0))
            listener.listen(1)
            with self.assertRaises(OSError):
                validate.ensure_ports_free((listener.getsockname()[1],))

    @unittest.skipUnless(sys.platform == 'linux', 'Linux TIME_WAIT regression')
    def test_time_wait_does_not_prevent_an_owned_frontend_upgrade(self):
        with socket.socket() as listener, socket.socket() as client:
            listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            listener.bind(('127.0.0.1', 0))
            port = listener.getsockname()[1]
            listener.listen(1)
            client.connect(('127.0.0.1', port))
            accepted, _ = listener.accept()
            accepted.shutdown(socket.SHUT_WR)
            accepted.close()
            self.assertEqual(client.recv(1), b'')
        validate.ensure_ports_free((port,))

    def test_privacy_rounded_usage_cannot_certify_token_speed(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(validate, 'ROOT', Path(directory)), \
                patch.object(validate, 'request_once') as request:
            root = Path(directory)/'run'
            root.mkdir()
            (root/'qualification.json').write_text('{"passed":true}')
            (root/'frontend.json').write_text('{"exact_benchmark_usage":false}')
            with self.assertRaisesRegex(RuntimeError, 'privacy-rounded counts'):
                validate.benchmark()
            request.assert_not_called()

    def test_runtime_credentials_never_enter_retained_state(self):
        info = {'model_path': validate.MODEL_PATH, 'tp_size': 8, 'api_key': 'sentinel-secret',
                'internal_states': [{'api_key': 'sentinel-secret', 'last_gen_throughput': 64.2}]}
        with patch.object(Path, 'read_text', return_value='local-runtime-credential'), \
                patch.object(validate, 'read_json', return_value=info):
            record = validate.safe_engine_state()
        self.assertNotIn('sentinel-secret', json.dumps(record))
        self.assertNotIn('local-runtime-credential', json.dumps(record))
        self.assertEqual(record['workers'], [{'last_gen_throughput': 64.2}])

    def test_a_different_model_cannot_be_reported_as_the_pinned_model(self):
        with patch.object(Path, 'read_text', return_value='local-runtime-credential'), \
                patch.object(validate, 'read_json', return_value={'model_path': '/other/model', 'tp_size': 8}):
            with self.assertRaisesRegex(RuntimeError, 'not the pinned'):
                validate.safe_engine_state()


if __name__ == '__main__':
    unittest.main()
