"""Diagnostic standard HTTP/1 chunked framing; public URL and model unchanged."""
import hashlib
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('normal_framing_repro', HERE / 'acp-normal-dialogue.py')
normal = importlib.util.module_from_spec(spec)
spec.loader.exec_module(normal)
original = normal.a.acl


def acl(root, base_url):
    text = original(root, base_url)
    line = '  api_key = env("A3S_GATEWAY_KEY")\n'
    if text.count(line) != 1:
        raise RuntimeError('diagnostic ACL shape differs')
    return text.replace(line, line + '  headers = { "Transfer-Encoding" = "chunked" }\n')


if __name__ == '__main__':
    normal.a.acl = acl
    normal.run('chunked-public1')
    print(json.dumps({'url': normal.public.URL, 'header': {'Transfer-Encoding': 'chunked'},
                      'source_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}))
