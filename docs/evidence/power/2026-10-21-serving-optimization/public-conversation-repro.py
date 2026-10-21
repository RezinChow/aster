#!/usr/bin/env python3
"""Bounded synthetic multi-turn and tool-result checks of the public frontdoor."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import time
import types

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('public_conversation_frontdoor', HERE / 'public-frontdoor-qualification.py')
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)
q, m = p.q, p.m


def capturing_request(url, body, key, timeout, expected):
    """Reuse the pinned parser while retaining only synthetic history in memory."""
    captures = []

    class CapturedOutput(q.Output):
        def __init__(self, started):
            super().__init__(started)
            captures.append(self)

    namespace = dict(q.request_once.__globals__, Output=CapturedOutput)
    request = types.FunctionType(q.request_once.__code__, namespace, q.request_once.__name__,
                                 q.request_once.__defaults__, q.request_once.__closure__)
    request.__kwdefaults__ = q.request_once.__kwdefaults__
    record = request(url, body, key, timeout, expected=expected)
    state = captures[0]
    message = {'role': 'assistant', 'content': ''.join(state.text)}
    if state.tools:
        message['tool_calls'] = [{'id': tool['id'], 'type': 'function',
                                  'function': {'name': tool['name'], 'arguments': tool['arguments']}}
                                 for _, tool in sorted(state.tools.items())]
        if not message['content']:
            message['content'] = None
    return record, message


def main():
    target = HERE / 'public-conversation-v1.json'
    if target.exists():
        raise ValueError('existing evidence must not be replaced')
    started = time.monotonic()
    deadline = started + 180
    result = {'schema_version': 1, 'scope': 'synthetic sequential requests through actual public Gateway; no user history',
              'url': p.URL, 'started_monotonic': started, 'records': [], 'qualification_status': 'starting',
              'tool_identity': dict(m.TOOL_IDENTITY, public_helper_sha256=m.digest(Path(p.__file__)),
                                    conversation_helper_sha256=m.digest(Path(__file__))),
              'limits': {'total_seconds': 180, 'per_request_seconds': 30},
              'credential_handling': 'existing public helper credential() SSH pipe; memory only',
              'not_claimed': ['native exclusivity', 'all ordinary user credential types', 'a reproduction of unobserved user history']}
    key = None
    stage = 'credential'

    def run(stage_name, history, expected, template=None):
        nonlocal stage
        stage = stage_name
        remaining = min(30, deadline - time.monotonic())
        if remaining <= 0:
            raise TimeoutError()
        body = copy.deepcopy(template) if template is not None else {
            'model': 'prism-27b', 'temperature': 0, 'seed': 42, 'max_tokens': 128,
            'stream': True, 'stream_options': {'include_usage': True}}
        body['messages'] = copy.deepcopy(history)
        record, answer = capturing_request(p.URL, body, key, remaining, expected)
        record.update(stage=stage_name, request_sha256=hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest(),
                      history_messages=len(history), history_bytes=len(json.dumps(history).encode()),
                      response_tool_ids_sha256=hashlib.sha256(json.dumps([item['id'] for item in answer.get('tool_calls', [])]).encode()).hexdigest())
        result['records'].append(record)
        m.write_result(target, result)
        print(json.dumps({'stage': stage_name, 'outcome': record['outcome'], 'status': record['http_status'],
                          'elapsed_ms': record['elapsed_ms'], 'meaningful_deltas': record['meaningful_deltas']}), flush=True)
        return record, answer

    try:
        key = p.credential()
        history = [{'role': 'system', 'content': 'Follow the requested exact short answer. Do not add commentary.'}]
        turns = [('Remember the first code CEDAR731. Reply with exactly READY.', 'READY'),
                 ('What was the first code? Reply with only that code.', 'CEDAR731'),
                 ('Remember the second code MAPLE419. Reply with exactly NOTED.', 'NOTED'),
                 ('What was the first code? Reply with only that code.', 'CEDAR731'),
                 ('What was the second code? Reply with only that code.', 'MAPLE419')]
        for number, (prompt, expected) in enumerate(turns, 1):
            history.append({'role': 'user', 'content': prompt})
            record, answer = run('text-turn-' + str(number), history, {'text': expected, 'normalize_whitespace': True})
            if record['outcome'] != 'success':
                result['text_failed_stage'] = stage
                break
            history.append(answer)
        corpus = [json.loads(line) for line in (HERE / 'eight-card-corpus.jsonl').read_text().splitlines() if line.strip()]
        tool_template = next(row['request'] for row in corpus if row['name'] == 'tool-stream')
        tool_history = copy.deepcopy(tool_template['messages'])
        record, answer = run('tool-call', tool_history, {'tool': 'bench_sum'}, tool_template)
        if record['outcome'] == 'success' and record['tool_valid'] and len(answer.get('tool_calls', [])) == 1:
            tool_history.append(answer)
            tool_history.append({'role': 'tool', 'tool_call_id': answer['tool_calls'][0]['id'], 'content': '42'})
            tool_history.append({'role': 'user', 'content': 'Using that tool result, reply with exactly 42. Do not call any tool again.'})
            record, answer = run('tool-result-continuation', tool_history, {'text': '42', 'normalize_whitespace': True}, tool_template)
            if record['outcome'] == 'success':
                tool_history.append(answer)
                tool_history.append({'role': 'user', 'content': 'Repeat the computed sum. Reply with exactly 42.'})
                run('tool-followup', tool_history, {'text': '42', 'normalize_whitespace': True}, tool_template)
        else:
            result['tool_continuation_blocked_by'] = stage
        result['qualification_status'] = 'passed' if len(result['records']) == 8 and all(row['outcome'] == 'success' for row in result['records']) else 'failed'
    except Exception as exc:
        result.update(qualification_status='failed', failure_stage=stage, failure_exception=type(exc).__name__)
    finally:
        key = None
        result['elapsed_seconds'] = time.monotonic() - started
        result['counts'] = {outcome: sum(row['outcome'] == outcome for row in result['records'])
                            for outcome in ('success', 'refused', 'http_error', 'error', 'timeout', 'invalid_stream', 'invalid_output')}
        m.write_result(target, result)
    print(json.dumps({'file': target.name, 'status': result['qualification_status'], 'counts': result['counts'],
                      'elapsed_seconds': result['elapsed_seconds']}), flush=True)
    return 0 if result['qualification_status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
