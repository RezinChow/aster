"""Bounded valid synthetic JSON uploads; added JSON whitespace is not model context."""
import importlib.util
import json
import hashlib
import socket
import struct
import http.client
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('upload_diagnostic_reader', HERE / 'body-upload-diagnostic.py')
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)


def main():
    target = HERE / 'body-upload-valid1.json'
    if target.exists():
        raise RuntimeError('existing result retained')
    key = reader.public.credential()
    proof = json.loads((reader.PRIOR / 'network-per-socket-interface-ab1.json').read_text())['physical_interface']
    result = {'scope': 'valid synthetic JSON padded with legal whitespace; finite diagnostics',
              'source_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              'credentials_exported': False, 'global_network_changes': False, 'records': []}
    for route in ('physical', 'default'):
        for padding in (0, 68000, 131072):
            body = json.dumps({'model': 'prism-27b', 'messages': [{'role': 'user', 'content': 'Reply with exactly OK.'}],
                               'temperature': 0, 'max_tokens': 16, 'stream': False}, separators=(',', ':')).encode() + b' ' * padding
            row = {'route': route, 'body_bytes': len(body)}
            started = time.monotonic()
            c = http.client.HTTPConnection(reader.public.HOST, reader.public.PORT, timeout=8)
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                c.sock = s
                s.settimeout(8)
                if route == 'physical':
                    s.setsockopt(socket.IPPROTO_IP, 31, struct.pack('!I', proof['index']))
                    assert s.getsockopt(socket.IPPROTO_IP, 31) == proof['index']
                s.connect((reader.public.HOST, reader.public.PORT))
                row['connect_ms'] = round(1000 * (time.monotonic() - started), 3)
                row['source_ip_sha256'] = hashlib.sha256(s.getsockname()[0].encode()).hexdigest()
                if route == 'physical':
                    assert row['source_ip_sha256'] == proof['source_ip_sha256']
                c.request('POST', '/v1/chat/completions', body, {'Authorization': 'Bearer ' + key,
                          'Content-Type': 'application/json', 'Connection': 'close'})
                r = c.getresponse()
                data = r.read(128 * 1024 + 1)
                assert len(data) <= 128 * 1024
                value = json.loads(data)
                row.update(status='completed', http_status=r.status, response_bytes=len(data),
                           expected_output=r.status == 200 and value.get('choices', [{}])[0].get('message', {}).get('content', '').strip() == 'OK',
                           error_code=value.get('error', {}).get('code'))
                r.close()
            except Exception as exc:
                row.update(status='failed', exception_class=type(exc).__name__, os_error=getattr(exc, 'winerror', None) or getattr(exc, 'errno', None))
            finally:
                c.close()
                row.update(elapsed_ms=round(1000 * (time.monotonic() - started), 3), owned_socket_closed=True)
            result['records'].append(row)
            print(json.dumps(row), flush=True)
    with target.open('x', encoding='utf-8') as output:
        json.dump(result, output, indent=2)
        output.write('\n')


if __name__ == '__main__':
    main()
