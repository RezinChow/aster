"""Loopback proof of actual history/tool wire bodies, HTTP EOF and owned cancellation."""
import copy
import importlib.util
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import socket
import tempfile
import threading
import time
import unittest
from unittest.mock import Mock

PATH = Path(__file__).resolve().parents[1] / 'docs/evidence/power/2026-10-21-serving-optimization/public-final-acceptance.py'
spec = importlib.util.spec_from_file_location('public_final_fixture', PATH)
f = importlib.util.module_from_spec(spec)
spec.loader.exec_module(f)

WORDS = ('READY', 'AGAIN', 'THIRD', 'FOURTH', 'FIFTH')


class Fixture:
    def __init__(self, fault=None):
        self.requests = []
        self.eof_times = []
        self.fault = fault
        self.cancel_disconnected = threading.Event()
        self.first_stream = True
        self.tool_ids = []
        state = self

        class Handler(BaseHTTPRequestHandler):
            protocol_version = 'HTTP/1.1'

            def handle(self):
                try:
                    super().handle()
                except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
                    pass  # Expected only when the owned client deliberately aborts.

            def log_message(self, *_args):
                pass

            def capture(self, body=None):
                state.requests.append({'method': self.command, 'path': self.path,
                                       'port': self.client_address[1], 'at': time.monotonic(),
                                       'body': copy.deepcopy(body),
                                       'authorized': self.headers.get('Authorization') == 'Bearer fixture-token'})

            def send_headers(self, status, content_type='application/json', chunked=False, length=None):
                self.send_response(status)
                self.send_header('Content-Type', content_type)
                identifier = ('fixture-token' if state.fault == 'reflect-credential'
                              else '00000000-0000-0000-0000-' + str(len(state.requests)).zfill(12))
                self.send_header('x-request-id', identifier)
                if chunked:
                    self.send_header('Transfer-Encoding', 'chunked')
                else:
                    self.send_header('Content-Length', str(length))
                self.end_headers()

            def do_GET(self):
                self.capture()
                status = 200 if state.requests[-1]['authorized'] else 401
                if state.fault == 'auth' and status == 200:
                    status = 401
                raw = json.dumps({'data': [{'id': 'prism-27b'}]}).encode()
                self.send_headers(status, length=len(raw))
                self.wfile.write(raw)
                self.wfile.flush()

            def chunk(self, raw):
                self.wfile.write((hex(len(raw))[2:] + '\r\n').encode() + raw + b'\r\n')
                self.wfile.flush()

            def stream(self, deltas, reason='stop', slow=False):
                fault = state.fault if state.first_stream else None
                state.first_stream = False
                if fault == 'headers':
                    time.sleep(.3)
                try:
                    self.send_headers(200, 'text/event-stream', chunked=True)
                    for delta in deltas:
                        raw = ('data: ' + json.dumps({'choices': [{'index': 0, 'delta': delta,
                                                                  'finish_reason': None}]}) + '\n\n').encode()
                        self.chunk(raw)
                        if slow:
                            time.sleep(.01)
                    self.chunk(('data: ' + json.dumps({'choices': [{'index': 0, 'delta': {},
                                                                   'finish_reason': reason}]}) + '\n\n').encode())
                    self.chunk(b'data: [DONE]\n\n')
                    if fault == 'eof':
                        return
                    # DONE is not HTTP body EOF. The client must await this terminator.
                    time.sleep(.008)
                    self.wfile.write(b'0\r\n\r\n')
                    self.wfile.flush()
                    state.eof_times.append({'at': time.monotonic(), 'port': self.client_address[1],
                                            'request_index': len(state.requests) - 1})
                except (OSError, ValueError):
                    if slow:
                        state.cancel_disconnected.set()

            def do_POST(self):
                raw = self.rfile.read(int(self.headers['Content-Length']))
                body = json.loads(raw)
                self.capture(body)
                if not state.requests[-1]['authorized']:
                    raise AssertionError('fixture request lost authentication')
                last = body['messages'][-1]['content']
                if '100000' in last:
                    self.stream([{'content': str(n) + '\n'} for n in range(1, 100)], slow=True)
                    return
                if any(message['role'] == 'tool' for message in body['messages']):
                    assistant, tool = body['messages'][-3:-1]
                    assert assistant['content'] in ('', None)
                    assert assistant['tool_calls'][0]['id'] == tool['tool_call_id'] == state.tool_ids[-1]
                    assert json.loads(assistant['tool_calls'][0]['function']['arguments']) == {'a': 19, 'b': 23}
                    assert tool['content'] == '42'
                    text = '42'
                elif last.startswith('Call bench_sum'):
                    identifier = 'call_loopback_' + str(len(state.tool_ids) + 1)
                    state.tool_ids.append(identifier)
                    self.stream([
                        {'tool_calls': [{'index': 0, 'id': identifier, 'type': 'function',
                                         'function': {'name': 'bench_', 'arguments': '{"a":19,'}}]},
                        {'tool_calls': [{'index': 0, 'function': {'name': 'sum', 'arguments': '"b":23}'}}]},
                    ], 'tool_calls')
                    return
                elif last.startswith('Print the integers 1 through 64'):
                    text = '\n'.join(str(n) for n in range(1, 65))
                else:
                    choices = {'Reply with exactly ' + word + '. Do not call a tool.': word for word in WORDS}
                    choices['Reply with exactly OK.'] = 'OK'
                    text = choices[last]
                if body['stream']:
                    self.stream([{'content': text}])
                else:
                    raw = json.dumps({'choices': [{'index': 0, 'message': {'role': 'assistant', 'content': text},
                                                   'finish_reason': 'stop'}]}).encode()
                    self.send_headers(200, length=len(raw))
                    self.wfile.write(raw)
                    self.wfile.flush()

        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def close(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(1)


class FinalAcceptance(unittest.TestCase):
    def execute(self, fault=None, per_request=2):
        fixture = Fixture(fault)
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.addCleanup(fixture.close)
        target = Path(temp.name) / 'result.json'
        result = f.execute(target, lambda: 'fixture-token', host='127.0.0.1',
                           port=fixture.server.server_port, seconds=10, per_request=per_request)
        self.assertNotIn('fixture-token', target.read_text())
        return fixture, result, target

    def test_actual_wire_history_tool_id_both_content_shapes_and_eof_reuse(self):
        fixture, result, target = self.execute()
        self.assertEqual(result['qualification_status'], 'passed', result)
        self.assertEqual(len(fixture.requests), 16)
        self.assertEqual(len(result['records']), 16)
        self.assertTrue(result['five_history_turns_same_tcp'])
        self.assertTrue(result['all_eight_conversation_requests_same_tcp'])
        ordinary = fixture.requests[6:11]
        self.assertEqual([len(row['body']['messages']) for row in ordinary], [1, 3, 5, 7, 9])
        self.assertEqual(len({row['port'] for row in fixture.requests[6:14]}), 1)
        for index in range(7, 14):
            previous_eof = next(row for row in fixture.eof_times if row['request_index'] == index - 1)
            self.assertEqual(previous_eof['port'], fixture.requests[index]['port'])
            self.assertLessEqual(previous_eof['at'], fixture.requests[index]['at'])
        for n, row in enumerate(ordinary):
            body = row['body']
            self.assertTrue(body['tools'])
            self.assertEqual(body['max_tokens'], 1024)
            self.assertEqual([message['content'] for message in body['messages'][1::2]], list(WORDS[:n]))
        empty = fixture.requests[12]['body']
        null = fixture.requests[13]['body']
        self.assertEqual(empty['messages'][-3]['content'], '')
        self.assertIsNone(null['messages'][-3]['content'])
        expected = copy.deepcopy(empty)
        expected['messages'][-3]['content'] = None
        self.assertEqual(expected, null)
        self.assertEqual(empty['messages'][-2]['tool_call_id'], fixture.tool_ids[-1])
        self.assertNotEqual(fixture.tool_ids[0], fixture.tool_ids[-1])
        for row in result['records'][6:14]:
            phases = {phase['phase'] for phase in row['transport']['phases']}
            self.assertTrue({'response-headers-received', 'first-meaningful', 'finish-frame',
                             'done-frame', 'http-body-eof'}.issubset(phases))
            self.assertTrue(row['transport']['body_eof'])
            self.assertTrue(row['transport']['request_id'])
        self.assertNotIn('Reply with exactly', target.read_text())
        self.assertNotIn(fixture.tool_ids[-1], target.read_text())

    def test_midstream_cancel_counts_deltas_then_recovers_on_closed_owned_socket(self):
        fixture, result, _target = self.execute()
        self.assertEqual(result['qualification_status'], 'passed')
        cancelled = result['records'][-2]
        self.assertEqual(cancelled['outcome'], 'cancelled')
        self.assertEqual(cancelled['meaningful_deltas'], 12)
        self.assertFalse(cancelled['finish_observed'])
        self.assertFalse(cancelled['terminal_observed'])
        self.assertTrue(cancelled['transport']['owned_socket_closed_before_recovery'])
        self.assertTrue(fixture.cancel_disconnected.wait(1))
        self.assertEqual(result['records'][-1]['stage'], 'public-cancel-recovery')
        self.assertEqual(result['records'][-1]['outcome'], 'success')
        self.assertNotEqual(fixture.requests[-2]['port'], fixture.requests[-1]['port'])

    def test_done_without_http_eof_fails_and_sends_no_next_request(self):
        fixture, result, _target = self.execute('eof', .12)
        self.assertEqual(result['qualification_status'], 'failed')
        self.assertEqual(result['failure_stage'], 'corpus-short-stream')
        self.assertEqual(len(fixture.requests), 3)
        self.assertLess(result['elapsed_seconds'], 1)
        self.assertFalse(result['automatic_retry'])

    def test_slow_headers_deadline_stops_without_followup(self):
        fixture, result, _target = self.execute('headers', .07)
        self.assertEqual(result['qualification_status'], 'failed')
        self.assertEqual(len(fixture.requests), 3)
        self.assertLess(result['elapsed_seconds'], 1)
        self.assertFalse(result['automatic_retry'])

    def test_auth_failure_has_no_inference_or_key_fallback(self):
        fixture, result, _target = self.execute('auth')
        self.assertEqual(result['qualification_status'], 'failed')
        self.assertEqual(result['failure_stage'], 'authenticated-models')
        self.assertEqual([row['method'] for row in fixture.requests], ['GET', 'GET'])

    def test_existing_evidence_refuses_before_credential_acquisition(self):
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / 'existing.json'
            target.write_text('previous-proof')
            credential = Mock()
            with self.assertRaises(FileExistsError):
                f.execute(target, credential)
            credential.assert_not_called()
            self.assertEqual(target.read_text(), 'previous-proof')

    def test_untrusted_response_request_id_cannot_persist_reflected_credential(self):
        _fixture, result, target = self.execute('reflect-credential')
        self.assertEqual(result['qualification_status'], 'passed')
        self.assertNotIn('fixture-token', target.read_text())
        for row in result['records']:
            self.assertNotIn('request_id', row['transport'])
            self.assertTrue(row['transport']['request_id_redacted'])

    def test_exhausted_global_budget_refuses_dispatch(self):
        budget = f.Budget(.02, .01)
        try:
            time.sleep(.04)
            with self.assertRaises(f.Refused):
                budget.left()
            self.assertEqual(budget.clients, [])
        finally:
            budget.close()


if __name__ == '__main__':
    unittest.main()
