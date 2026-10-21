"""Diagnostic local HTTP relay: keep synthetic ACP payload bytes in memory only."""
import hashlib
import http.client
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import importlib.util
import json
import threading
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('ordinary_acp', HERE / 'acp-normal-dialogue.py')
normal = importlib.util.module_from_spec(spec)
spec.loader.exec_module(normal)
records, lock = [], threading.Lock()


class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, *args):
        pass

    def do_GET(self):
        self.forward()

    def do_POST(self):
        self.forward()

    def forward(self):
        started = time.monotonic()
        row = {'method': self.command, 'path': self.path}
        connection = http.client.HTTPConnection('117.162.0.179', 8080, timeout=12)
        response = None
        try:
            self.connection.settimeout(12)
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 <= size <= 1024 * 1024 or self.path not in ('/v1/models', '/v1/chat/completions'):
                raise RuntimeError('bounded diagnostic target required')
            body = self.rfile.read(size)
            row.update(declared_bytes=size, received_bytes=len(body), body_sha256=hashlib.sha256(body).hexdigest())
            if len(body) != size:
                raise RuntimeError('incomplete local upload')
            if body:
                value = json.loads(body)
                row.update(stream=value.get('stream'), tools_count=len(value.get('tools', [])),
                           message_count=len(value.get('messages', [])))
            connection.request(self.command, self.path, body=body if body else None,
                               headers={key: value for key, value in self.headers.items()
                                        if key.lower() in ('authorization', 'content-type', 'accept')}
                               | {'Connection': 'close'})
            response = connection.getresponse()
            row.update(http_status=response.status, response_headers_ms=1000 * (time.monotonic() - started))
            self.send_response(response.status)
            self.send_header('Content-Type', response.getheader('Content-Type', 'application/json'))
            self.send_header('Connection', 'close')
            self.end_headers()
            received, bounded_error = 0, bytearray()
            while True:
                data = response.read1(8192)
                if not data:
                    break
                received += len(data)
                if received > 4 * 1024 * 1024 or time.monotonic() - started > 35:
                    raise RuntimeError('bounded diagnostic response exceeded')
                if response.status >= 400 and len(bounded_error) + len(data) <= 65536:
                    bounded_error.extend(data)
                self.wfile.write(data)
                self.wfile.flush()
            if bounded_error:
                value = json.loads(bounded_error)
                row['error_code'] = value.get('error', {}).get('code')
            row.update(response_bytes=received, completed=True)
        except Exception as exc:
            row.update(completed=False, exception_class=type(exc).__name__)
        finally:
            self.close_connection = True
            if response is not None:
                response.close()
            connection.close()
            row['elapsed_ms'] = 1000 * (time.monotonic() - started)
            with lock:
                records.append(row)


def main():
    target = HERE / 'acp-public-relay1.json'
    if target.exists():
        raise RuntimeError('existing result retained')
    server = ThreadingHTTPServer(('127.0.0.1', 19082), Handler)
    server.daemon_threads = False
    thread = threading.Thread(target=server.serve_forever)
    thread.start()
    try:
        normal.public.URL = 'http://127.0.0.1:19082/v1'
        normal.run('public-relay1')
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)
    result = {'scope': 'same ordinary ACP synthetic request bytes buffered in loopback relay and forwarded to actual public gateway',
              'source_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), 'records': records,
              'credentials_exported': False, 'raw_body_persisted': False, 'server_thread_reaped': not thread.is_alive()}
    with target.open('x', encoding='utf-8') as output:
        json.dump(result, output, indent=2)
        output.write('\n')
    print(json.dumps(result))


if __name__ == '__main__':
    main()
