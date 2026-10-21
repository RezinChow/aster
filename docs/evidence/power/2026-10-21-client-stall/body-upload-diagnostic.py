"""Finite synthetic uploads; credential remains in memory and output is metadata only."""
import hashlib
import http.client
import importlib.util
import json
import socket
import struct
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
PRIOR = HERE.parent / '2026-10-21-serving-optimization'
spec = importlib.util.spec_from_file_location('approved_public_reader', PRIOR / 'public-frontdoor-qualification.py')
public = importlib.util.module_from_spec(spec)
spec.loader.exec_module(public)


def run():
    target = HERE / 'body-upload-diagnostic1.json'
    if target.exists():
        raise RuntimeError('existing evidence is preserved')
    key = public.credential()
    proof = json.loads((PRIOR / 'network-per-socket-interface-ab1.json').read_text())['physical_interface']
    records = []
    result = {'scope': 'synthetic request upload only; no user session replay',
              'source_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              'credentials_exported': False, 'global_network_changes': False,
              'physical_interface_index': proof['index'], 'records': records}
    for route in ('default', 'physical'):
        for padding in (0, 68000, 131072):
            body = json.dumps({'model': 'prism-27b', 'messages': [{'role': 'user', 'content': 'Reply with exactly OK.'}],
                               'temperature': 0, 'max_tokens': 16, 'stream': False,
                               'user': 'SYNTHETIC-' + 'z' * padding}, separators=(',', ':')).encode()
            connection = http.client.HTTPConnection(public.HOST, public.PORT, timeout=8)
            row = {'route': route, 'body_bytes': len(body), 'body_sha256': hashlib.sha256(body).hexdigest()}
            started = time.monotonic()
            try:
                stream = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                connection.sock = stream
                stream.settimeout(8)
                if route == 'physical':
                    stream.setsockopt(socket.IPPROTO_IP, 31, struct.pack('!I', proof['index']))
                    assert stream.getsockopt(socket.IPPROTO_IP, 31) == proof['index']
                stream.connect((public.HOST, public.PORT))
                row['connect_ms'] = round(1000 * (time.monotonic() - started), 3)
                source = hashlib.sha256(stream.getsockname()[0].encode()).hexdigest()
                row['source_ip_sha256'] = source
                if route == 'physical':
                    assert source == proof['source_ip_sha256']
                connection.request('POST', '/v1/chat/completions', body=body,
                                   headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json',
                                            'Connection': 'close', 'X-Request-ID': 'synthetic-upload-' + route + '-' + str(padding)})
                row['send_returned_ms'] = round(1000 * (time.monotonic() - started), 3)
                response = connection.getresponse()
                row['http_status'] = response.status
                data = response.read(128 * 1024 + 1)
                assert len(data) <= 128 * 1024
                value = json.loads(data)
                row['response_bytes'] = len(data)
                row['expected_output'] = response.status == 200 and value.get('choices', [{}])[0].get('message', {}).get('content', '').strip() == 'OK'
                row['status'] = 'completed'
                response.close()
            except Exception as exc:
                row['status'] = 'failed'
                row['exception_class'] = type(exc).__name__
                row['os_error'] = getattr(exc, 'winerror', None) or getattr(exc, 'errno', None)
            finally:
                connection.close()
                row['elapsed_ms'] = round(1000 * (time.monotonic() - started), 3)
                row['owned_socket_closed'] = True
            records.append(row)
            print(json.dumps(row), flush=True)
    with target.open('x', encoding='utf-8') as output:
        json.dump(result, output, indent=2)
        output.write('\n')


if __name__ == '__main__':
    run()
