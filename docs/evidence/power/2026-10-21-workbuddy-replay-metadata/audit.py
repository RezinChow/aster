"""Verify the exact replay-metadata build on all eight instances and retain native context bounds."""
import hashlib
import http.client
import json
from pathlib import Path
import subprocess
import time

BASE = Path('/data/power/workbuddy-replay-metadata-20261021')
POWER_DIGEST = 'b4301eb85bb49780b7b56f6dc36249b8675a2bdf023dbe1912492ebe12891ca2'
PATCH_DIGEST = 'd1ad8dedc6fd859f7b7a883a7aedad137fed287b6d028d2e91f1232c4ce5bd6b'
NATIVE_DIGEST = '661b413b780759bfa2c9b8fd87608c15fcc3651142d771b1c94d11d01195d298'


def run(*args):
    return subprocess.check_output(args, text=True, timeout=20).strip()


def digest(path):
    value = hashlib.sha256()
    with Path(path).open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def main():
    deployment = json.loads((BASE / 'deployment.json').read_text())
    assert deployment['passed'] and len(deployment['instances']) == 8
    assert digest(BASE / 'source.patch') == PATCH_DIGEST
    assert hashlib.sha256(subprocess.check_output(['git', '-C', '/code/Power', 'diff', '--binary'])).hexdigest() == PATCH_DIGEST
    result = {'time_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
              'power_sha256': POWER_DIGEST, 'source_patch_sha256': PATCH_DIGEST,
              'native_sha256': NATIVE_DIGEST, 'instances': [], 'passed': False}
    for index in range(8):
        power, native = f'a3s-power@{index}', f'prism-27b@{index}'
        for unit in (power, native):
            assert run('systemctl', 'is-active', unit) == 'active'
            assert run('systemctl', 'is-enabled', unit) == 'enabled'
        power_pid = int(run('systemctl', 'show', power, '--property=MainPID', '--value'))
        native_pid = int(run('systemctl', 'show', native, '--property=MainPID', '--value'))
        assert digest(f'/proc/{power_pid}/exe') == POWER_DIGEST
        assert digest(f'/proc/{native_pid}/exe') == NATIVE_DIGEST
        assert native_pid == deployment['native_pids_before'][str(index)]
        assert f'/opt/a3s/releases/{POWER_DIGEST}/a3s-power' in run('systemctl', 'show', power, '--property=ExecStart', '--value')
        connection = http.client.HTTPConnection('127.0.0.1', 18100 + index, timeout=10)
        try:
            connection.request('GET', '/props')
            response = connection.getresponse()
            props = json.loads(response.read(1024 * 1024))
            assert response.status == 200 and props['default_generation_settings']['n_ctx'] == 131072
            assert props['total_slots'] == 2
        finally:
            connection.close()
        result['instances'].append({'index': index, 'power_pid': power_pid, 'native_pid': native_pid,
                                    'power_digest_matches': True, 'native_digest_matches': True,
                                    'native_pid_unchanged': True, 'context_per_slot': 131072,
                                    'native_slots': 2, 'active_enabled': True})
    result['passed'] = True
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
