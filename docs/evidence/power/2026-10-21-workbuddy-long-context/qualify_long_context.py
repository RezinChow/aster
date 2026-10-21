"""Synthetic long tool-history streaming checks, with bounded payloads and no saved secrets."""
import argparse
import concurrent.futures
import copy
import http.client
import json
from pathlib import Path
import shlex
import socket
import struct
import subprocess
import sys
import time

FILLER = ' synthetic record 17: stable reference data.\n'
READER = """import pathlib,subprocess,sys
pid=int(subprocess.check_output(['systemctl','show','a3s-gateway','--property=MainPID','--value'],text=True))
values=[p.split(b'=',1)[1] for p in pathlib.Path(f'/proc/{pid}/environ').read_bytes().split(b'\\0') if p.startswith(b'A3S_GATEWAY_SHARED_TOKEN=')]
assert len(values)==1 and 1<=len(values[0])<=4096
sys.stdout.buffer.write(values[0])
"""


def credential():
    if sys.platform == 'win32':
        value = subprocess.check_output(['ssh', '-T', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10',
                                         'user@172.18.101.2', 'python3 -c ' + shlex.quote(READER)], timeout=20)
    else:
        value = subprocess.check_output([sys.executable, '-c', READER], timeout=15)
    assert 1 <= len(value) <= 4096
    return value.decode().strip()


def annotate(message):
    message.update(agent={'name': 'synthetic-workbuddy'},
                   conversationRequestId='synthetic-long-context', startsNewUserRequest=False)
    return message


def body(repetitions, answer, annotations=False, call_tool=False):
    messages = [
        {'role': 'system', 'content': 'Synthetic protocol test. Follow the final user instruction.'},
        {'role': 'user', 'content': 'Reference data follows.\n' + FILLER * repetitions},
        {'role': 'assistant', 'content': None, 'tool_calls': [{'id': 'call_synthetic_sum',
          'type': 'function', 'function': {'name': 'bench_sum', 'arguments': '{"a":19,"b":23}'}}]},
        {'role': 'tool', 'tool_call_id': 'call_synthetic_sum', 'content': '42'},
        {'role': 'user', 'content': ('Call bench_sum to add 19 and 23. Use the tool.' if call_tool
                                    else 'Reply with exactly ' + answer + '.')}]
    if annotations:
        for message in messages:
            annotate(message)
    return {'model': 'prism-27b', 'messages': messages, 'max_tokens': 128 if call_tool else 32, 'temperature': 0,
            'stream': True, 'stream_options': {'include_usage': True}, 'tools': [{
                'type': 'function', 'function': {'name': 'bench_sum', 'description': 'Add two integers.',
                'parameters': {'type': 'object', 'properties': {'a': {'type': 'integer'},
                    'b': {'type': 'integer'}}, 'required': ['a', 'b']}}}]}


def connection(host, port, timeout=180):
    transport = http.client.HTTPConnection(host, port, timeout=timeout)
    if sys.platform == 'win32' and host == '117.162.0.179':
        physical = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        physical.settimeout(timeout)
        physical.setsockopt(socket.IPPROTO_IP, 31, struct.pack('!I', 4))
        physical.connect((host, port))
        transport.sock = physical
    return transport


def post_json(port, path, value):
    transport = connection('127.0.0.1', port)
    try:
        transport.request('POST', path, json.dumps(value), {'Content-Type': 'application/json'})
        response = transport.getresponse()
        raw = response.read(4 * 1024 * 1024 + 1)
        assert response.status == 200 and len(raw) <= 4 * 1024 * 1024
        return json.loads(raw)
    finally:
        transport.close()


def token_count(index, repetitions, call_tool=False):
    value = body(repetitions, 'READY', call_tool=call_tool)
    template = post_json(18100 + index, '/apply-template', value)
    tokens = post_json(18100 + index, '/tokenize', {'content': template['prompt'], 'add_special': False})
    return len(tokens['tokens'])


def request(host, port, value, key):
    transport = connection(host, port)
    started = time.monotonic()
    record = {'host': host, 'port': port, 'wire_bytes': len(json.dumps(value).encode())}
    try:
        headers = {'Content-Type': 'application/json'}
        if key:
            headers['Authorization'] = 'Bearer ' + key
        transport.request('POST', '/v1/chat/completions', json.dumps(value), headers)
        response = transport.getresponse()
        raw = response.read(2 * 1024 * 1024 + 1)
        assert len(raw) <= 2 * 1024 * 1024
        record.update(http_status=response.status, seconds=round(time.monotonic() - started, 3))
        if 'text/event-stream' not in response.getheader('content-type', ''):
            record['error_response'] = json.loads(raw)
            return record
        chunks, done = [], False
        for line in raw.decode().splitlines():
            if line.startswith('data:'):
                payload = line[5:].strip()
                if payload == '[DONE]':
                    done = True
                else:
                    chunks.append(json.loads(payload))
        choices = [choice for chunk in chunks for choice in chunk.get('choices', [])]
        calls = {}
        for choice in choices:
            for delta in choice.get('delta', {}).get('tool_calls', []):
                call = calls.setdefault(delta['index'], {'id': '', 'type': 'function',
                                                        'function': {'name': '', 'arguments': ''}})
                call['id'] += delta.get('id') or ''
                for field in ('name', 'arguments'):
                    call['function'][field] += delta.get('function', {}).get(field) or ''
        record.update(done=done, chunks=len(chunks),
                      text=''.join(c.get('delta', {}).get('content') or '' for c in choices),
                      finish_reasons=[c['finish_reason'] for c in choices if c.get('finish_reason')],
                      errors=[c['error'] for c in chunks if 'error' in c],
                      usage=[c['usage'] for c in chunks if c.get('usage')],
                      tool_calls=[calls[index] for index in sorted(calls)])
        return record
    except Exception as error:
        record.update(exception=type(error).__name__, detail=str(error)[:250])
        return record
    finally:
        transport.close()


def processing(index):
    transport = connection('127.0.0.1', 18100 + index, timeout=5)
    try:
        transport.request('GET', '/metrics')
        response = transport.getresponse()
        for line in response.read(1024 * 1024).decode().splitlines():
            if line.startswith('llamacpp:requests_processing '):
                return int(float(line.split()[1]))
        raise RuntimeError('processing metric missing')
    finally:
        transport.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True)
    parser.add_argument('--index', type=int, default=7)
    parser.add_argument('--tokens', type=int, default=55000)
    parser.add_argument('--repeat', type=int)
    parser.add_argument('--parallel', type=int, default=1)
    parser.add_argument('--gateway', action='store_true')
    parser.add_argument('--public', action='store_true')
    parser.add_argument('--expect-overflow', action='store_true')
    parser.add_argument('--exercise-tools', action='store_true')
    args = parser.parse_args()
    output = Path(args.output)
    assert not output.exists() and 0 <= args.index < 8 and args.parallel in (1, 2)
    assert not args.exercise_tools or args.parallel == 1
    repetitions = args.repeat
    if repetitions is None:
        reference = token_count(args.index, 1000, args.exercise_tools) - token_count(args.index, 0, args.exercise_tools)
        repetitions = int((args.tokens + 64) * 1000 / reference)
    assert 1 <= repetitions <= 40000
    measured = None if sys.platform == 'win32' else token_count(args.index, repetitions, args.exercise_tools)
    if measured is not None:
        assert args.tokens <= measured <= args.tokens + 1024
    key = credential() if args.gateway or args.public else None
    host = '117.162.0.179' if args.public else ('172.18.101.2' if args.gateway else '127.0.0.1')
    port = 8080 if args.gateway or args.public else 18100 + args.index
    result = {'time_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
              'synthetic_only': True, 'target_prompt_tokens': args.tokens,
              'measured_template_tokens': measured, 'filler_repetitions': repetitions,
              'parallel': args.parallel, 'peak_native_processing': 0, 'records': [], 'passed': False}
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.parallel) as executor:
        bodies = [body(repetitions, ['READY', 'ALPHA', 'BETA'][0 if args.parallel == 1 else i + 1],
                       bool(key), args.exercise_tools) for i in range(args.parallel)]
        futures = [executor.submit(request, host, port, value, key) for value in bodies]
        while not all(f.done() for f in futures):
            if args.parallel == 2 and not key:
                result['peak_native_processing'] = max(result['peak_native_processing'], processing(args.index))
            time.sleep(0.5)
        for index, future in enumerate(futures):
            record = future.result()
            expected = 'READY' if args.parallel == 1 else ['ALPHA', 'BETA'][index]
            if args.expect_overflow:
                error = record.get('error_response', {}).get('error', {})
                record['passed'] = (record.get('http_status') == 400 and
                                    error.get('type') == 'exceed_context_size_error' and
                                    error.get('n_prompt_tokens', 0) > error.get('n_ctx', 0) > 0)
            elif args.exercise_tools:
                calls = record.get('tool_calls', [])
                record['case'] = 'long-stream-tool-call'
                record['passed'] = (record.get('http_status') == 200 and record.get('done') and
                                    not record.get('errors') and record.get('finish_reasons') == ['tool_calls'] and
                                    len(calls) == 1 and bool(calls[0]['id']) and
                                    calls[0]['function']['name'] == 'bench_sum' and
                                    json.loads(calls[0]['function']['arguments']) == {'a': 19, 'b': 23} and
                                    any(u.get('prompt_tokens', 0) >= args.tokens for u in record.get('usage', [])))
            else:
                record['passed'] = (record.get('http_status') == 200 and record.get('done') and
                                    not record.get('errors') and record.get('text', '').strip() == expected and
                                    record.get('finish_reasons') == ['stop'] and
                                    any(u.get('prompt_tokens', 0) >= args.tokens for u in record.get('usage', [])))
            result['records'].append(record)
    if args.exercise_tools and result['records'][0]['passed']:
        followup = copy.deepcopy(bodies[0])
        calls = result['records'][0]['tool_calls']
        replay = [{'role': 'assistant', 'content': None, 'tool_calls': calls},
                  {'role': 'tool', 'tool_call_id': calls[0]['id'], 'content': '42'},
                  {'role': 'user', 'content': 'Reply with exactly 42.'}]
        followup['messages'].extend([annotate(m) if key else m for m in replay])
        followup.pop('tools')
        followup['max_tokens'] = 32
        record = request(host, port, followup, key)
        record['case'] = 'long-stream-tool-result'
        record['passed'] = (record.get('http_status') == 200 and record.get('done') and
                            not record.get('errors') and record.get('text', '').strip() == '42' and
                            record.get('finish_reasons') == ['stop'] and
                            any(u.get('prompt_tokens', 0) >= args.tokens for u in record.get('usage', [])))
        result['records'].append(record)
    result['passed'] = all(r['passed'] for r in result['records'])
    if args.parallel == 2 and not key:
        result['passed'] = result['passed'] and result['peak_native_processing'] == 2
    key = None
    output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2), flush=True)
    return 0 if result['passed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
