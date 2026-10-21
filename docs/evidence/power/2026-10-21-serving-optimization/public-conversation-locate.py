#!/usr/bin/env python3
"""At most two follow-up requests inside the first reproduction's total budget."""
import copy
import http.client
import importlib.util
import json
from pathlib import Path
import time
import types

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('conversation_repro', HERE / 'public-conversation-repro.py')
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)


def request(body, key, timeout, expected):
    phases, captures = [], []
    started = time.monotonic()

    def mark(phase):
        phases.append({'phase': phase, 'elapsed_ms': 1000 * (time.monotonic() - started)})

    class TracedConnection(http.client.HTTPConnection):
        def connect(self):
            mark('connect-start')
            try:
                super().connect()
            except Exception:
                mark('connect-error')
                raise
            mark('connect-complete')

        def request(self, *args, **kwargs):
            mark('request-start')
            value = super().request(*args, **kwargs)
            mark('request-sent')
            return value

        def getresponse(self):
            mark('response-headers-wait')
            value = super().getresponse()
            mark('response-headers-received')
            return value

    class Capture(c.q.Output):
        def __init__(self, started):
            super().__init__(started)
            captures.append(self)

    client = types.SimpleNamespace(**vars(http.client))
    client.HTTPConnection = TracedConnection
    namespace = dict(c.q.request_once.__globals__, Output=Capture, http=types.SimpleNamespace(client=client))
    function = types.FunctionType(c.q.request_once.__code__, namespace, c.q.request_once.__name__,
                                  c.q.request_once.__defaults__, c.q.request_once.__closure__)
    function.__kwdefaults__ = c.q.request_once.__kwdefaults__
    row = function(c.p.URL, body, key, timeout, expected=expected)
    row['connection_phases'] = phases
    state = captures[0]
    answer = {'role': 'assistant', 'content': ''.join(state.text) or None}
    if state.tools:
        answer['tool_calls'] = [{'id': value['id'], 'type': 'function', 'function': {'name': value['name'], 'arguments': value['arguments']}}
                                for _, value in sorted(state.tools.items())]
    return row, answer


def main():
    target = HERE / 'public-conversation-locate-v1.json'
    if target.exists():
        raise ValueError('existing evidence must not be overwritten')
    prior = json.loads((HERE / 'public-conversation-v1.json').read_text())
    deadline = prior['started_monotonic'] + 180
    result = {'scope': 'bounded targeted follow-up; same first reproduction total180s budget', 'records': [],
              'tool_identity': dict(c.m.TOOL_IDENTITY, locate_sha256=c.m.digest(Path(__file__))),
              'qualification_status': 'starting'}
    key = None
    try:
        if deadline - time.monotonic() <= 15:
            raise TimeoutError()
        key = c.p.credential()
        corpus = [json.loads(line) for line in (HERE / 'eight-card-corpus.jsonl').read_text().splitlines() if line.strip()]
        body = copy.deepcopy(next(item['request'] for item in corpus if item['name'] == 'tool-stream'))
        for stage, expected in [('tool-call', {'tool': 'bench_sum'}), ('tool-result-continuation', {'text': '42', 'normalize_whitespace': True})]:
            remaining = min(30, deadline - time.monotonic())
            if remaining <= 0:
                raise TimeoutError()
            row, answer = request(body, key, remaining, expected)
            row.update(stage=stage, history_messages=len(body['messages']))
            result['records'].append(row)
            c.m.write_result(target, result)
            print(json.dumps({'stage': stage, 'outcome': row['outcome'], 'elapsed_ms': row['elapsed_ms'], 'phases': row['connection_phases']}), flush=True)
            if row['outcome'] != 'success':
                break
            if stage == 'tool-call':
                if not row['tool_valid'] or len(answer.get('tool_calls', [])) != 1:
                    raise ValueError('tool shape unavailable')
                body['messages'].extend([answer, {'role': 'tool', 'tool_call_id': answer['tool_calls'][0]['id'], 'content': '42'},
                                         {'role': 'user', 'content': 'Using that tool result, reply with exactly 42. Do not call any tool again.'}])
        result['qualification_status'] = 'passed' if len(result['records']) == 2 and all(row['outcome'] == 'success' for row in result['records']) else 'failed'
    except Exception as exc:
        result.update(qualification_status='failed', failure_exception=type(exc).__name__)
    finally:
        key = None
        result['elapsed_from_initial_start_seconds'] = time.monotonic() - prior['started_monotonic']
        c.m.write_result(target, result)
    return 0 if result['qualification_status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
