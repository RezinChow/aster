#!/usr/bin/env python3
"""Finite Windows public acceptance; synthetic history, no executable tools.

Credential acquisition and the established persistent HTTP/SSE parser are reused
unchanged. Production execution is a separate operator action after deployment.
"""
import argparse
import copy
import hashlib
import http.client
import importlib.util
import json
import math
import os
from pathlib import Path
import socket
import threading
import time
import types
import uuid

HERE = Path(__file__).resolve().parent


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


k = load('final_persistent', HERE / 'public-keepalive-repro.py')
p, q, m = k.p, k.q, k.m
CORPUS = HERE / 'eight-card-corpus.jsonl'
CORPUS_SHA = '1791c2cc7f6496454c69c903f2c3a82b61240b0e46d6b9b690747a6e7b113256'
PINS = {
    Path(q.__file__): '576b2d13811482024522e790f901647ac79dc6cc4368a2622a71adef856fe546',
    Path(m.__file__): 'b1e24fd648da9b7ae31cb3d3ace44c4b9b91dc6c793a0d9de7ac114ba1b821e4',
    Path(p.__file__): 'd8920142263505cbc90015dc6fd13d6819085bd88e414c30ec76b9513636d79b',
    Path(k.__file__): '7317da6c5c65c992d4635abc9122126c38c266d461cda40bc7c2f0d2a4d30b88',
}


class Refused(RuntimeError):
    """Only fixed, content-free stage names are persisted."""


class Budget:
    def __init__(self, seconds=180, per_request=30):
        if not all(type(n) in (int, float) and math.isfinite(n) and n > 0
                   for n in (seconds, per_request)) or seconds > 180 or per_request > 30:
            raise Refused('invalid finite budget')
        self.started = time.monotonic()
        self.deadline = self.started + seconds
        self.per_request = per_request
        self.clients = []
        self.lock = threading.Lock()
        self.expired = threading.Event()
        self.timer = threading.Timer(seconds, self.abort)
        self.timer.daemon = True
        self.timer.start()

    def add(self, client):
        with self.lock:
            self.clients.append(client)

    def left(self):
        remaining = self.deadline - time.monotonic()
        if self.expired.is_set() or remaining <= 0:
            raise Refused('global deadline exhausted')
        return min(self.per_request, remaining)

    def abort(self):
        self.expired.set()
        with self.lock:
            clients = list(self.clients)
        for client in clients:
            transport = getattr(client, 'transport', None)
            if transport is not None:
                try:
                    transport.shutdown(socket.SHUT_RDWR)
                except OSError:
                    pass

    def close(self):
        self.timer.cancel()
        self.abort()
        for client in self.clients:
            if isinstance(client, k.Persistent):
                client.shutdown_client()
            else:
                client.close()


class Persistent(k.Persistent):
    def __init__(self, host, port, budget):
        super().__init__(host, port)
        self.generation = 0
        self.previous_transport = None
        budget.add(self)

    def connect(self):
        super().connect()
        if self.transport is not self.previous_transport:
            self.generation += 1
            self.previous_transport = self.transport
        self.observed.update(tcp_connection_generation=self.generation,
                             socket_fileno=self.transport.fileno())


def request_metadata(body):
    messages = body.get('messages', [])
    identifiers = [message.get('tool_call_id') for message in messages
                   if message.get('role') == 'tool']
    return {
        'request_sha256': hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest(),
        'history_messages': len(messages),
        'history_role_counts': {role: sum(message.get('role') == role for message in messages)
                                for role in ('user', 'assistant', 'tool')},
        'tools_present': bool(body.get('tools')),
        'tool_result_id_sha256': [hashlib.sha256(value.encode()).hexdigest()
                                  for value in identifiers if isinstance(value, str)],
    }


class Acceptance:
    def __init__(self, key, target, *, host=p.HOST, port=p.PORT, seconds=180,
                 per_request=30, budget=None):
        self.key, self.target, self.host, self.port = key, Path(target), host, port
        self.budget = budget or Budget(seconds, per_request)
        self.result = {
            'qualification_status': 'starting', 'scope': 'external Windows public shared-caller acceptance',
            'endpoint': 'http://' + host + ':' + str(port) + '/v1',
            'credential_handling': 'existing bounded SSH pipe; process memory only',
            'limits': {'global_seconds': seconds, 'per_request_seconds': per_request, 'max_requests': 16},
            'tool_identity': dict(m.TOOL_IDENTITY, final_acceptance_sha256=m.digest(Path(__file__)),
                                  persistent_helper_sha256=m.digest(Path(k.__file__)),
                                  credential_helper_sha256=m.digest(Path(p.__file__))),
            'corpus_sha256': CORPUS_SHA, 'records': [],
            'deployment_prerequisite': {'Power': '75afe5de8d423547fdb9b9bb302b17ca9e168d6f6fe13a18d29fbce9492bf1c1',
                                        'Gateway': 'eaf9f4ca8baf38074d1548badebbd3b42bd08ab5174e2f9136101ccbcfb6c1fd',
                                        'verification': 'operator metadata gate; public HTTP does not prove binary identity'},
            'not_claimed': ['arbitrary user grants', 'full Aster tool catalog', 'real file or system tool execution',
                            'all-GPU idle or single-worker cancellation cleanup', 'SSE deltas are tokens',
                            'causal WAN performance improvement'],
        }
        self.stage = 'starting'

    def save(self):
        m.write_result(self.target, self.result)

    def transport_record(self, observed):
        result = copy.deepcopy(observed)
        identifier = result.pop('request_id', None)
        if identifier is not None:
            try:
                canonical = str(uuid.UUID(identifier))
                valid = (len(identifier) == 36 and identifier.lower() == canonical
                         and self.key not in identifier)
            except (ValueError, TypeError, AttributeError):
                valid = False
            if valid:
                result['request_id'] = canonical
            else:
                result['request_id_redacted'] = True
        return result

    def append(self, row):
        if len(self.result['records']) >= 16:
            raise Refused('request budget exhausted')
        self.result['records'].append(row)
        self.save()

    def request_timeout(self):
        if len(self.result['records']) >= 16:
            raise Refused('request budget exhausted')
        return self.budget.left()

    def models(self, client, authenticated):
        self.stage = 'authenticated-models' if authenticated else 'negative-auth'
        started = time.monotonic()
        client.begin(self.request_timeout())
        response = None
        try:
            client.connect()
            headers = {'Accept': 'application/json'}
            if authenticated:
                headers['Authorization'] = 'Bearer ' + self.key
            client.request('GET', '/v1/models', headers=headers)
            response = client.getresponse()
            raw = response.read(q.MAX_RESPONSE + 1)
            if len(raw) > q.MAX_RESPONSE:
                raise Refused('models response bound exceeded')
            present = False
            if authenticated and response.status == 200:
                body = json.loads(raw)
                rows = body.get('data') if isinstance(body, dict) else None
                present = isinstance(rows, list) and any(isinstance(row, dict) and row.get('id') == 'prism-27b'
                                                        for row in rows)
            status = response.status
            response.close()
            response = None
            client.close()
            client.finish()
            row = {'stage': self.stage, 'http_status': status, 'body_bytes': len(raw),
                   'elapsed_ms': 1000 * (time.monotonic() - started), 'exact_alias_present': present,
                   'credentials_sent': authenticated, 'transport': self.transport_record(client.observed),
                   'request_sha256': hashlib.sha256(b'GET /v1/models').hexdigest(), 'history_messages': 0}
            self.append(row)
            if status != (200 if authenticated else 401) or authenticated and not present:
                raise Refused('model or authentication gate failed')
        finally:
            if response is not None:
                response.close()
            client.finish()

    def run(self, stage, client, body, expected):
        self.stage = stage
        row, answer = k.request(client, body, self.key, self.request_timeout(), expected)
        row.update(stage=stage, transport=self.transport_record(client.observed), **request_metadata(body))
        self.append(row)
        if row['outcome'] != 'success' or not row['transport'].get('body_eof'):
            raise Refused('response correctness or complete HTTP EOF gate failed')
        if body.get('stream') and not (row['finish_observed'] and row['terminal_observed']):
            raise Refused('SSE finish and DONE required')
        return answer

    def cancel(self, body):
        self.stage = 'public-midstream-cancel'
        observed = {}
        budget, host, port = self.budget, self.host, self.port
        started = time.monotonic()

        class Connection(http.client.HTTPConnection):
            def __init__(self, *_args, **kwargs):
                super().__init__(host, port, timeout=kwargs['timeout'])
                self.transport = None
                budget.add(self)

            def connect(self):
                super().connect()
                self.transport = self.sock
                observed.update(local_port=self.sock.getsockname()[1], socket_fileno=self.sock.fileno())

            def getresponse(self):
                response = super().getresponse()
                observed.update(headers_observed=True, server_will_close=response.will_close,
                                headers_ms=1000 * (time.monotonic() - started))
                identifier = response.getheader('x-request-id')
                if identifier is not None and 1 <= len(identifier) <= 255 and all(33 <= ord(c) <= 126 for c in identifier):
                    observed['request_id'] = identifier
                return response

        interface = types.SimpleNamespace(**vars(http.client))
        interface.HTTPConnection = Connection
        namespace = dict(q.request_once.__globals__, http=types.SimpleNamespace(client=interface))
        function = types.FunctionType(q.request_once.__code__, namespace, q.request_once.__name__,
                                      q.request_once.__defaults__, q.request_once.__closure__)
        function.__kwdefaults__ = q.request_once.__kwdefaults__
        row = function('http://' + host + ':' + str(port) + '/v1', body, self.key, self.request_timeout(),
                       cancel_after_deltas=12)
        transports = [client.transport for client in budget.clients if isinstance(client, Connection)]
        for transport in transports:
            if transport is not None and transport.fileno() != -1:
                try:
                    transport.shutdown(socket.SHUT_RDWR)
                except OSError:
                    pass
                transport.close()
        observed['owned_socket_closed_before_recovery'] = bool(transports) and all(
            transport is not None and transport.fileno() == -1 for transport in transports)
        observed['body_eof_observation'] = 'intentionally interrupted; not drained'
        row.update(stage=self.stage, transport=self.transport_record(observed), cancellation_trigger={'kind': 'meaningful-sse-deltas', 'count': 12},
                   **request_metadata(body))
        self.append(row)
        if not (row['outcome'] == 'cancelled' and row['meaningful_deltas'] == 12
                and not row['finish_observed'] and not row['terminal_observed']
                and observed['owned_socket_closed_before_recovery']):
            raise Refused('actual midstream socket cancellation gate failed')

    def suite(self, corpus):
        control = Persistent(self.host, self.port, self.budget)
        self.models(control, False)
        self.models(control, True)
        cases = {item['name']: item for item in corpus}
        if set(cases) != {'short-stream', 'decode-stream', 'decode-buffered', 'tool-stream'} or len(corpus) != 4:
            raise Refused('fixed four-case corpus required')
        corpus_client = Persistent(self.host, self.port, self.budget)
        for item in corpus:
            self.run('corpus-' + item['name'], corpus_client, item['request'], item['expect'])
        conversation = Persistent(self.host, self.port, self.budget)
        template = copy.deepcopy(cases['tool-stream']['request'])
        template['max_tokens'] = 1024
        history, turns = [], []
        for ordinal, word in enumerate(('READY', 'AGAIN', 'THIRD', 'FOURTH', 'FIFTH'), 1):
            history.append({'role': 'user', 'content': 'Reply with exactly ' + word + '. Do not call a tool.'})
            body = copy.deepcopy(template)
            body['messages'] = copy.deepcopy(history)
            answer = self.run('history-turn-' + str(ordinal), conversation, body,
                              {'text': word, 'normalize_whitespace': True})
            history.append(answer)
            turns.append(self.result['records'][-1]['transport'])
        same_socket = (len({row['local_port'] for row in turns}) == 1
                       and len({row['tcp_connection_generation'] for row in turns}) == 1
                       and all(row['connection_reused'] and row['same_local_port'] for row in turns[1:]))
        self.result['five_history_turns_same_tcp'] = same_socket
        if not same_socket:
            raise Refused('five history turns did not reuse one TCP socket')
        body = copy.deepcopy(template)
        body['messages'] = copy.deepcopy(history) + copy.deepcopy(cases['tool-stream']['request']['messages'])
        tool_answer = self.run('history-tool-call', conversation, body, {'tool': 'bench_sum'})
        calls = tool_answer.get('tool_calls', [])
        if len(calls) != 1 or tool_answer.get('content', '').strip():
            raise Refused('exact one tool call without prose required')
        for content, name in (('', 'empty-string'), (None, 'null')):
            continuation = copy.deepcopy(body)
            assistant = copy.deepcopy(tool_answer)
            assistant['content'] = content
            continuation['messages'].extend([assistant,
                {'role': 'tool', 'tool_call_id': calls[0]['id'], 'content': '42'},
                {'role': 'user', 'content': 'Using that result, reply with exactly 42. Do not call a tool again.'}])
            self.run('tool-result-' + name, conversation, continuation,
                     {'text': '42', 'normalize_whitespace': True})
            self.result['records'][-1]['assistant_tool_content_shape'] = name
        conversation_rows = [row['transport'] for row in self.result['records']
                             if row['stage'].startswith(('history-', 'tool-result-'))]
        self.result['all_eight_conversation_requests_same_tcp'] = (
            len(conversation_rows) == 8
            and len({row['local_port'] for row in conversation_rows}) == 1
            and len({row['tcp_connection_generation'] for row in conversation_rows}) == 1)
        if not self.result['all_eight_conversation_requests_same_tcp']:
            raise Refused('tool history did not retain the conversation TCP socket')
        cancel_body = copy.deepcopy(cases['decode-stream']['request'])
        cancel_body['max_tokens'] = 1024
        cancel_body['messages'] = [{'role': 'user', 'content': 'Print the integers 1 through 100000, one per line, in order. Do not include any other text.'}]
        self.cancel(cancel_body)
        recovery = Persistent(self.host, self.port, self.budget)
        self.run('public-cancel-recovery', recovery, cases['short-stream']['request'], cases['short-stream']['expect'])
        if len(self.result['records']) != 16:
            raise Refused('complete finite acceptance request count required')
        self.result['qualification_status'] = 'passed'


def execute(target, credential_loader, *, host=p.HOST, port=p.PORT, seconds=180, per_request=30):
    target = Path(target)
    # Reserve exactly one fresh evidence namespace before credential acquisition.
    with target.open('x', encoding='utf-8') as stream:
        stream.write('{}\n')
    budget, key = Budget(seconds, per_request), None
    acceptance = types.SimpleNamespace(result={'records': []}, stage='preflight')
    try:
        for path, expected in PINS.items():
            if m.digest(path) != expected:
                raise Refused('frozen instrument changed')
        raw = CORPUS.read_bytes()
        if len(raw) > 2 * 1024 * 1024 or hashlib.sha256(raw).hexdigest() != CORPUS_SHA:
            raise Refused('fixed corpus changed')
        if credential_loader is p.credential and budget.deadline - time.monotonic() < 15:
            raise Refused('insufficient credential acquisition budget')
        key = credential_loader()
        acceptance = Acceptance(key, target, host=host, port=port, seconds=seconds,
                                per_request=per_request, budget=budget)
        acceptance.suite([json.loads(line) for line in raw.decode().splitlines() if line.strip()])
        budget.left()
    except Exception as error:
        acceptance.result.update(qualification_status='failed', failure_stage=acceptance.stage,
                                 failure_exception=type(error).__name__, automatic_retry=False)
    finally:
        key = None
        if hasattr(acceptance, 'key'):
            acceptance.key = None
        budget.close()
        acceptance.result['elapsed_seconds'] = time.monotonic() - budget.started
        m.write_result(target, acceptance.result)
    return acceptance.result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--tag', required=True)
    args = parser.parse_args()
    if (os.name != 'nt' or not 1 <= len(args.tag) <= 48
            or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-_' for c in args.tag)):
        raise Refused('Windows and bounded lowercase unique tag required')
    result = execute(HERE / ('public-final-' + args.tag + '.json'), p.credential)
    print(json.dumps({'qualification_status': result['qualification_status'],
                      'requests': len(result['records']), 'file': 'public-final-' + args.tag + '.json'}))
    return 0 if result['qualification_status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
