#!/usr/bin/env python3
"""Finite unauthenticated IPv4 socket-interface A/B; never change host routing."""
from datetime import datetime, timezone
import hashlib
import http.client
import json
import os
from pathlib import Path
import socket
import struct
import threading
import time

HERE = Path(__file__).resolve().parent
TARGET = ('117.162.0.179', 8080)
SDK = Path(r'C:\Program Files (x86)\Windows Kits\10\Include\10.0.26100.0\shared\ws2ipdef.h')
SDK_SHA = '31395c8b1b6d00f73bbcdea55d7d88e0cc9d5fcee6565b1c407808bbff067abe'
PHYSICAL_INDEX = 4
PHYSICAL_SOURCE_SHA = '207f103d49122d05e7462d76976090c1895d1ba21041e749f1f69b2806e81a1a'
DOCUMENTATION = 'https://learn.microsoft.com/en-us/windows/win32/winsock/ipproto-ip-socket-options'


def constant():
    raw = SDK.read_bytes()
    if len(raw) > 1024 * 1024 or hashlib.sha256(raw).hexdigest() != SDK_SHA:
        raise RuntimeError('Windows SDK constant provenance differs')
    rows = [row.split() for row in raw.decode().splitlines()]
    values = [row[2] for row in rows if len(row) >= 3 and row[:2] == ['#define', 'IP_UNICAST_IF']]
    if len(values) != 1 or not values[0].isdecimal():
        raise RuntimeError('exact SDK socket constant is unavailable')
    return int(values[0])


def selection(sock, option, index):
    if index is not None:
        sock.setsockopt(socket.IPPROTO_IP, option, struct.pack('!I', index))
    actual = sock.getsockopt(socket.IPPROTO_IP, option)
    if index is not None and actual != index:
        raise RuntimeError('outgoing interface readback differs')
    return actual


def once(option, interface, index):
    started = time.monotonic()
    row = {'interface': interface, 'requested_if_index': index,
           'observed_utc': datetime.now(timezone.utc).isoformat(), 'status': 'started',
           'http_status': None, 'phase': 'socket-option', 'connect_budget_seconds': 3,
           'total_budget_seconds': 6, 'authorization_sent': False, 'body_read': False}
    expired = threading.Event()
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    response = None
    def abort():
        expired.set()
        try: sock.shutdown(socket.SHUT_RDWR)
        except OSError: pass
    timer = threading.Timer(6, abort)
    timer.daemon = True
    timer.start()
    try:
        row['readback_before_connect'] = selection(sock, option, index)
        row['phase'] = 'connect'
        sock.settimeout(3)
        sock.connect(TARGET)
        row['connect_seconds'] = time.monotonic() - started
        source, port = sock.getsockname()
        row['local_port'] = port
        row['source_ip_sha256'] = hashlib.sha256(source.encode()).hexdigest()
        row['readback_after_connect'] = sock.getsockopt(socket.IPPROTO_IP, option)
        if index is not None and (row['readback_after_connect'] != index or row['source_ip_sha256'] != PHYSICAL_SOURCE_SHA):
            row['status'] = 'unsupported-selection-mismatch'
            return row
        row['phase'] = 'headers'
        remaining = 6 - (time.monotonic() - started)
        if remaining <= 0 or expired.is_set():
            raise TimeoutError('owned socket absolute deadline')
        sock.settimeout(remaining)
        sock.sendall(b'GET /v1/models HTTP/1.1\r\nHost: 117.162.0.179:8080\r\nConnection: close\r\n\r\n')
        response = http.client.HTTPResponse(sock)
        response.begin()
        if expired.is_set():
            raise TimeoutError('owned socket absolute deadline')
        row.update(status='headers-received', http_status=response.status, phase='headers-complete',
                   expected_unauthenticated_401=response.status == 401)
    except Exception as error:
        row.update(status='failed', exception=type(error).__name__,
                   winerror=getattr(error, 'winerror', None), errno=getattr(error, 'errno', None))
    finally:
        timer.cancel()
        if response is not None: response.close()
        sock.close()
        row.update(elapsed_seconds=time.monotonic() - started, absolute_deadline_expired=expired.is_set(),
                   owned_socket_closed=True)
    return row


def write(path, value):
    temporary = path.with_suffix('.own-tmp')
    with temporary.open('x', encoding='utf-8') as output:
        json.dump(value, output, indent=2)
        output.write('\n')
    os.replace(temporary, path)


def main():
    target = HERE / 'network-per-socket-interface-ab1.json'
    if target.exists():
        raise RuntimeError('existing A/B evidence; no retry or replacement')
    option = constant()
    # Prove OS support on an unconnected owned socket before any network call.
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as trial:
        readback = selection(trial, option, PHYSICAL_INDEX)
    result = {'schema': 'a3s.owned-socket-interface-noauth-ab.v1', 'status': 'running',
              'destination': {'host': TARGET[0], 'port': TARGET[1], 'path': '/v1/models'},
              'physical_interface': {'index': PHYSICAL_INDEX, 'description': 'Intel(R) Ethernet Controller I226-LM',
                                     'hardware_interface': True, 'virtual': False,
                                     'source_ip_sha256': PHYSICAL_SOURCE_SHA, 'default_gateway_present': True,
                                     'gateway_sha256': 'f7b4145d3cd893febefdeffcf692fa53f43ac6675350e7316ad031f865082fa2',
                                     'default_route': '0.0.0.0/0', 'route_metric': 0, 'interface_metric': 25},
              'constant_provenance': {'path': str(SDK), 'sha256': SDK_SHA, 'line': 156,
                                      'name': 'IP_UNICAST_IF', 'value': option, 'documentation': DOCUMENTATION,
                                      'set_encoding': 'struct.pack(!I, ifindex), network byte order',
                                      'get_encoding': 'host-order integer', 'unconnected_readback': readback},
              'limits': {'attempts_per_interface': 16, 'max_total_attempts': 32,
                         'connect_seconds': 3, 'request_seconds': 6, 'global_seconds': 210},
              'records': [], 'authorization_sent': False, 'model_inference_requests': 0,
              'route_or_vpn_changes': False,
              'not_claimed': ['bypass of all Windows Filtering Platform middleware',
                              'identification of a failing device', 'authenticated public performance']}
    with target.open('x', encoding='utf-8') as output: json.dump(result, output)
    for repeat in range(1, 17):
        # Alternate which path goes first to expose time-order effects.
        arms = [('default-routing', None), ('owned-physical-interface', PHYSICAL_INDEX)]
        if repeat % 2 == 0: arms.reverse()
        for name, index in arms:
            result['pending'] = {'repeat': repeat, 'interface': name}
            write(target, result)
            row = once(option, name, index)
            row['repeat'] = repeat
            result['records'].append(row)
            result.pop('pending', None)
            write(target, result)
            if row['status'].startswith('unsupported') or row['phase'] == 'socket-option':
                result['status'] = 'unsupported-no-fallback'
                write(target, result)
                return
    result['status'] = 'completed'
    result['summary'] = {name: {'attempts': sum(row['interface'] == name for row in result['records']),
                              'http_401': sum(row['interface'] == name and row['http_status'] == 401 for row in result['records']),
                              'failed': sum(row['interface'] == name and row['status'] != 'headers-received' for row in result['records'])}
                         for name in ('default-routing', 'owned-physical-interface')}
    write(target, result)
    print(json.dumps({'file': target.name, 'status': result['status'], 'summary': result['summary']}))


if __name__ == '__main__':
    watchdog = threading.Timer(210, lambda: os._exit(124))
    watchdog.daemon = True
    watchdog.start()
    try: main()
    finally: watchdog.cancel()
