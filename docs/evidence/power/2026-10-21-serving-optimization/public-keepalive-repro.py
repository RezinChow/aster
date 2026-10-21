#!/usr/bin/env python3
"""Finite direct Windows HTTP/1.1 multi-turn check with tools and real reuse."""
import copy
import http.client
import importlib.util
import json
import os
from pathlib import Path
import socket
import threading
import time
import types
import urllib.request

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('public_keepalive_frontdoor', HERE / 'public-frontdoor-qualification.py')
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)
q, m = p.q, p.m


class Persistent(http.client.HTTPConnection):
    def __init__(self, host, port):
        super().__init__(host, port)
        self.trace = []
        self.transport = None
        self.preserve = False
        self.in_headers = False
        self.last_local_port = None

    def mark(self, phase):
        self.trace.append({'phase': phase, 'elapsed_ms': 1000 * (time.monotonic() - self.started)})

    def begin(self, timeout):
        self.started = time.monotonic()
        self.deadline = self.started + timeout
        self.trace = []
        self.preserve = False
        self.timeout = timeout
        self.observed = {'connection_reused': self.sock is not None,
                         'previous_local_port': self.last_local_port}

        def abort():
            if self.transport is not None:
                try:
                    self.transport.shutdown(socket.SHUT_RDWR)
                except OSError:
                    pass

        self.timer = threading.Timer(timeout, abort)
        self.timer.daemon = True
        self.timer.start()

    def remaining(self):
        left = self.deadline - time.monotonic()
        if left <= 0:
            raise TimeoutError()
        if self.transport is not None:
            self.transport.settimeout(left)
        return left

    def connect(self):
        self.mark('connect-start')
        if self.sock is None:
            super().connect()
        self.transport = self.sock
        self.observed['local_port'] = self.sock.getsockname()[1]
        self.observed['same_local_port'] = self.last_local_port == self.observed['local_port']
        self.last_local_port = self.observed['local_port']
        self.mark('connect-complete')
        self.remaining()

    def request(self, *args, **kwargs):
        self.mark('request-start')
        result = super().request(*args, **kwargs)
        self.mark('request-sent')
        return result

    def getresponse(self):
        self.mark('response-headers-wait')
        self.in_headers = True
        try:
            response = super().getresponse()
        finally:
            self.in_headers = False
        self.mark('response-headers-received')
        self.observed['response_status'] = response.status
        self.observed['server_will_close'] = response.will_close
        self.observed['connection_close_header'] = response.getheader('Connection', '').lower() == 'close'
        request_id = response.getheader('x-request-id')
        if request_id is not None and 1 <= len(request_id) <= 255 and all(33 <= ord(c) <= 126 for c in request_id):
            self.observed['request_id'] = request_id
        owner = self

        class Response:
            def __init__(self):
                self.status = response.status
                self.closed = False
                self.bytes = 0

            def readline(self, maximum):
                owner.remaining()
                line = response.readline(maximum)
                self.bytes += len(line)
                if line.rstrip(b'\r\n') == b'data: [DONE]':
                    owner.mark('done-frame')
                if not line:
                    owner.mark('http-body-eof')
                return line

            def read(self, maximum):
                owner.remaining()
                data = response.read(maximum)
                self.bytes += len(data)
                return data

            def close(self):
                if self.closed:
                    return
                self.closed = True
                try:
                    while True:
                        owner.remaining()
                        data = response.read(min(65536, q.MAX_RESPONSE - self.bytes + 1))
                        self.bytes += len(data)
                        if self.bytes > q.MAX_RESPONSE:
                            raise ValueError('response exceeds bound')
                        if not data:
                            owner.mark('http-body-eof')
                            break
                        if response.status == 200 and data.strip():
                            raise ValueError('nonempty output after terminal')
                    owner.observed['body_eof'] = True
                    owner.preserve = not response.will_close
                finally:
                    response.close()
                    if response.will_close and owner.transport is not None:
                        owner.transport.close()

        return Response()

    def close(self):
        if self.in_headers:
            # Keep the exact socket available to the watchdog until its
            # response reader closes the makefile, even for will-close.
            self.sock = None
            super().close()
        elif not self.preserve:
            super().close()
            if self.transport is not None:
                self.transport.close()

    def finish(self):
        self.timer.cancel()
        self.observed['phases'] = self.trace
        return self.observed

    def shutdown_client(self):
        self.preserve = False
        self.close()


def request(client, body, key, timeout, expected):
    client.begin(timeout)
    captures = []

    class Capture(q.Output):
        def __init__(self, started):
            super().__init__(started)
            captures.append(self)

        def observe(self, payload, now):
            previous_first, previous_finish = self.first, self.finished
            super().observe(payload, now)
            if previous_first is None and self.first is not None:
                client.mark('first-meaningful')
            if not previous_finish and self.finished:
                client.mark('finish-frame')

    interface = types.SimpleNamespace(**vars(http.client))
    interface.HTTPConnection = lambda *_args, **_kwargs: client
    namespace = dict(q.request_once.__globals__, Output=Capture, http=types.SimpleNamespace(client=interface))
    function = types.FunctionType(q.request_once.__code__, namespace, q.request_once.__name__,
                                  q.request_once.__defaults__, q.request_once.__closure__)
    function.__kwdefaults__ = q.request_once.__kwdefaults__
    try:
        row = function(p.URL, body, key, timeout, expected=expected)
        state = captures[0]
        answer = {'role': 'assistant', 'content': ''.join(state.text)}
        if state.tools:
            answer['tool_calls'] = [{'id': tool['id'], 'type': 'function',
                                     'function': {'name': tool['name'], 'arguments': tool['arguments']}}
                                    for _, tool in sorted(state.tools.items())]
        return row, answer
    finally:
        client.finish()


def main(tag='public-keepalive-v2', deadline=None, host=None, text_turns=5, include_tool=True):
    if tag not in ('public-keepalive-v2', 'private-keepalive-v1'):
        raise ValueError('closed diagnostic tags required')
    target = HERE / (tag + '.json')
    if target.exists():
        raise ValueError('existing evidence must not be overwritten')
    started, key = time.monotonic(), None
    deadline = started + 180 if deadline is None else deadline
    client = Persistent(p.HOST if host is None else host, p.PORT)
    names = ('HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'all_proxy', 'no_proxy')
    result = {'scope': 'Windows direct standard HTTP persistent client; all turns carry tools; synthetic history only',
              'records': [], 'qualification_status': 'starting', 'started_monotonic': started,
              'actual_target': 'http://' + client.host + ':' + str(client.port) + '/v1',
              'shared_phase_deadline_monotonic': deadline,
              'tool_identity': dict(m.TOOL_IDENTITY, keepalive_helper_sha256=m.digest(Path(__file__))),
              'proxy_observation': {'env_names_present': [name for name in names if name in os.environ],
                                    'target_no_proxy_match': urllib.request.proxy_bypass_environment(p.HOST),
                                    'this_client_uses_proxy': False, 'actual_host_sdk_proxy_effective': 'not observed'},
              'limits': {'total_seconds': 180, 'per_request_seconds': 30},
              'not_claimed': ['full Aster tool catalog or actual user prompt', 'real reqwest implementation', 'native exclusivity']}

    def run(stage, body, expected):
        remaining = min(30, deadline - time.monotonic())
        if remaining <= 0:
            raise TimeoutError()
        row, answer = request(client, body, key, remaining, expected)
        row.update(stage=stage, transport=copy.deepcopy(client.observed), history_messages=len(body['messages']),
                   request_sha256=m.hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest(), tools_present=bool(body.get('tools')))
        result['records'].append(row)
        m.write_result(target, result)
        print(json.dumps({'stage': stage, 'outcome': row['outcome'], 'status': row['http_status'],
                          'elapsed_ms': row['elapsed_ms'], 'transport': row['transport']}), flush=True)
        return row, answer

    try:
        if deadline - time.monotonic() <= 15:
            raise TimeoutError()
        key = p.credential()
        corpus = [json.loads(line) for line in (HERE / 'eight-card-corpus.jsonl').read_text().splitlines() if line.strip()]
        template = next(item['request'] for item in corpus if item['name'] == 'tool-stream')
        history = []
        for number, word in enumerate(('READY', 'AGAIN', 'THIRD', 'FOURTH', 'FIFTH')[:text_turns], 1):
            history.append({'role': 'user', 'content': 'Reply with exactly ' + word + '. Do not call a tool.'})
            body = copy.deepcopy(template)
            body['messages'] = copy.deepcopy(history)
            row, answer = run('text-turn-' + str(number), body, {'text': word, 'normalize_whitespace': True})
            if row['outcome'] != 'success':
                raise ValueError('ordinary turn failed')
            history.append(answer)
        if not include_tool:
            result['qualification_status'] = 'passed'
            return 0
        body = copy.deepcopy(template)
        row, answer = run('tool-call', body, {'tool': 'bench_sum'})
        if row['outcome'] != 'success' or not row['tool_valid'] or len(answer.get('tool_calls', [])) != 1:
            raise ValueError('tool call failed')
        body['messages'].extend([answer, {'role': 'tool', 'tool_call_id': answer['tool_calls'][0]['id'], 'content': '42'},
                                 {'role': 'user', 'content': 'Using that result, reply with exactly 42. Do not call a tool again.'}])
        row, _answer = run('tool-result-continuation', body, {'text': '42', 'normalize_whitespace': True})
        result['qualification_status'] = 'passed' if row['outcome'] == 'success' else 'failed'
    except Exception as exc:
        result.update(qualification_status='failed', failure_exception=type(exc).__name__, incomplete_transport=client.observed if hasattr(client, 'observed') else {})
    finally:
        key = None
        client.shutdown_client()
        result['elapsed_seconds'] = time.monotonic() - started
        m.write_result(target, result)
    return 0 if result['qualification_status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
