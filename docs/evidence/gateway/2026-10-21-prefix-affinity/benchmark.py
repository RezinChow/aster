"""Synthetic paired tool calls through control/affinity Gateways on the GPU host."""
import copy
import argparse
import http.client
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import socket
import struct
import sys
import time
import uuid

parser = argparse.ArgumentParser(description=__doc__)
target = parser.add_mutually_exclusive_group()
target.add_argument('--public', action='store_true')
target.add_argument('--production', action='store_true')
parser.add_argument('--output')
args = parser.parse_args()
BASE = Path('/code/aster/target/workbuddy-prefix-affinity')
output = Path(args.output) if args.output else BASE / ('production-benchmark.json' if args.production else 'canary-benchmark.json')
assert not output.exists(), 'preserve earlier evidence'
if sys.platform == 'win32':
    source = Path(__file__).resolve().parents[2] / 'power/2026-10-21-workbuddy-compatibility/qualify.py'
    spec = importlib.util.spec_from_file_location('credential_pipe', source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    key = module.credential()
else:
    pid = int(subprocess.check_output(['systemctl', 'show', 'a3s-gateway', '-p', 'MainPID', '--value']))
    environment = dict(part.split(b'=', 1) for part in Path(f'/proc/{pid}/environ').read_bytes().split(b'\0') if b'=' in part)
    key = environment[b'A3S_GATEWAY_SHARED_TOKEN'].decode()
host = '117.162.0.179' if args.public else '127.0.0.1'
metadata = {'agent': {'name': 'synthetic-workbuddy'}, 'conversationRequestId': 'synthetic-affinity',
            'startsNewUserRequest': False, 'messageId': 'synthetic-message', 'model': 'client-label-only',
            'requestModelId': 'synthetic-id', 'requestModelName': 'client-label-only', 'stepSeq': 1,
            'traceId': 'synthetic-trace', 'argumentsDisplayText': 'CLIENT_DISPLAY_OVERRIDE',
            'rawUsage': {'totalTokens': 999999}, 'usage': {'totalTokens': 999999}}


def annotate(message):
    return dict(message, **copy.deepcopy(metadata))


def body():
    return {'model': 'prism-27b', 'stream': True, 'temperature': 0, 'max_tokens': 128,
            'stream_options': {'include_usage': True}, 'messages': [
                annotate({'role': 'system', 'content': 'Synthetic cache benchmark ' + str(uuid.uuid4()) + '. Follow the final user instruction.'}),
                annotate({'role': 'user', 'content': ' synthetic record 17: stable reference data.\n' * 5005}),
                annotate({'role': 'assistant', 'content': None, 'tool_calls': [
                    {'id': 'call_synthetic_previous', 'type': 'function',
                     'function': {'name': 'bench_sum', 'arguments': '{"a":19,"b":23}'}}]}),
                annotate({'role': 'tool', 'tool_call_id': 'call_synthetic_previous', 'content': '42'}),
                annotate({'role': 'user', 'content': 'Call bench_sum to add 19 and 23. Use the tool.'})],
            'tools': [{'type': 'function', 'function': {'name': 'bench_sum', 'description': 'Add two integers.',
                       'parameters': {'type': 'object', 'properties': {'a': {'type': 'integer'}, 'b': {'type': 'integer'}},
                                      'required': ['a', 'b']}}}]}


def exchange(port, value, label):
    transport = http.client.HTTPConnection(host, port, timeout=120)
    if sys.platform == 'win32' and args.public:
        physical = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        physical.settimeout(120)
        physical.setsockopt(socket.IPPROTO_IP, 31, struct.pack('!I', 4))
        physical.connect((host, port))
        transport.sock = physical
    start = time.monotonic()
    transport.request('POST', '/v1/chat/completions', json.dumps(value),
                      {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key,
                       'User-Agent': 'synthetic-workbuddy-affinity-qualification'})
    response = transport.getresponse()
    assert response.status == 200, response.read(2048).decode()
    record = {'case': label, 'port': port, 'request_id': response.getheader('x-request-id'),
              'first_meaningful_seconds': None, 'done': False, 'usage': None, 'metadata': {}, 'finish_reasons': []}
    calls, text, total = {}, '', 0
    while True:
        line = response.readline(65537)
        total += len(line)
        assert len(line) <= 65536 and total <= 2097152
        if not line:
            break
        assert b'CLIENT_DISPLAY_OVERRIDE' not in line and b'999999' not in line
        if not line.startswith(b'data:'):
            continue
        payload = line[5:].strip()
        if payload == b'[DONE]':
            record['done'] = True
            continue
        chunk = json.loads(payload)
        assert 'error' not in chunk
        if chunk.get('usage'):
            record['usage'] = chunk['usage']
        for field, content in chunk.items():
            if field not in ('id', 'object', 'created', 'model', 'choices', 'usage'):
                record['metadata'][field] = content
        for choice in chunk.get('choices', []):
            delta = choice.get('delta', {})
            fragment = delta.get('content') or ''
            text += fragment
            if (fragment.strip() or delta.get('tool_calls')) and record['first_meaningful_seconds'] is None:
                record['first_meaningful_seconds'] = round(time.monotonic() - start, 3)
            for part in delta.get('tool_calls', []):
                call = calls.setdefault(part['index'], {'id': '', 'type': 'function', 'function': {'name': '', 'arguments': ''}})
                call['id'] += part.get('id') or ''
                for field in ('name', 'arguments'):
                    call['function'][field] += part.get('function', {}).get(field) or ''
            if choice.get('finish_reason'):
                record['finish_reasons'].append(choice['finish_reason'])
    transport.close()
    record.update(seconds=round(time.monotonic() - start, 3), text=text, tool_calls=[calls[k] for k in sorted(calls)])
    assert record['done'] and record['usage']['prompt_tokens'] >= 55000 and record['first_meaningful_seconds'] is not None
    return record


result = {'synthetic_only': True, 'truncation': False, 'tools_retained': True, 'host': host, 'records': [], 'passed': False}
targets = [('production', 8080)] if args.public or args.production else [('control', 18091), ('affinity', 18090)]
for label, port in targets:
    value = body()
    first = exchange(port, value, label + '-tool-call')
    assert first['finish_reasons'] == ['tool_calls'] and len(first['tool_calls']) == 1
    call = first['tool_calls'][0]
    assert call['id'] and call['function']['name'] == 'bench_sum'
    assert json.loads(call['function']['arguments']) == {'a': 19, 'b': 23}
    result['records'].append(first)
    output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({k: first[k] for k in ('case', 'seconds', 'first_meaningful_seconds', 'usage')}), flush=True)
    value['messages'].extend([
        annotate({'role': 'assistant', 'content': None, 'tool_calls': [call]}),
        annotate({'role': 'tool', 'tool_call_id': call['id'], 'content': '42'}),
        annotate({'role': 'user', 'content': 'Reply with exactly 42.'})])
    second = exchange(port, value, label + '-tool-result')
    assert second['text'].strip() == '42' and second['finish_reasons'] == ['stop']
    result['records'].append(second)
    output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({k: second[k] for k in ('case', 'seconds', 'first_meaningful_seconds', 'usage')}), flush=True)
result['passed'] = True
output.write_text(json.dumps(result, indent=2) + '\n')
