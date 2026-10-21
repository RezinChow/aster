#!/usr/bin/env python3
"""Independent selected-interface measurement; original default-route failures stay failed."""
import argparse
import contextlib
import hashlib
import importlib.util
import ipaddress
import json
import math
import os
from pathlib import Path
import socket
import struct
import sys
import threading
from unittest import mock

HERE = Path(__file__).resolve().parent
TARGET = ('117.162.0.179', 8080)
IP_UNICAST_IF = 31  # Windows SDK ws2ipdef.h:156; GET host order, SET network order.
OFFICIAL = 'https://learn.microsoft.com/en-us/windows/win32/winsock/ipproto-ip-socket-options'
PROOF = HERE / 'network-per-socket-interface-ab1.json'
PROOF_SHA = '1bf7b6df35434c6dab397ea216526c3ff430f631ec26135ed43429b516645281'
PINS = {
    'public_helper': (HERE / 'public-frontdoor-qualification.py', 'd8920142263505cbc90015dc6fd13d6819085bd88e414c30ec76b9513636d79b'),
    'runner': (HERE.parents[3] / 'scripts/power_serving_qualification.py', '576b2d13811482024522e790f901647ac79dc6cc4368a2622a71adef856fe546'),
    'matrix': (HERE / 'matrix-campaign.py', 'b1e24fd648da9b7ae31cb3d3ace44c4b9b91dc6c793a0d9de7ac114ba1b821e4'),
    'canary': (HERE / 'canary-scenarios.py', '1960de0dd2c8dbec7338f808ddbd207972fb63844fa022607bb676f1069c459e'),
    'eight': (HERE / 'eight-card-qualification.py', '9385bf26ec9dd6ea971612356214ff2691e319318a87bbddaa3eaded5996675e'),
    'corpus': (HERE / 'eight-card-corpus.jsonl', '1791c2cc7f6496454c69c903f2c3a82b61240b0e46d6b9b690747a6e7b113256'),
}


class Unsupported(RuntimeError):
    pass


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def original_pins():
    actual = {name: digest(path) for name, (path, _) in PINS.items()}
    if actual != {name: expected for name, (_, expected) in PINS.items()}:
        raise Unsupported('original instrument or corpus differs')
    return actual


def selection_proof(path=PROOF, expected_sha=PROOF_SHA):
    if path.is_symlink():
        raise Unsupported('selection receipt symlink refused')
    with path.open('rb') as stream:
        raw = stream.read(128 * 1024 + 1)
    if len(raw) > 128 * 1024 or hashlib.sha256(raw).hexdigest() != expected_sha:
        raise Unsupported('actual selection receipt differs from approved proof')
    value = json.loads(raw)
    physical, constant = value.get('physical_interface', {}), value.get('constant_provenance', {})
    index, source_hash = physical.get('index'), physical.get('source_ip_sha256')
    if (value.get('schema') != 'a3s.owned-socket-interface-noauth-ab.v1' or value.get('status') != 'completed'
            or value.get('destination') != {'host': TARGET[0], 'port': TARGET[1], 'path': '/v1/models'}
            or physical.get('hardware_interface') is not True or physical.get('virtual') is not False
            or physical.get('default_gateway_present') is not True
            or type(index) is not int or not 0 < index < 2**24
            or not isinstance(source_hash, str) or len(source_hash) != 64 or any(c not in '0123456789abcdef' for c in source_hash)
            or constant.get('name') != 'IP_UNICAST_IF' or constant.get('value') != IP_UNICAST_IF
            or constant.get('sha256') != '31395c8b1b6d00f73bbcdea55d7d88e0cc9d5fcee6565b1c407808bbff067abe'
            or constant.get('set_encoding') != 'struct.pack(!I, ifindex), network byte order'
            or constant.get('get_encoding') != 'host-order integer'):
        raise Unsupported('physical interface receipt or official option contract differs')
    records = value.get('records')
    if not isinstance(records, list) or len(records) != 32:
        raise Unsupported('finite selection experiment is incomplete')
    physical_records = [row for row in records if row.get('interface') == 'owned-physical-interface']
    if len(physical_records) != 16 or sorted(row.get('repeat') for row in physical_records) != list(range(1, 17)):
        raise Unsupported('actual physical route experiment needs all16 attempts')
    for row in physical_records:
        if (row.get('requested_if_index') != index or row.get('readback_before_connect') != index
                or row.get('readback_after_connect') != index or row.get('source_ip_sha256') != source_hash
                or row.get('status') != 'headers-received' or row.get('http_status') != 401
                or row.get('authorization_sent') is not False or row.get('owned_socket_closed') is not True
                or row.get('absolute_deadline_expired') is not False):
            raise Unsupported('actual physical route experiment failed a required gate')
    return {'interface_index': index, 'source_ip_sha256': source_hash,
            'hardware_interface': True, 'virtual': False, 'eligibility': '16of16 owned-socket no-auth401 probes'}, expected_sha


class InterfaceConnections:
    def __init__(self, ifindex, source_sha256, original=None, factory=None, windows=None):
        if type(ifindex) is not int or not 0 < ifindex < 2**24:
            raise Unsupported('explicit nonzero24bit interface index required')
        if (os.name == 'nt' if windows is None else windows) is not True:
            raise Unsupported('Windows IPv4 socket option required')
        if (not isinstance(source_sha256, str) or len(source_sha256) != 64
                or any(c not in '0123456789abcdef' for c in source_sha256)):
            raise Unsupported('exact selected-interface source hash required')
        self.ifindex = ifindex
        self.source_sha256 = source_sha256
        self.original = original or socket.create_connection
        self.factory = factory or socket.socket
        self.lock = threading.Lock()
        self.counts = {'target_attempts': 0, 'set_verified': 0, 'connected_verified': 0, 'failures': 0}
        self.samples = []

    def connect(self, address, timeout=socket._GLOBAL_DEFAULT_TIMEOUT, source_address=None, *, all_errors=False):
        if address != TARGET:
            return self.original(address, timeout, source_address, all_errors=all_errors)
        if (type(timeout) not in (int, float) or not math.isfinite(timeout) or not 0 < timeout <= 120
                or source_address is not None or all_errors):
            raise Unsupported('target connection arguments lack supported finite bounds')
        with self.lock:
            self.counts['target_attempts'] += 1
        stream, stage = None, 'socket'
        try:
            stream = self.factory(socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP)
            if stream.family != socket.AF_INET or stream.type != socket.SOCK_STREAM:
                raise Unsupported('strict IPv4 TCP socket required')
            stream.settimeout(timeout)
            stage = 'setsockopt'
            packed = struct.pack('!I', self.ifindex)
            stream.setsockopt(socket.IPPROTO_IP, IP_UNICAST_IF, packed)
            stage = 'readback-before-connect'
            readback = stream.getsockopt(socket.IPPROTO_IP, IP_UNICAST_IF)
            if type(readback) is not int or readback != self.ifindex:
                raise Unsupported('interface host-order readback differs')
            with self.lock:
                self.counts['set_verified'] += 1
            stage = 'connect'
            stream.connect(TARGET)
            stage = 'readback-after-connect'
            connected_readback = stream.getsockopt(socket.IPPROTO_IP, IP_UNICAST_IF)
            if type(connected_readback) is not int or connected_readback != self.ifindex:
                raise Unsupported('connected interface readback differs')
            stage = 'source-interface-match'
            local = stream.getsockname()
            if not isinstance(local, tuple) or len(local) != 2 or type(local[1]) is not int or not 0 < local[1] <= 65535:
                raise Unsupported('connected IPv4 source shape differs')
            source_hash = hashlib.sha256(str(ipaddress.IPv4Address(local[0])).encode()).hexdigest()
            if source_hash != self.source_sha256:
                raise Unsupported('connected source differs from selected interface proof')
            with self.lock:
                self.counts['connected_verified'] += 1
                if len(self.samples) < 16:
                    self.samples.append({'set_network_order_hex': packed.hex(), 'get_host_order': readback,
                                         'source_sha256': source_hash, 'family': 'AF_INET', 'target': list(TARGET)})
            return stream
        except BaseException as exc:
            if stream is not None:
                stream.close()
            with self.lock:
                self.counts['failures'] += 1
                if len(self.samples) < 16:
                    self.samples.append({'failure_stage': stage, 'exception': type(exc).__name__})
            raise

    def summary(self):
        with self.lock:
            return {'interface_index': self.ifindex, 'socket_option': IP_UNICAST_IF,
                    'expected_source_sha256': self.source_sha256,
                    'semantics_source': OFFICIAL, 'counts': dict(self.counts), 'samples': list(self.samples),
                    'fallback_used': False, 'global_route_or_proxy_changes': False,
                    'not_claimed': 'selected outgoing interface does not prove absence of intermediaries'}


def load_public():
    spec = importlib.util.spec_from_file_location('unchanged_public_instrument', PINS['public_helper'][0])
    public = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(public)
    return public


def run_cells(selection, proof_sha256):
    """Only called after actual selection-proof validation and a separate operator GO."""
    actual_selection, actual_proof_sha = selection_proof()
    if selection != actual_selection or proof_sha256 != actual_proof_sha:
        raise Unsupported('execution selection is not the actual approved receipt')
    pins = original_pins()
    wrapper_sha = digest(Path(__file__))
    public = load_public()
    if (public.HOST, public.PORT) != TARGET:
        raise Unsupported('fixed public target differs')
    target = HERE / 'public-selected-interface-v4-summary.json'
    cells = [(c, 'selected-interface-v4-c' + str(c) + '-attempt1') for c in (1, 8, 16, 32)]
    if target.exists() or any((HERE / ('public-' + tag + '.json')).exists() for _, tag in cells):
        raise Unsupported('existing namespace retained; no overwrite or automatic retry')
    guard = InterfaceConnections(selection['interface_index'], selection['source_ip_sha256'])
    result = {'qualification_status': 'starting', 'scope': __doc__, 'selection': selection,
              'selection_proof_sha256': proof_sha256, 'original_pins': pins, 'wrapper_sha256': wrapper_sha,
              'measurement_condition': 'only this process fixed117.162.0.179:8080 IPv4 sockets select the proved outgoing interface',
              'network_factor': 'default route changed to only-process approved physical interface selection',
              'causal_software_speedup': False,
              'not_claimed': ['original default-route failure repaired', 'absence of intermediate network devices',
                              'native-exclusive throughput', 'Work UI or Darwin client qualification'], 'cells': []}
    watchdog = threading.Timer(1800, lambda: os._exit(124))
    watchdog.daemon = True
    watchdog.start()
    try:
        with mock.patch.object(socket, 'create_connection', new=guard.connect):
            for concurrency, tag in cells:
                if original_pins() != pins or digest(Path(__file__)) != wrapper_sha or selection_proof() != (selection, proof_sha256):
                    raise Unsupported('qualification source identity changed')
                before = guard.summary()['counts']
                with mock.patch.object(sys, 'argv', [str(public.__file__), '--tag', tag, '--pressure', '--seconds', '60', '--concurrency', str(concurrency)]):
                    code = public.main()
                after = guard.summary()['counts']
                delta = {name: after[name] - before[name] for name in after}
                result['cells'].append({'concurrency': concurrency, 'file': 'public-' + tag + '.json', 'exit_code': code, 'socket_counts_delta': delta})
                result['socket_observation'] = guard.summary()
                public.m.write_result(target, result)
                if code:
                    raise RuntimeError('public cell failed; remaining cells not dispatched')
                if (delta['target_attempts'] <= 0 or delta['connected_verified'] != delta['target_attempts']
                        or delta['set_verified'] != delta['target_attempts'] or delta['failures']):
                    raise Unsupported('target socket hook did not validate every cell connection')
        if (original_pins() != pins or digest(Path(__file__)) != wrapper_sha
                or selection_proof() != (selection, proof_sha256) or guard.summary()['counts']['failures']):
            raise Unsupported('source changed or a selected-interface socket failed')
        result['qualification_status'] = 'passed'
    except Exception as exc:
        result.update(qualification_status='failed', failure_exception=type(exc).__name__)
    finally:
        watchdog.cancel()
        result['socket_observation'] = guard.summary()
        public.m.write_result(target, result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true', help='requires separate operator GO after shared eight-card load ends')
    args = parser.parse_args()
    selection, proof_sha = selection_proof()
    original_pins()
    if not args.execute:
        print(json.dumps({'status': 'prepared-only', 'selection': selection, 'proof_sha256': proof_sha,
                          'credentials_read': False, 'network_requests_issued': 0}))
        return 0
    result = run_cells(selection, proof_sha)
    print(json.dumps({'qualification_status': result['qualification_status'], 'cells': result['cells']}))
    return 0 if result['qualification_status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
