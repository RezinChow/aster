"""Read-only proof of the context bound, slot count, and running artifacts on all GPUs."""
import hashlib
import http.client
import json
from pathlib import Path
import subprocess
import time


def run(*args):
    return subprocess.check_output(args, text=True, timeout=20).strip()


def digest(path):
    value = hashlib.sha256()
    with Path(path).open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def main():
    expected_power = '7fd9ef1c0752c748790669bec2d7a51b4187887dd9d45128096b87293523cf6e'
    native_path = '/data/prism/llama-prism-b10787-73bfe6c/llama-server'
    expected_native = digest(native_path)
    result = {'time_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
              'native_sha256': expected_native, 'power_sha256': expected_power,
              'instances': [], 'passed': False}
    for index in range(8):
        native_unit, power_unit = f'prism-27b@{index}', f'a3s-power@{index}'
        for unit in (native_unit, power_unit):
            assert run('systemctl', 'is-active', unit) == 'active'
            assert run('systemctl', 'is-enabled', unit) == 'enabled'
        native_pid = int(run('systemctl', 'show', native_unit, '--property=MainPID', '--value'))
        power_pid = int(run('systemctl', 'show', power_unit, '--property=MainPID', '--value'))
        assert digest(f'/proc/{native_pid}/exe') == expected_native
        assert digest(f'/proc/{power_pid}/exe') == expected_power
        command = Path(f'/proc/{native_pid}/cmdline').read_bytes().decode().rstrip('\0').split('\0')
        assert command[command.index('-c') + 1] == '262144'
        assert command[command.index('--parallel') + 1] == '2'
        connection = http.client.HTTPConnection('127.0.0.1', 18100 + index, timeout=10)
        try:
            connection.request('GET', '/props')
            response = connection.getresponse()
            props = json.loads(response.read(1024 * 1024))
            assert response.status == 200 and props['default_generation_settings']['n_ctx'] == 131072
            assert props['total_slots'] == 2
        finally:
            connection.close()
        free = int(run('nvidia-smi', f'--id={index}', '--query-gpu=memory.free', '--format=csv,noheader,nounits'))
        assert free >= 1024
        result['instances'].append({'index': index, 'native_pid': native_pid, 'power_pid': power_pid,
                                    'context_per_slot': 131072, 'slots': 2, 'gpu_memory_free_mib': free,
                                    'native_digest_matches': True, 'power_digest_matches': True,
                                    'native_active_enabled': True, 'power_active_enabled': True})
    result['passed'] = True
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
