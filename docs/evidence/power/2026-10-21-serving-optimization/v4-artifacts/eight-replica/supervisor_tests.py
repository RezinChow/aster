#!/usr/bin/env python3
"""Hermetic ownership and loopback HTTP deadline fixtures; no external services."""
from pathlib import Path
import importlib.util
import json
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('wrappers', Path(__file__).with_name('supervisor.py'))
w = importlib.util.module_from_spec(spec)
spec.loader.exec_module(w)


class WrapperContracts(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.patcher = patch.object(w, 'RUN', self.root)
        self.patcher.start()

    def tearDown(self):
        self.patcher.stop()
        self.temp.cleanup()

    def receipt(self, kind='power', index=7):
        value = {'kind': kind, 'index': index, 'slots': 2, 'pid': 12345,
                 'start_ticks': 1001, 'argv': w.argv(kind, index, 2),
                 'created_at': 'fixture', 'log': str(self.root / 'fixture.log')}
        w.atomic(w.recordfile(kind, index), value)
        w.immutable(w.pidfile(kind, index), '12345\n')
        return value

    def test_closed_ports_cannot_name_native_as_owned_kind(self):
        self.assertEqual(w.ports(7), {'native': 18107, 'power': 19507, 'gateway': 19897})
        for index in (-1, 8, True, '7'):
            with self.assertRaises(ValueError):
                w.ports(index)
        with self.assertRaises(ValueError):
            w.pidfile('native', 7)
        with self.assertRaises(ValueError):
            w.argv('native', 7, 2)

    def test_duplicate_workers_refused(self):
        with self.assertRaises(ValueError):
            w.selected([7, 7])

    def test_reused_pid_never_signaled(self):
        receipt = self.receipt()
        with patch.object(w, 'proc', return_value={'argv': receipt['argv'], 'start_ticks': 1002}), patch.object(w.os, 'kill') as kill:
            with self.assertRaises(RuntimeError):
                w.stop('power', 7)
            kill.assert_not_called()

    def test_native_argv_in_receipt_never_signaled(self):
        receipt = self.receipt()
        receipt['argv'] = ['/data/prism/llama-server', '--port', '18107']
        w.atomic(w.recordfile('power', 7), receipt)
        with patch.object(w.os, 'kill') as kill:
            with self.assertRaises(RuntimeError):
                w.stop('power', 7)
            kill.assert_not_called()

    def test_native_pid_replaced_into_pidfile_never_signaled(self):
        self.receipt()
        w.pidfile('power', 7).write_text('99999\n')
        with patch.object(w.os, 'kill') as kill:
            with self.assertRaises(RuntimeError):
                w.stop('power', 7)
            kill.assert_not_called()

    def test_wrong_live_argv_never_signaled(self):
        self.receipt()
        with patch.object(w, 'proc', return_value={'argv': ['/opt/a3s/bin/a3s-power'], 'start_ticks': 1001}), patch.object(w.os, 'kill') as kill:
            with self.assertRaises(RuntimeError):
                w.stop('power', 7)
            kill.assert_not_called()

    def test_exact_private_child_gets_one_term_then_archived(self):
        receipt = self.receipt()
        with patch.object(w, 'proc', side_effect=[{'argv': receipt['argv'], 'start_ticks': 1001}, None]), patch.object(w.os, 'kill') as kill:
            w.stop('power', 7)
            kill.assert_called_once_with(12345, w.signal.SIGTERM)
        self.assertFalse(w.pidfile('power', 7).exists())
        self.assertEqual(len(list(self.root.glob('stopped-power-7-*.json'))), 1)

    def test_render_has_no_native_or_process_side_effects_or_fake_identity(self):
        # Exercise the real provenance validator against synthetic fixture files.
        actual_q = Path('/code/aster/scripts/power_serving_qualification.py')
        if not actual_q.exists():
            self.skipTest('host qualification source not available')
        corpus = self.root / 'fixture-corpus.jsonl'
        corpus.write_text(json.dumps({'name': 'fixture', 'request': {'model': w.ALIAS}}) + '\n')
        base = {field: 'a' * 64 for field in ('source_diff_sha256', 'binary_sha256', 'model_sha256', 'runtime_sha256', 'config_redacted_sha256', 'corpus_sha256')}
        base.update(arm='candidate', source_head='fixture', context_per_sequence=32768,
                    sampling={'temperature': 0}, cache_mode='fixture', slots=1, gpu_indices=[7], runtime_flags={})
        (self.root / 'candidate-v4-provenance.json').write_text(json.dumps(base))
        with patch.object(w, 'ROOT', self.root), patch.object(w, 'CORPUS', corpus), patch.object(w, 'CORPUS_SHA', w.digest(corpus)), patch.object(w, 'benchmark_key', return_value='synthetic-only-test-key'), patch.object(w.subprocess, 'Popen') as popen, patch.object(w.subprocess, 'run') as run, patch.object(w, 'request') as request, patch.object(w.os, 'kill') as kill:
            result = w.render([7], 2)
            self.assertEqual(result['status'], 'rendered-not-started')
            for mock in (popen, run, request, kill):
                mock.assert_not_called()
        self.assertFalse((self.root / 'worker-7-identity.json').exists())
        self.assertFalse((self.root / 'worker-7-provenance.json').exists())
        self.assertFalse((self.root / 'worker-7-home').exists())
        self.assertTrue((self.root / 'worker-7-np2-provenance.template.json').exists())
        self.assertIn('prism-27b', (self.root / 'worker-7-np2-provenance.template.json').read_text())


    def test_registration_can_wait_for_header_beyond_connect_timeout(self):
        import http.server
        import threading
        import time
        class Handler(http.server.BaseHTTPRequestHandler):
            def do_POST(self):
                self.rfile.read(int(self.headers.get('Content-Length', '0')))
                time.sleep(5.15)
                raw = b'{"registered":true}'
                self.send_response(201)
                self.send_header('Content-Length', str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)
            def log_message(self, *args):
                pass
        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        begin = time.monotonic()
        try:
            with patch.object(w, 'ports', return_value={'power': server.server_port}):
                code, body = w.request(7, 'power', '/v1/models', {'synthetic': True}, timeout=8)
            self.assertEqual(code, 201)
            self.assertEqual(body, {'registered': True})
            self.assertGreater(time.monotonic() - begin, 5)
            self.assertLess(time.monotonic() - begin, 8)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(1)

    def test_absolute_deadline_stops_detached_slow_body(self):
        import http.server
        import threading
        import time
        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                raw = b'{"ok":true}'
                self.send_response(200)
                self.send_header('Content-Length', str(len(raw)))
                self.send_header('Connection', 'close')
                self.end_headers()
                try:
                    for byte in raw:
                        self.wfile.write(bytes([byte]))
                        self.wfile.flush()
                        time.sleep(.06)
                except OSError:
                    pass
            def log_message(self, *args):
                pass
        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        begin = time.monotonic()
        try:
            with patch.object(w, 'ports', return_value={'power': server.server_port}):
                with self.assertRaises((OSError, ValueError)):
                    w.request(7, 'power', '/health', timeout=.18)
            self.assertLess(time.monotonic() - begin, .8)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(1)


if __name__ == '__main__':
    unittest.main()
