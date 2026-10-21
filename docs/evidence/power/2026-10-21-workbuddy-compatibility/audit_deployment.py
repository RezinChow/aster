"""Read-only verification of all deployed instances and the exact running binary."""
import hashlib
import http.client
import json
from pathlib import Path
import subprocess
import time

EXPECTED = '7fd9ef1c0752c748790669bec2d7a51b4187887dd9d45128096b87293523cf6e'
BASE = Path('/data/power/workbuddy-compat-20261021')


def run(*args):
    return subprocess.check_output(args, text=True, timeout=15).strip()


def main():
    rollout = json.loads((BASE / 'deployment-attempt2.json').read_text())
    assert rollout['passed'] and len(rollout['instances']) == 8
    assert rollout['binary_sha256'] == EXPECTED
    assert run('git', '-C', '/code/Power', 'rev-parse', 'HEAD') == rollout['source_commit']
    assert not run('git', '-C', '/code/Power', 'status', '--porcelain')
    result = {'time_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
              'source_commit': rollout['source_commit'], 'instances': [], 'passed': False}
    for index in range(8):
        unit = f'a3s-power@{index}'
        assert run('systemctl', 'is-active', unit) == 'active'
        assert run('systemctl', 'is-enabled', unit) == 'enabled'
        pid = int(run('systemctl', 'show', unit, '--property=MainPID', '--value'))
        hasher = hashlib.sha256()
        with Path(f'/proc/{pid}/exe').open('rb') as executable:
            for chunk in iter(lambda: executable.read(1024 * 1024), b''):
                hasher.update(chunk)
        digest = hasher.hexdigest()
        assert digest == EXPECTED
        native_pid = int(run('systemctl', 'show', f'prism-27b@{index}', '--property=MainPID', '--value'))
        assert native_pid == rollout['native_pids_before'][str(index)]
        connection = http.client.HTTPConnection('127.0.0.1', 18200 + index, timeout=10)
        try:
            connection.request('GET', '/health')
            health = connection.getresponse()
            assert health.status == 200
            health.read(1024 * 1024)
            connection.request('POST', '/v1/chat/completions', json.dumps({
                'model': 'prism-27b', 'max_tokens': 8, 'messages': [{
                    'role': 'user', 'content': 'OK', 'agent': {},
                    'conversationRequestId': 'synthetic-audit', 'startsNewUserRequest': False}]}),
                {'Content-Type': 'application/json'})
            unauthorized = connection.getresponse()
            assert unauthorized.status == 401
            unauthorized.read(1024 * 1024)
        finally:
            connection.close()
        result['instances'].append({'index': index, 'pid': pid, 'binary_sha256': digest,
                                    'active': True, 'enabled': True, 'health_http': 200,
                                    'unauthenticated_http': 401, 'native_pid_unchanged': True})
    assert run('systemctl', 'is-active', 'a3s-gateway') == 'active'
    result['passed'] = True
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
