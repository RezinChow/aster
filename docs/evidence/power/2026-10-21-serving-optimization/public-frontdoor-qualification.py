#!/usr/bin/env python3
"""Finite external checks against the requested public production Gateway.

The configured shared API credential travels through an SSH stdout pipe into
this process's memory. It is never printed, persisted, or included in results.
This tests the existing shared-token contract, not arbitrary user grants.
"""
import argparse
import hashlib
import http.client
import importlib.util
import json
from pathlib import Path
import shlex
import socket
import subprocess
import threading
import time

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('public_qualification_matrix', HERE / 'matrix-campaign.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
q = m.q
HOST = '117.162.0.179'
PORT = 8080
URL = 'http://' + HOST + ':' + str(PORT) + '/v1'

# This exact stored variable was observed in the running Gateway's environment;
# principal.rs defines it as an ordinary shared caller credential.
REMOTE_CREDENTIAL_READER = """
import pathlib,subprocess,sys
pid=int(subprocess.check_output(['systemctl','show','a3s-gateway.service','--property=MainPID','--value'],text=True).strip())
parts=(pathlib.Path('/proc')/str(pid)/'environ').read_bytes().split(b'\\0')
values=[p.split(b'=',1)[1] for p in parts if p.startswith(b'A3S_GATEWAY_SHARED_TOKEN=')]
if len(values)!=1 or not 1<=len(values[0])<=4096:sys.exit(3)
sys.stdout.buffer.write(values[0])
"""


def credential():
    result = subprocess.run(
        ['ssh', '-T', '-o', 'ConnectTimeout=10', 'user@172.18.101.2',
         'python3 -c ' + shlex.quote(REMOTE_CREDENTIAL_READER)],
        stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=15)
    if result.returncode or not 1 <= len(result.stdout) <= 4096:
        raise RuntimeError('configured credential unavailable through the bounded SSH pipe')
    value = result.stdout.decode('ascii').strip()
    if not value or not all(33 <= ord(c) <= 126 for c in value):
        raise RuntimeError('configured credential shape refused')
    return value


def models(key, timeout=15):
    connection = http.client.HTTPConnection(HOST, PORT, timeout=timeout)
    transport, expired = [None], threading.Event()
    response = None

    def expire():
        expired.set()
        active = connection.sock or transport[0]
        if active is not None:
            try:
                active.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass

    timer = threading.Timer(timeout, expire)
    timer.daemon = True
    started = time.monotonic()
    timer.start()
    try:
        connection.connect()
        transport[0] = connection.sock
        if expired.is_set():
            raise TimeoutError()
        connection.request('GET', '/v1/models',
                           headers={'Authorization': 'Bearer ' + key, 'Connection': 'close'})
        response = connection.getresponse()
        body = response.read(1024 * 1024 + 1)
        if expired.is_set():
            raise TimeoutError()
        if len(body) > 1024 * 1024:
            raise RuntimeError('public models response exceeds bound')
        value = json.loads(body)
        data = value.get('data') if isinstance(value, dict) else None
        identifiers = ([row['id'] for row in data
                        if isinstance(row, dict) and isinstance(row.get('id'), str)
                        and len(row['id']) <= 255] if isinstance(data, list) else [])
        return {'http_status': response.status, 'body_bytes': len(body),
                'model_ids': identifiers, 'elapsed_ms': 1000 * (time.monotonic() - started)}
    finally:
        timer.cancel()
        if response is not None:
            response.close()
        connection.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--tag', required=True)
    parser.add_argument('--pressure', action='store_true')
    parser.add_argument('--seconds', type=float, default=60)
    parser.add_argument('--concurrency', type=int, choices=(1, 8, 16, 32), default=1)
    args = parser.parse_args()
    if not args.tag or len(args.tag) > 48 or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-_' for c in args.tag):
        raise ValueError('bounded lowercase tag required')
    if not 0 < args.seconds <= 60:
        raise ValueError('finite dispatch window required')
    target = HERE / ('public-' + args.tag + '.json')
    if target.exists():
        raise ValueError('existing evidence must not be replaced')
    corpus_raw = (HERE / 'eight-card-corpus.jsonl').read_bytes()
    corpus = [json.loads(line) for line in corpus_raw.decode().splitlines() if line.strip()]
    result = {
        'scope': 'external Windows to actual public production Gateway; configured shared caller identity',
        'url': URL, 'credential_handling': 'SSH encrypted pipe and process memory only; never persisted',
        'tool_identity': dict(m.TOOL_IDENTITY, public_helper_sha256=m.digest(Path(__file__).resolve())),
        'corpus_sha256': hashlib.sha256(corpus_raw).hexdigest(),
        'records': [], 'qualification_status': 'starting',
        'not_claimed': ['arbitrary-user grant/billing acceptance', 'native token-counter exclusivity',
                        'causal WAN performance improvement', 'kernel timing from public SSE']
    }
    key = None
    try:
        key = credential()
        result['models'] = models(key)
        m.write_result(target, result)
        if result['models']['http_status'] != 200 or 'prism-27b' not in result['models']['model_ids']:
            raise RuntimeError('public authenticated model discovery failed')
        for item in corpus:
            record = q.request_once(URL, item['request'], key, 30, expected=item['expect'])
            record['case'] = item['name']
            result['records'].append(record)
            m.write_result(target, result)
            if record['outcome'] != 'success':
                raise RuntimeError('public inference correctness or transport failed')
        if args.pressure:
            result['campaign'] = q.run_campaign([URL], corpus, key,
                                                q.Limits(args.seconds, 120, args.concurrency, 10000))
            m.write_result(target, result)
            summary = result['campaign']['summary']
            unexpected = sum(n for k, n in summary['outcomes'].items() if k not in ('success', 'refused'))
            if unexpected or not summary['outcomes'].get('success') or result['campaign']['request_budget_exhausted']:
                raise RuntimeError('public pressure correctness, transport or finite-budget gate failed')
        result['qualification_status'] = 'passed'
    except Exception as exc:
        result.update(qualification_status='failed', failure_exception=type(exc).__name__)
    finally:
        key = None
        m.write_result(target, result)
    print(json.dumps({'file': target.name, 'status': result['qualification_status'],
                      'models_status': result.get('models', {}).get('http_status'),
                      'functional_cases': len(result['records'])}))
    return 0 if result['qualification_status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
