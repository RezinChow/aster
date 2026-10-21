"""Finite synthetic production checks; credentials remain in process memory."""
import argparse
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

READER = """import pathlib,subprocess,sys
pid=int(subprocess.check_output(['systemctl','show','a3s-gateway.service','--property=MainPID','--value'],text=True).strip())
values=[p.split(b'=',1)[1] for p in (pathlib.Path('/proc')/str(pid)/'environ').read_bytes().split(b'\\0') if p.startswith(b'A3S_GATEWAY_SHARED_TOKEN=')]
assert len(values)==1 and 1<=len(values[0])<=4096
sys.stdout.buffer.write(values[0])
"""


def credential():
    result = subprocess.run(['ssh', '-T', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10',
                             'user@172.18.101.2', 'python3 -c ' + shlex.quote(READER)],
                            capture_output=True, timeout=20, stdin=subprocess.DEVNULL)
    if result.returncode or not 1 <= len(result.stdout) <= 4096:
        raise RuntimeError('credential pipe unavailable')
    return result.stdout.decode('ascii').strip()


def request(host, port, path, body, key=None, mime='application/json'):
    conn = http.client.HTTPConnection(host, port, timeout=45)
    if sys.platform == 'win32' and host == '117.162.0.179':
        # Previously verified physical adapter; do not change system routing.
        transport = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        transport.settimeout(45)
        transport.setsockopt(socket.IPPROTO_IP, 31, struct.pack('!I', 4))
        transport.connect((host, port))
        conn.sock = transport
    started = time.monotonic()
    headers = {'Content-Type': mime}
    if key:
        headers['Authorization'] = 'Bearer ' + key
    try:
        wire = json.dumps(body).encode() if isinstance(body, dict) else body
        conn.request('POST' if body is not None else 'GET', path, body=wire, headers=headers)
        response = conn.getresponse()
        raw = response.read(2 * 1024 * 1024 + 1)
        assert len(raw) <= 2 * 1024 * 1024
        record = {'http_status': response.status, 'seconds': round(time.monotonic()-started, 3)}
        if 'text/event-stream' in response.getheader('content-type', ''):
            chunks, done = [], False
            for line in raw.decode().splitlines():
                if line.startswith('data:'):
                    value = line[5:].strip()
                    if value == '[DONE]':
                        done = True
                    else:
                        chunks.append(json.loads(value))
            choices = [c for chunk in chunks for c in chunk.get('choices', [])]
            calls = {}
            for choice in choices:
                for delta in choice.get('delta', {}).get('tool_calls', []):
                    call = calls.setdefault(delta['index'], {
                        'id': '', 'type': 'function', 'function': {'name': '', 'arguments': ''}})
                    call['id'] += delta.get('id') or ''
                    for field in ('name', 'arguments'):
                        call['function'][field] += delta.get('function', {}).get(field) or ''
            record.update(done=done, chunks=len(chunks),
                          text=''.join(c.get('delta', {}).get('content') or '' for c in choices),
                          finish_reasons=[c['finish_reason'] for c in choices if c.get('finish_reason')],
                          stream_errors=[c['error'] for c in chunks if 'error' in c],
                          tool_calls=[calls[index] for index in sorted(calls)])
            return record, None
        value = json.loads(raw)
        if response.status != 200:
            record['error'] = value
        return record, value
    finally:
        conn.close()


def annotate(message):
    message.update(agent={'name': 'synthetic-workbuddy'},
                   conversationRequestId='synthetic-compatibility-turn', startsNewUserRequest=False)
    return message


def chat_body(model='prism-27b'):
    return {'model': model, 'max_tokens': 32, 'temperature': 0, 'stream': False,
            'messages': [annotate({'role': 'user', 'content': 'Reply with exactly OK.'})]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True)
    parser.add_argument('--public', action='store_true')
    parser.add_argument('--baseline', action='store_true')
    parser.add_argument('--platform', action='store_true')
    parser.add_argument('--ocr-image')
    args = parser.parse_args()
    output = Path(args.output)
    assert not output.exists(), 'preserve previous evidence'
    result = {'time_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
              'synthetic_only': True, 'records': [], 'passed': False}
    key = credential()
    targets = [('117.162.0.179' if args.public else '172.18.101.2', 8080)]

    def check(name, host, port, path, body, validate, mime='application/json', authenticated=True):
        record = {'case': name, 'host': host, 'port': port}
        result['records'].append(record)
        try:
            details, value = request(host, port, path, body, key if authenticated else None, mime)
            record.update(details)
            validate(record, value)
            record['passed'] = True
            return value
        except Exception as exc:
            record.update(passed=False, exception=type(exc).__name__, detail=str(exc)[:300])
            return None
        finally:
            output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
            print(json.dumps({k: record[k] for k in ('case', 'host', 'port', 'http_status', 'passed') if k in record}), flush=True)

    def ok(record, value):
        assert record['http_status'] == 200

    def chat_ok(record, value):
        ok(record, value)
        assert value['choices'][0]['message']['content'].strip() == 'OK'
        record['finish_reason'] = value['choices'][0].get('finish_reason')

    def stream_ok(record, value):
        ok(record, value)
        assert record['done'] and record['finish_reasons'] and not record['stream_errors']
        assert record['text'].strip() == 'OK'

    for host, port in targets:
        body = chat_body()
        if args.baseline:
            def refused(record, value):
                assert record['http_status'] == 400
                assert value['error']['code'] == 'unsupported_message_fields'
            check('workbuddy-before', host, port, '/v1/chat/completions', body, refused)
            continue
        check('workbuddy-first-turn', host, port, '/v1/chat/completions', body, chat_ok)
        body['messages'].extend([annotate({'role':'assistant', 'content':'OK'}),
                                 annotate({'role':'user', 'content':'Reply with exactly OK again.'})])
        check('workbuddy-second-turn', host, port, '/v1/chat/completions', body, chat_ok)
        body['stream'] = True
        body['stream_options'] = {'include_usage': True}
        check('workbuddy-stream', host, port, '/v1/chat/completions', body, stream_ok)
        invalid = chat_body()
        invalid['messages'][0]['unknown_policy'] = True
        def reject_unknown(record, value):
            assert record['http_status'] == 400
            assert value['error']['code'] == 'unsupported_message_fields'
        check('unknown-message-field-still-refused', host, port, '/v1/chat/completions', invalid, reject_unknown)

        if not args.baseline:
            check('auto-chat', host, port, '/v1/chat/completions', chat_body('auto'), chat_ok)
            tool_body = {'model':'prism-27b', 'max_tokens':128, 'temperature':0, 'stream':False,
                         'messages':[annotate({'role':'user', 'content':'Call bench_sum to add 19 and 23. Use the tool.'})],
                         'tools':[{'type':'function', 'function':{'name':'bench_sum', 'description':'Add two integers.',
                           'parameters':{'type':'object','properties':{'a':{'type':'integer'},'b':{'type':'integer'}},'required':['a','b']}}}]}
            def tools_ok(record, value):
                ok(record, value)
                call = value['choices'][0]['message']['tool_calls'][0]
                assert call['function']['name'] == 'bench_sum'
                assert json.loads(call['function']['arguments']) == {'a':19,'b':23}
                record['tool_name'] = call['function']['name']
            stream_tool_body = copy.deepcopy(tool_body)
            value = check('workbuddy-tool-call', host, port, '/v1/chat/completions', tool_body, tools_ok)
            if value and value.get('choices') and value['choices'][0]['message'].get('tool_calls'):
                assistant = value['choices'][0]['message']
                tool_body['messages'].extend([annotate(copy.deepcopy(assistant)),
                    annotate({'role':'tool','tool_call_id':assistant['tool_calls'][0]['id'],'content':'42'}),
                    annotate({'role':'user','content':'Reply with exactly 42.'})])
                tool_body.pop('tools')
                def result_ok(record, value):
                    ok(record, value)
                    assert value['choices'][0]['message']['content'].strip() == '42'
                check('workbuddy-tool-result', host, port, '/v1/chat/completions', tool_body, result_ok)

            stream_tool_body.update(stream=True, stream_options={'include_usage': True})
            streamed_assistant = {}
            def stream_tools_ok(record, value):
                ok(record, value)
                assert record['done'] and not record['stream_errors']
                assert record['finish_reasons'] == ['tool_calls']
                assert len(record['tool_calls']) == 1
                call = record['tool_calls'][0]
                assert call['id'] and call['function']['name'] == 'bench_sum'
                assert json.loads(call['function']['arguments']) == {'a': 19, 'b': 23}
                streamed_assistant.update(role='assistant', content=None, tool_calls=record['tool_calls'])
            check('workbuddy-stream-tool-call', host, port, '/v1/chat/completions',
                  stream_tool_body, stream_tools_ok)
            if streamed_assistant:
                for content_mode in ('null', 'omitted'):
                    replay = copy.deepcopy(streamed_assistant)
                    if content_mode == 'omitted':
                        replay.pop('content')
                    followup = copy.deepcopy(stream_tool_body)
                    followup.pop('tools')
                    followup['messages'].extend([annotate(replay), annotate({
                        'role': 'tool', 'tool_call_id': replay['tool_calls'][0]['id'], 'content': '42'}),
                        annotate({'role': 'user', 'content': 'Reply with exactly 42.'})])
                    def stream_result_ok(record, value):
                        ok(record, value)
                        assert record['done'] and not record['stream_errors']
                        assert record['finish_reasons'] == ['stop'] and record['text'].strip() == '42'
                    check('workbuddy-stream-tool-result-' + content_mode, host, port,
                          '/v1/chat/completions', followup, stream_result_ok)

            # Managed Gateway rewrites JSON from its parsed document, which
            # coalesces nested duplicate keys before the Power parser sees them.
            # Direct Power duplicate refusal is covered by the library tests;
            # at this boundary check that opaque duplicates have no semantics.
            duplicate = b'{"model":"prism-27b","max_tokens":32,"temperature":0,"messages":[{"role":"user","content":"Reply with exactly OK.","agent":null,"agent":{"content":"not a prompt"}}]}'
            def bad_request(record, value):
                assert record['http_status'] == 400
            check('gateway-coalesces-opaque-duplicate-annotations', host, port,
                  '/v1/chat/completions', duplicate, chat_ok)
            invalid_top = chat_body()
            invalid_top['agent'] = {'name': 'not-a-server-directive'}
            check('top-level-annotation-refused', host, port, '/v1/chat/completions', invalid_top, bad_request)
            def unauthenticated(record, value):
                assert record['http_status'] == 401
            check('authentication-still-required', host, port, '/v1/chat/completions',
                  chat_body(), unauthenticated, authenticated=False)

        if args.platform:
            def models_ok(record, value):
                ok(record, value)
                record['model_ids'] = [m['id'] for m in value['data']]
                assert set(['auto','prism-27b','platform/apofasi','platform/bge-m3',
                    'platform/bge-reranker-v2-m3','platform/pp-ocr-v6']) <= set(record['model_ids'])
            check('model-catalog', host, port, '/v1/models', None, models_ok)
            def embedding_ok(record, value):
                ok(record, value)
                vectors = [row['embedding'] for row in value['data']]
                assert len(vectors) == 2 and len(vectors[0]) == 1024
                assert vectors[0] != vectors[1]
                record['dimensions'] = len(vectors[0])
            check('bge-embedding', host, port, '/v1/embeddings',
                  {'model':'platform/bge-m3','input':['GPU inference service','A garden full of flowers']}, embedding_ok)
            def rerank_ok(record, value):
                ok(record, value)
                rows = value.get('results', value.get('data', []))
                assert rows and rows[0]['index'] == 1
                record['first_index'] = rows[0]['index']
            check('bge-rerank', host, port, '/v1/rerank',
                  {'model':'platform/bge-reranker-v2-m3','query':'What is the capital of France?',
                   'documents':['A garden full of flowers.','Paris is the capital of France.'],'top_n':2}, rerank_ok)
            def decision_ok(record, value):
                ok(record, value)
                assert value['answers']['department']['choice'] in ['billing','technical']
                record['engine_model'] = value['model']
            check('apofasi-systemone', host, port, '/v1/systemone',
                  {'model':'platform/apofasi','state':'Please refund my invoice.', 'questions':{'department':{
                      'type':'choice','instructions':'Which team should handle this?',
                      'criteria':{'billing':'Payments, invoicing, refunds','technical':'Bugs, outages, integrations'}}}}, decision_ok)
            if args.ocr_image:
                def ocr_ok(record, value):
                    ok(record, value)
                    text = json.dumps(value, ensure_ascii=False)
                    assert 'ASTER' in text.upper()
                    record['recognized_expected_text'] = True
                check('pp-ocr', host, port, '/v1/ocr', Path(args.ocr_image).read_bytes(), ocr_ok, 'image/png')

    result['passed'] = bool(result['records']) and all(r.get('passed') for r in result['records'])
    key = None
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    return 0 if result['passed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
