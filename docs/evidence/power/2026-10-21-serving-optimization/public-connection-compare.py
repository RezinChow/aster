#!/usr/bin/env python3
"""One TCP-only public probe and one private-IP HTTP comparison, no retries."""
import copy
import importlib.util
import json
from pathlib import Path
import socket
import time

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('keepalive_compare', HERE / 'public-keepalive-repro.py')
k = importlib.util.module_from_spec(spec)
spec.loader.exec_module(k)


def main():
    target = HERE / 'public-connection-compare-v1.json'
    if target.exists():
        raise ValueError('existing evidence must not be replaced')
    previous = json.loads((HERE / 'public-keepalive-v1.json').read_text())
    deadline = previous['started_monotonic'] + 180
    result = {'scope': 'one public TCP-only connect and one same-body private-IP request after failed public connect',
              'tool_identity': dict(k.m.TOOL_IDENTITY, compare_sha256=k.m.digest(Path(__file__))),
              'public_probe': {}, 'records': []}
    started = time.monotonic()
    client, key = k.Persistent('172.18.101.2', 8080), None
    try:
        with socket.create_connection((k.p.HOST, k.p.PORT), timeout=min(5, deadline - time.monotonic())) as probe:
            result['public_probe'] = {'connected': True, 'elapsed_ms': 1000 * (time.monotonic() - started), 'local_port': probe.getsockname()[1]}
    except OSError as exc:
        result['public_probe'] = {'connected': False, 'elapsed_ms': 1000 * (time.monotonic() - started), 'error': type(exc).__name__}
    k.m.write_result(target, result)
    try:
        if deadline - time.monotonic() <= 15:
            raise TimeoutError()
        key = k.p.credential()
        corpus = [json.loads(line) for line in (HERE / 'eight-card-corpus.jsonl').read_text().splitlines() if line.strip()]
        body = copy.deepcopy(next(item['request'] for item in corpus if item['name'] == 'tool-stream'))
        body['messages'] = [{'role': 'user', 'content': 'Reply with exactly READY. Do not call a tool.'}]
        row, _answer = k.request(client, body, key, min(30, deadline - time.monotonic()), {'text': 'READY', 'normalize_whitespace': True})
        row.update(actual_target='http://172.18.101.2:8080/v1', transport=client.observed, tools_present=True,
                   request_sha256=k.m.hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest())
        result['records'].append(row)
    except Exception as exc:
        result.update(failure_exception=type(exc).__name__, incomplete_transport=client.observed if hasattr(client, 'observed') else {})
    finally:
        key = None
        client.shutdown_client()
        result['elapsed_from_phase_start_seconds'] = time.monotonic() - previous['started_monotonic']
        k.m.write_result(target, result)
    print(json.dumps(result))


if __name__ == '__main__':
    main()
