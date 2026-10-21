"""Actual current ACP, ordinary tool schemas, isolated synthetic two-turn session."""
import argparse
import hashlib
import importlib.util
import json
import subprocess
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
PRIOR = HERE.parent / '2026-10-21-serving-optimization'
spec = importlib.util.spec_from_file_location('retained_acp_driver', PRIOR / 'aster-acp-two-turn.py')
a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(a)
spec = importlib.util.spec_from_file_location('protected_gateway_reader', PRIOR / 'public-frontdoor-qualification.py')
public = importlib.util.module_from_spec(spec)
spec.loader.exec_module(public)


def run(tag):
    target = HERE / ('acp-normal-' + tag + '.json')
    if target.exists():
        raise RuntimeError('existing evidence retained')
    key = public.credential()
    binary_sha = hashlib.sha256(a.BINARY.read_bytes()).hexdigest()
    original = subprocess.Popen
    source_review_removed = []

    def spawn(*args, **kwargs):
        child = original(*args, **kwargs)
        if list(args[0])[0] != str(a.BINARY):
            return child
        pipe = child.stdin

        class NormalSessionPipe:
            def write(self, raw):
                value = json.loads(raw)
                if value.get('method') == 'session/new':
                    host = value['params']['_meta']['a3sHost']
                    assert host.pop('sourceReview') is True
                    source_review_removed.append(True)
                    raw = (json.dumps(value) + '\n').encode()
                return pipe.write(raw)

            def __getattr__(self, name):
                return getattr(pipe, name)

        child.stdin = NormalSessionPipe()
        return child

    with mock.patch.object(subprocess, 'Popen', side_effect=spawn):
        result = a.dialogue(a.REPO / '.git/optimization-20261021/acp' / ('ordinary-' + tag),
                            public.URL, key, expected_sha=binary_sha, turn_seconds=40, total_seconds=100)
    result.update(scope='current Windows ACP ordinary tool-enabled schema; isolated synthetic two turns; host requests refused',
                  source_review_removed=source_review_removed, source_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                  global_network_changes_by_driver=False)
    data = (json.dumps(result, indent=2) + '\n').encode()
    if any(needle in data for needle in a.secret_variants(key)):
        raise RuntimeError('credential refused before evidence export')
    with target.open('xb') as output:
        output.write(data)
    print(json.dumps({'file':target.name,'status':result['status'],'turns':result['turns'],
                      'elapsed_seconds':result['elapsed_seconds'],'own_child_reaped':result['own_child_reaped'],
                      'binary_sha256':binary_sha}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--tag', choices=('default1', 'direct1', 'direct2'), required=True)
    run(parser.parse_args().tag)
