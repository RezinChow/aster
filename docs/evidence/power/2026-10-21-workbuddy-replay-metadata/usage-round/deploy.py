"""Roll out the exact tested Power binary, retaining native contexts and per-instance rollback."""
import argparse
import hashlib
import http.client
import json
import os
from pathlib import Path
import shutil
import subprocess
import time

from metadata_fixture import screenshot_body

BASE = Path('/data/power/workbuddy-replay-metadata-20261021/usage-round')
DROPIN = '94-workbuddy-replay-usage-20261021.conf'
OLD_DIGEST = 'b4301eb85bb49780b7b56f6dc36249b8675a2bdf023dbe1912492ebe12891ca2'


def run(*args):
    return subprocess.check_output(args, text=True, timeout=100).strip()


def pid(unit):
    return int(run('systemctl', 'show', unit, '--property=MainPID', '--value'))


def digest(path):
    value = hashlib.sha256()
    with Path(path).open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def native_props(index):
    connection = http.client.HTTPConnection('127.0.0.1', 18100 + index, timeout=10)
    try:
        connection.request('GET', '/props')
        response = connection.getresponse()
        value = json.loads(response.read(1024 * 1024))
        assert response.status == 200 and value['default_generation_settings']['n_ctx'] == 131072
        assert value['total_slots'] == 2
    finally:
        connection.close()


def probe(index, screenshot=False):
    connection = http.client.HTTPConnection('127.0.0.1', 8080 if screenshot else 18200 + index, timeout=20)
    try:
        if screenshot:
            gateway_pid = pid('a3s-gateway')
            keys = [part.split(b'=', 1)[1] for part in Path(f'/proc/{gateway_pid}/environ').read_bytes().split(b'\0')
                    if part.startswith(b'A3S_GATEWAY_SHARED_TOKEN=')]
            assert len(keys) == 1
            value = screenshot_body()
            value['stream'] = False
            connection.request('POST', '/v1/chat/completions', json.dumps(value),
                               {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + keys[0].decode()})
        else:
            connection.request('GET', '/health')
        response = connection.getresponse()
        value = json.loads(response.read(1024 * 1024))
        assert response.status == 200, str(response.status)
        if screenshot:
            assert value['choices'][0]['message']['content'].strip() == 'OK'
    finally:
        connection.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--binary-sha256', required=True)
    parser.add_argument('--patch-sha256', required=True)
    args = parser.parse_args()
    assert os.geteuid() == 0 and all(len(v) == 64 and set(v) <= set('0123456789abcdef')
                                   for v in (args.binary_sha256, args.patch_sha256))
    source = Path('/code/Power/target/release/a3s-power')
    record = BASE / 'deployment.json'
    assert not record.exists()
    assert digest(source) == args.binary_sha256 and digest(BASE / 'source.patch') == args.patch_sha256
    assert 'test result: ok. 1953 passed; 0 failed;' in (BASE / 'library-tests.log').read_text()
    assert 'test result: ok. 6 passed; 0 failed;' in (BASE / 'focused-tests.log').read_text()
    diff = subprocess.check_output(['git', '-C', '/code/Power', 'diff', '--binary'])
    assert hashlib.sha256(diff).hexdigest() == args.patch_sha256
    changed_paths = set(run('git', '-C', '/code/Power', 'diff', '--name-only').splitlines())
    assert changed_paths == {'src/api/types_chat_message_compat.rs', 'src/api/types_workbuddy_tests.rs',
                             'docs/workbuddy-compatibility.md'}
    native_before = {str(i): pid(f'prism-27b@{i}') for i in range(8)}
    for index in range(8):
        assert digest(f'/proc/{pid(f"a3s-power@{index}")}/exe') == OLD_DIGEST
        native_props(index)
        probe(index)
        assert not (Path(f'/etc/systemd/system/a3s-power@{index}.service.d') / DROPIN).exists()
    release = Path('/opt/a3s/releases') / args.binary_sha256 / 'a3s-power'
    release.parent.mkdir(exist_ok=True)
    if release.exists():
        assert digest(release) == args.binary_sha256
    else:
        shutil.copyfile(source, release)
        release.chmod(0o755)
    result = {'started_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
              'source_base_commit': run('git', '-C', '/code/Power', 'rev-parse', 'HEAD'),
              'source_patch_sha256': args.patch_sha256, 'binary_sha256': args.binary_sha256,
              'native_pids_before': native_before, 'instances': [], 'passed': False}
    changed = []
    try:
        for index in (7, 0, 1, 2, 3, 4, 5, 6):
            unit = f'a3s-power@{index}'
            before = pid(unit)
            dropin = Path(f'/etc/systemd/system/{unit}.service.d') / DROPIN
            with dropin.open('x') as output:
                output.write(f'[Service]\nExecStart=\nExecStart={release} serve --config /etc/a3s/power/{index}.acl\n')
            changed.append((unit, dropin))
            run('systemctl', 'daemon-reload')
            run('systemctl', 'restart', unit)
            for attempt in range(60):
                try:
                    probe(index)
                    break
                except (OSError, AssertionError):
                    if attempt == 59:
                        raise
                    time.sleep(0.3)
            for attempt in range(48):
                try:
                    probe(index, screenshot=True)
                    break
                except AssertionError as error:
                    if str(error) != '400' or attempt == 47:
                        raise
            after = pid(unit)
            assert after != before and digest(f'/proc/{after}/exe') == args.binary_sha256
            assert pid(f'prism-27b@{index}') == native_before[str(index)]
            native_props(index)
            row = {'index': index, 'before_pid': before, 'after_pid': after,
                   'binary_sha256': args.binary_sha256, 'health_http': 200, 'gateway_screenshot_http': 200,
                   'probe_scope': 'production load-balanced Gateway; exact member not asserted',
                   'native_pid_unchanged': True, 'context_per_slot': 131072, 'native_slots': 2}
            result['instances'].append(row)
            record.write_text(json.dumps(result, indent=2))
            print(json.dumps(row), flush=True)
        result['native_pids_after'] = {str(i): pid(f'prism-27b@{i}') for i in range(8)}
        assert result['native_pids_before'] == result['native_pids_after']
        result['passed'] = True
    except BaseException as error:
        result['failure'] = type(error).__name__ + ': ' + str(error)
        result['rollback'] = []
        for unit, dropin in reversed(changed):
            dropin.unlink()
            run('systemctl', 'daemon-reload')
            run('systemctl', 'restart', unit)
            result['rollback'].append(unit)
        raise
    finally:
        record.write_text(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
