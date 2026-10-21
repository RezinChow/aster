"""Owned target sockets only; never contact either the public host or a credential source."""
import hashlib
import importlib.util
import json
from pathlib import Path
import socket
import tempfile
import types
import unittest
from unittest import mock

PATH = Path(__file__).resolve().parents[1] / 'docs/evidence/power/2026-10-21-serving-optimization/public-selected-interface.py'
spec = importlib.util.spec_from_file_location('selected_interface_fixture', PATH)
w = importlib.util.module_from_spec(spec)
spec.loader.exec_module(w)
SOURCE = '192.0.2.77'
SOURCE_SHA = hashlib.sha256(SOURCE.encode()).hexdigest()


def stream():
    value = mock.Mock(family=socket.AF_INET, type=socket.SOCK_STREAM)
    value.getsockopt.return_value = 4
    value.getsockname.return_value = (SOURCE, 56789)
    return value


class SelectedInterface(unittest.TestCase):
    def test_set_network_order_get_host_order_and_exact_source_before_return(self):
        value, factory, fallback = stream(), mock.Mock(), mock.Mock()
        factory.return_value = value
        guard = w.InterfaceConnections(4, SOURCE_SHA, original=fallback, factory=factory, windows=True)
        self.assertIs(guard.connect(w.TARGET, 3), value)
        factory.assert_called_once_with(socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP)
        value.setsockopt.assert_called_once_with(socket.IPPROTO_IP, 31, b'\0\0\0\4')
        self.assertEqual(value.getsockopt.call_count, 2)
        value.connect.assert_called_once_with(w.TARGET)
        fallback.assert_not_called()
        self.assertEqual(guard.summary()['counts']['connected_verified'], 1)
        self.assertNotIn(SOURCE, str(guard.summary()))

    def test_other_targets_delegate_without_creating_or_binding_a_target_socket(self):
        factory, fallback = mock.Mock(), mock.Mock(return_value='unchanged')
        guard = w.InterfaceConnections(4, SOURCE_SHA, original=fallback, factory=factory, windows=True)
        self.assertEqual(guard.connect(('172.18.101.2', 22), 3), 'unchanged')
        fallback.assert_called_once_with(('172.18.101.2', 22), 3, None, all_errors=False)
        factory.assert_not_called()

    def test_unsupported_setsockopt_closes_owned_socket_without_connect_or_fallback(self):
        value, fallback = stream(), mock.Mock()
        value.setsockopt.side_effect = OSError('fixture unsupported')
        guard = w.InterfaceConnections(4, SOURCE_SHA, original=fallback, factory=lambda *a: value, windows=True)
        with self.assertRaises(OSError):
            guard.connect(w.TARGET, 3)
        value.close.assert_called_once()
        value.connect.assert_not_called()
        fallback.assert_not_called()

    def test_readback_mismatch_and_wrong_family_fail_before_connect_without_fallback(self):
        for family, readback in ((socket.AF_INET6, 4), (socket.AF_INET, 67108864), (socket.AF_INET, True)):
            with self.subTest(family=family, readback=readback):
                value, fallback = stream(), mock.Mock()
                value.family, value.getsockopt.return_value = family, readback
                guard = w.InterfaceConnections(4, SOURCE_SHA, original=fallback, factory=lambda *a: value, windows=True)
                with self.assertRaises(w.Unsupported):
                    guard.connect(w.TARGET, 3)
                value.close.assert_called_once()
                value.connect.assert_not_called()
                fallback.assert_not_called()

    def test_connected_source_or_readback_mismatch_closes_before_any_http_is_possible(self):
        for source, readbacks in (('192.0.2.78', (4, 4)), (SOURCE, (4, 0))):
            value = stream()
            value.getsockname.return_value = (source, 56789)
            value.getsockopt.side_effect = readbacks
            guard = w.InterfaceConnections(4, SOURCE_SHA, factory=lambda *a: value, windows=True)
            with self.assertRaises(w.Unsupported):
                guard.connect(w.TARGET, 3)
            value.close.assert_called_once()

    def test_invalid_index_platform_source_or_timeout_refuses_without_connect(self):
        for index in (0, True, -1, 2**24):
            with self.assertRaises(w.Unsupported):
                w.InterfaceConnections(index, SOURCE_SHA, windows=True)
        with self.assertRaises(w.Unsupported):
            w.InterfaceConnections(4, SOURCE_SHA, windows=False)
        with self.assertRaises(w.Unsupported):
            w.InterfaceConnections(4, 'not-a-hash', windows=True)
        factory = mock.Mock()
        guard = w.InterfaceConnections(4, SOURCE_SHA, factory=factory, windows=True)
        for timeout in (None, 0, float('inf'), 121, True):
            with self.assertRaises(w.Unsupported):
                guard.connect(w.TARGET, timeout)
        factory.assert_not_called()

    def test_frozen_public_runner_matrix_canary_eight_and_corpus_pins_unchanged(self):
        self.assertEqual(set(w.original_pins()), set(w.PINS))
        altered = dict(w.PINS)
        altered['runner'] = (w.PINS['runner'][0], '0' * 64)
        with mock.patch.object(w, 'PINS', altered), self.assertRaises(w.Unsupported):
            w.original_pins()

    def test_actual_proof_requires_all16_good_physical_attempts_and_exact_file_hash(self):
        selection, sha = w.selection_proof()
        self.assertEqual(sha, w.PROOF_SHA)
        self.assertEqual(selection['interface_index'], 4)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'proof.json'
            value = json.loads(w.PROOF.read_text(encoding='utf-8'))
            physical = next(x for x in value['records'] if x['interface'] == 'owned-physical-interface')
            physical['http_status'] = 200
            raw = json.dumps(value).encode()
            path.write_bytes(raw)
            with self.assertRaises(w.Unsupported):
                w.selection_proof(path, hashlib.sha256(raw).hexdigest())
            with self.assertRaises(w.Unsupported):
                w.selection_proof(path, w.PROOF_SHA)

    def dispatch(self, root, failed_concurrency=None, use_hook=True):
        selection, sha = w.selection_proof()
        seen, credential = [], mock.Mock()
        def cell():
            credential()
            concurrency = int(w.sys.argv[-1])
            seen.append(concurrency)
            if use_hook:
                w.socket.create_connection(w.TARGET, 3).close()
            return 1 if concurrency == failed_concurrency else 0
        public = types.SimpleNamespace(HOST=w.TARGET[0], PORT=w.TARGET[1], __file__='frozen-helper',
                                       main=cell, m=types.SimpleNamespace(write_result=mock.Mock()))
        guard = w.InterfaceConnections(selection['interface_index'], SOURCE_SHA, factory=lambda *a: stream(), windows=True)
        with mock.patch.object(w, 'HERE', root), mock.patch.object(w, 'load_public', return_value=public), mock.patch.object(w, 'InterfaceConnections', return_value=guard):
            result = w.run_cells(selection, sha)
        return result, seen, credential

    def test_cell_order_is_fixed_and_original_default_failure_bytes_remain(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            old = root / 'public-wan-v4-c1-attempt1.json'
            old.write_bytes(b'preserved-default-route-failure')
            result, seen, _ = self.dispatch(root)
            self.assertEqual(result['qualification_status'], 'passed')
            self.assertEqual(seen, [1, 8, 16, 32])
            self.assertFalse(result['causal_software_speedup'])
            self.assertTrue(all(x['socket_counts_delta']['connected_verified'] == 1 for x in result['cells']))
            self.assertEqual(old.read_bytes(), b'preserved-default-route-failure')

    def test_first_failed_cell_stops_without_dispatching_later_cells(self):
        with tempfile.TemporaryDirectory() as directory:
            result, seen, _ = self.dispatch(Path(directory), failed_concurrency=8)
            self.assertEqual(result['qualification_status'], 'failed')
            self.assertEqual(seen, [1, 8])

    def test_unused_socket_hook_cannot_pass_and_existing_namespace_reads_no_credential(self):
        with tempfile.TemporaryDirectory() as directory:
            result, seen, _ = self.dispatch(Path(directory), use_hook=False)
            self.assertEqual(result['qualification_status'], 'failed')
            self.assertEqual(seen, [1])
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'public-selected-interface-v4-c16-attempt1.json').write_bytes(b'existing')
            fake_public = types.SimpleNamespace(HOST=w.TARGET[0], PORT=w.TARGET[1], main=mock.Mock())
            selection, sha = w.selection_proof()
            with mock.patch.object(w, 'HERE', root), mock.patch.object(w, 'load_public', return_value=fake_public), self.assertRaises(w.Unsupported):
                w.run_cells(selection, sha)
            fake_public.main.assert_not_called()


if __name__ == '__main__':
    unittest.main(verbosity=2)
