"""Real local HTTP/1.1 proof of reuse and full body drain."""
import importlib.util
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import unittest

PATH = Path(__file__).resolve().parents[1] / 'docs/evidence/power/2026-10-21-serving-optimization/public-keepalive-repro.py'
spec = importlib.util.spec_from_file_location('public_keepalive_fixture', PATH)
k = importlib.util.module_from_spec(spec)
spec.loader.exec_module(k)


class Reuse(unittest.TestCase):
    def test_two_requests_reuse_socket_only_after_complete_chunked_http_body(self):
        received = []

        class Fixture(BaseHTTPRequestHandler):
            protocol_version = 'HTTP/1.1'

            def log_message(self, *_args):
                pass

            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                received.append((self.client_address[1], body))
                data = ('data: ' + json.dumps({'choices': [{'index': 0, 'delta': {'content': 'OK'}, 'finish_reason': None}]}) + '\n\n' +
                        'data: ' + json.dumps({'choices': [{'index': 0, 'delta': {}, 'finish_reason': 'stop'}]}) + '\n\n' +
                        'data: [DONE]\n\n').encode()
                self.send_response(200)
                self.send_header('Content-Type', 'text/event-stream')
                self.send_header('Transfer-Encoding', 'chunked')
                self.end_headers()
                self.wfile.write((hex(len(data))[2:] + '\r\n').encode() + data + b'\r\n0\r\n\r\n')
                self.wfile.flush()

        server = ThreadingHTTPServer(('127.0.0.1', 0), Fixture)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        client = k.Persistent('127.0.0.1', server.server_port)
        try:
            body = {'messages': [{'role': 'user', 'content': 'fixture'}], 'stream': True, 'tools': [{'type': 'function'}]}
            for _ in range(2):
                row, answer = k.request(client, body, 'fixture-nonsecret', 1, {'text': 'OK'})
                self.assertEqual(row['outcome'], 'success')
                self.assertEqual(answer, {'role': 'assistant', 'content': 'OK'})
                self.assertTrue(client.observed['body_eof'])
                self.assertFalse(client.observed['server_will_close'])
                self.assertTrue({'done-frame', 'finish-frame', 'http-body-eof', 'first-meaningful'}.issubset(
                    {item['phase'] for item in client.observed['phases']}))
            self.assertTrue(client.observed['connection_reused'])
            self.assertTrue(client.observed['same_local_port'])
            self.assertEqual(received[0][0], received[1][0])
            self.assertEqual(len(received), 2)
        finally:
            client.shutdown_client()
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == '__main__':
    unittest.main()
