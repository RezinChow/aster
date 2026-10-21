"""Finite framing controls using only fresh synthetic ACP requests held in memory."""
import http.client
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import importlib.util
import json
from pathlib import Path
import socket
import struct
import subprocess
import threading
import time
from unittest import mock

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('retained_ordinary_driver', HERE / 'acp-normal-dialogue.py')
normal = importlib.util.module_from_spec(spec)
spec.loader.exec_module(normal)
a = normal.a
SOURCE_REPO = Path(subprocess.check_output(['git', 'rev-parse', '--git-common-dir'], text=True).strip()).resolve().parent
a.REPO = SOURCE_REPO
a.BINARY = SOURCE_REPO / 'target/debug/a3s-code-acp.exe'
captured, observations, lock = {}, [], threading.Lock()


class Capture(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, *args):
        pass

    def do_POST(self):
        self.connection.settimeout(8)
        length = int(self.headers.get('Content-Length', '0'))
        if self.path != '/v1/chat/completions' or not 0 < length <= 1024 * 1024:
            self.send_error(400)
            return
        body = self.rfile.read(length)
        if len(body) != length:
            self.send_error(400)
            return
        value = json.loads(body)
        # These exact synthetic prompts are defined by the retained driver.
        second = a.PROMPTS[1] in json.dumps(value.get('messages', []), ensure_ascii=False)
        turn = 2 if second else 1
        tools = len(value.get('tools', []))
        with lock:
            observations.append({'turn': turn, 'bytes': length, 'tools': tools,
                                 'body_sha256': a.digest(body), 'stream': value.get('stream')})
            if tools and turn not in captured:
                captured[turn] = body
        content = a.EXPECTED[turn - 1]
        if value.get('stream'):
            chunks = [
                {'id': 'synthetic-framing-capture', 'object': 'chat.completion.chunk', 'created': 0,
                 'model': 'prism-27b', 'choices': [{'index': 0, 'delta': {'role': 'assistant', 'content': content}, 'finish_reason': None}]},
                {'id': 'synthetic-framing-capture', 'object': 'chat.completion.chunk', 'created': 0,
                 'model': 'prism-27b', 'choices': [{'index': 0, 'delta': {}, 'finish_reason': 'stop'}]},
            ]
            raw = b''.join(b'data: ' + json.dumps(v).encode() + b'\n\n' for v in chunks) + b'data: [DONE]\n\n'
        else:
            raw = json.dumps({'id': 'synthetic-framing-capture', 'object': 'chat.completion', 'created': 0,
                              'model': 'prism-27b', 'choices': [{'index': 0, 'message': {'role': 'assistant', 'content': content}, 'finish_reason': 'stop'}]}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream' if value.get('stream') else 'application/json')
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Connection', 'close')
        self.end_headers()
        self.wfile.write(raw)


def acquire(key):
    server = ThreadingHTTPServer(('127.0.0.1', 0), Capture)
    server.daemon_threads = True
    thread = threading.Thread(target=server.serve_forever)
    thread.start()
    original = subprocess.Popen

    def spawn(*args, **kwargs):
        child = original(*args, **kwargs)
        if list(args[0])[0] != str(a.BINARY):
            return child
        pipe = child.stdin

        class Ordinary:
            def write(self, raw):
                value = json.loads(raw)
                if value.get('method') == 'session/new':
                    assert value['params']['_meta']['a3sHost'].pop('sourceReview') is True
                    raw = (json.dumps(value) + '\n').encode()
                return pipe.write(raw)

            def __getattr__(self, name):
                return getattr(pipe, name)

        child.stdin = Ordinary()
        return child

    try:
        sha = a.digest(a.BINARY.read_bytes())
        with mock.patch.object(subprocess, 'Popen', side_effect=spawn):
            result = a.dialogue(SOURCE_REPO / '.git/optimization-20261021/acp/framing-capture1',
                                f'http://127.0.0.1:{server.server_port}/v1', key,
                                binary=a.BINARY, expected_sha=sha, turn_seconds=40, total_seconds=100)
        summary = {name: result.get(name) for name in ('status', 'own_child_reaped', 'state_privacy', 'failure_reason')}
        summary.update(scope='local mock capture only; not public inference acceptance', binary_sha256=sha)
        if result['status'] != 'passed' or set(captured) != {1, 2}:
            raise RuntimeError('fresh two-turn tool-enabled capture did not complete')
        return summary
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)


def probe(body, turn, route, framing, proof, key):
    host = '117.162.0.179' if route == 'public-physical' else '172.18.101.2'
    row = {'route': route, 'turn': turn, 'framing': framing, 'body_bytes': len(body),
           'body_sha256': a.digest(body), 'emitted_transfer_encoding': 'chunked' if framing == 'chunked1024' else None,
           'emitted_content_length': len(body) if framing == 'fixed' else None}
    start = time.monotonic()
    c = http.client.HTTPConnection(host, 8080, timeout=8)
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    c.sock = s
    s.settimeout(8)
    s.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)

    def expire():
        try:
            s.shutdown(socket.SHUT_RDWR)
        except OSError:
            pass

    timer = threading.Timer(35, expire)
    timer.daemon = True
    timer.start()
    try:
        if route == 'public-physical':
            s.setsockopt(socket.IPPROTO_IP, 31, struct.pack('!I', proof['index']))
            assert s.getsockopt(socket.IPPROTO_IP, 31) == proof['index']
        s.connect((host, 8080))
        row['connect_ms'] = round(1000 * (time.monotonic() - start), 3)
        row['source_ip_sha256'] = a.digest(s.getsockname()[0].encode())
        if route == 'public-physical':
            assert row['source_ip_sha256'] == proof['source_ip_sha256']
        c.putrequest('POST', '/v1/chat/completions')
        c.putheader('Authorization', 'Bearer ' + key)
        c.putheader('Content-Type', 'application/json')
        c.putheader('Connection', 'close')
        if framing == 'fixed':
            c.putheader('Content-Length', str(len(body)))
            c.endheaders(body)
        else:
            c.putheader('Transfer-Encoding', 'chunked')
            c.endheaders((body[i:i + 1024] for i in range(0, len(body), 1024)), encode_chunked=True)
        row['upload_ms'] = round(1000 * (time.monotonic() - start), 3)
        r = c.getresponse()
        row.update(http_status=r.status, headers_ms=round(1000 * (time.monotonic() - start), 3))
        data = bytearray()
        while True:
            chunk = r.read1(8192)
            if not chunk:
                break
            data.extend(chunk)
            if len(data) > 1024 * 1024:
                raise RuntimeError('bounded response exhausted')
        row.update(response_bytes=len(data), sse_done=b'data: [DONE]' in data,
                   response_sha256=a.digest(data), completed=True)
        if r.status >= 400:
            row['error_code'] = json.loads(data).get('error', {}).get('code')
        r.close()
    except Exception as exc:
        row.update(completed=False, exception_class=type(exc).__name__,
                   os_error=getattr(exc, 'winerror', None) or getattr(exc, 'errno', None))
    finally:
        timer.cancel()
        c.close()
        row.update(elapsed_ms=round(1000 * (time.monotonic() - start), 3), owned_socket_closed=True)
    return row


def main():
    target = HERE / 'transport-framing1.json'
    if target.exists():
        raise RuntimeError('existing evidence retained')
    key = normal.public.credential()
    proof = json.loads((normal.PRIOR / 'network-per-socket-interface-ab1.json').read_text())['physical_interface']
    result = {'scope': 'same fresh synthetic ordinary ACP body; actual HTTP chunk frames versus Content-Length',
              'source_sha256': a.digest(Path(__file__).read_bytes()), 'raw_body_persisted': False,
              'credentials_exported': False, 'global_network_changes': False, 'records': []}
    result['capture'] = acquire(key)
    result['capture_requests'] = observations
    for turn, route, framing in ((1, 'public-physical', 'fixed'), (2, 'public-physical', 'fixed'),
                                  (2, 'public-physical', 'chunked1024'), (2, 'private', 'fixed')):
        row = probe(captured[turn], turn, route, framing, proof, key)
        result['records'].append(row)
        print(json.dumps(row), flush=True)
    raw = (json.dumps(result, indent=2) + '\n').encode()
    if any(needle in raw for needle in a.secret_variants(key)):
        raise RuntimeError('credential refused before export')
    with target.open('xb') as output:
        output.write(raw)


if __name__ == '__main__':
    main()
