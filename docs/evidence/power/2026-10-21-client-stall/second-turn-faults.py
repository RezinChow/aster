"""Actual ACP, local synthetic first turn, bounded second-turn transport faults."""
import importlib.util
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import socket
import struct
import subprocess
import threading
import time
from unittest import mock

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('ordinary_second_turn', HERE / 'acp-normal-dialogue.py')
normal = importlib.util.module_from_spec(spec)
spec.loader.exec_module(normal)
a = normal.a
ROOT = Path(subprocess.check_output(['git', 'rev-parse', '--git-common-dir'], text=True).strip()).resolve().parent
a.REPO = ROOT
a.BINARY = ROOT / 'target/debug/a3s-code-acp.exe'
KEY = 'synthetic-local-fixture-no-authority'


def run(mode):
    rows = []
    start = time.monotonic()

    class Handler(BaseHTTPRequestHandler):
        protocol_version = 'HTTP/1.1'

        def log_message(self, *args):
            pass

        def do_POST(self):
            length = int(self.headers.get('Content-Length', '0'))
            if self.path != '/v1/chat/completions' or not 0 < length <= 1024 * 1024:
                self.send_error(400)
                return
            body = self.rfile.read(length)
            value = json.loads(body)
            second = a.PROMPTS[1] in json.dumps(value.get('messages', []), ensure_ascii=False)
            rows.append({'elapsed_ms': round(1000 * (time.monotonic() - start), 3),
                         'turn': 2 if second else 1, 'bytes': len(body),
                         'tools': len(value.get('tools', [])), 'stream': value.get('stream')})
            if len(rows) > 32:
                self.send_error(429)
                return
            if second and mode == 'reset':
                self.connection.setsockopt(socket.SOL_SOCKET, socket.SO_LINGER, struct.pack('HH', 1, 0))
                self.close_connection = True
                self.connection.close()
                return
            content = a.EXPECTED[1 if second else 0]
            chunks = [
                {'id': 'synthetic-second-turn', 'object': 'chat.completion.chunk', 'created': 0,
                 'model': 'prism-27b', 'choices': [{'index': 0, 'delta': {'role': 'assistant', 'content': content}, 'finish_reason': None}]},
                {'id': 'synthetic-second-turn', 'object': 'chat.completion.chunk', 'created': 0,
                 'model': 'prism-27b', 'choices': [{'index': 0, 'delta': {}, 'finish_reason': 'stop'}]},
            ]
            if second and mode == 'premature-eof':
                raw = b': synthetic incomplete stream\n\n'
            elif value.get('stream'):
                raw = b''.join(b'data: ' + json.dumps(v).encode() + b'\n\n' for v in chunks) + b'data: [DONE]\n\n'
            else:
                raw = json.dumps({'id': 'synthetic-second-turn', 'object': 'chat.completion', 'created': 0,
                                  'model': 'prism-27b', 'choices': [{'index': 0, 'message': {'role': 'assistant', 'content': content}, 'finish_reason': 'stop'}]}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream' if value.get('stream') else 'application/json')
            self.send_header('Content-Length', str(len(raw)))
            self.send_header('Connection', 'close')
            self.end_headers()
            self.wfile.write(raw)

    class Server(ThreadingHTTPServer):
        daemon_threads = True

        def handle_error(self, request, client_address):
            pass

    server = Server(('127.0.0.1', 0), Handler)
    thread = threading.Thread(target=server.serve_forever)
    thread.start()
    original_dialogue = a.dialogue

    def current_binary(*args, **kwargs):
        return original_dialogue(*args, **kwargs, binary=a.BINARY)

    try:
        with mock.patch.object(normal.public, 'credential', return_value=KEY), \
             mock.patch.object(normal.public, 'URL', f'http://127.0.0.1:{server.server_port}/v1'), \
             mock.patch.object(a, 'dialogue', side_effect=current_binary):
            normal.run('second-fault-' + mode + '1')
        detail = json.loads((HERE / ('acp-normal-second-fault-' + mode + '1.json')).read_text())
        return {'mode': mode, 'scope': 'loopback mock only; no production model requests',
                'status': detail['status'], 'turns': detail['turns'],
                'failure_reason': detail.get('failure_reason'), 'elapsed_seconds': detail['elapsed_seconds'],
                'own_child_reaped': detail['own_child_reaped'], 'binary_sha256': detail['binary_sha256'],
                'resolved_credential_found': detail.get('state_privacy', {}).get('resolved_credential_found'),
                'requests': rows}
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)


def main():
    target = HERE / 'second-turn-faults1.json'
    if target.exists():
        raise RuntimeError('existing evidence retained')
    rows = []
    for mode in ('healthy', 'reset', 'premature-eof'):
        row = run(mode)
        rows.append(row)
        print(json.dumps(row), flush=True)
    result = {'scope': 'bounded actual ACP second-turn fault injection; no real API credential or production requests',
              'source_sha256': a.digest(Path(__file__).read_bytes()), 'records': rows}
    with target.open('x', encoding='utf-8') as output:
        json.dump(result, output, indent=2)
        output.write('\n')


if __name__ == '__main__':
    main()
