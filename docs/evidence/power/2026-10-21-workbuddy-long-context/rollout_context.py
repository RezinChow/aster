"""Expand native context one idle replica at a time, retaining an exact rollback."""
import argparse
import http.client
import json
import os
from pathlib import Path
import subprocess
import time

BASE = Path('/data/power/workbuddy-long-context-20261021')
DROPIN = '92-workbuddy-context-20261021.conf'
EXECUTABLE = '/data/prism/llama-prism-b10787-73bfe6c/llama-server'
TOTAL_CONTEXT = 262144
SLOTS = 2


def run(*args):
    return subprocess.check_output(args, text=True, timeout=100).strip()


def get(index, path):
    connection = http.client.HTTPConnection('127.0.0.1', 18100 + index, timeout=5)
    try:
        connection.request('GET', path)
        response = connection.getresponse()
        raw = response.read(2 * 1024 * 1024)
        assert response.status == 200
        return json.loads(raw) if path != '/metrics' else raw.decode()
    finally:
        connection.close()


def idle(index):
    samples = dict(line.split() for line in get(index, '/metrics').splitlines()
                   if line.startswith(('llamacpp:requests_processing ', 'llamacpp:requests_deferred ')))
    return len(samples) == 2 and all(float(value) == 0 for value in samples.values())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--indices', required=True, nargs='+', type=int)
    parser.add_argument('--record', required=True)
    args = parser.parse_args()
    assert os.geteuid() == 0 and set(args.indices) <= set(range(8))
    assert len(set(args.indices)) == len(args.indices)
    BASE.mkdir(exist_ok=True)
    record_path = BASE / args.record
    assert record_path.parent == BASE and not record_path.exists()
    result = {'started_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
              'total_context': TOTAL_CONTEXT, 'slots_per_gpu': SLOTS,
              'context_per_slot': TOTAL_CONTEXT // SLOTS, 'instances': [], 'passed': False}
    changed = []
    try:
        for index in args.indices:
            unit = f'prism-27b@{index}'
            pid = int(run('systemctl', 'show', unit, '--property=MainPID', '--value'))
            original = Path(f'/proc/{pid}/cmdline').read_bytes().decode().rstrip('\0').split('\0')
            assert original[0] == EXECUTABLE and original.count('-c') == 1
            assert original[original.index('-c') + 1] == '65536'
            assert original[original.index('--parallel') + 1] == str(SLOTS)
            assert get(index, '/props')['default_generation_settings']['n_ctx'] == 32768
            dropin = Path(f'/etc/systemd/system/{unit}.service.d') / DROPIN
            assert not dropin.exists()
            # Wait for active work and queued native tasks before restarting.
            # This is an observed idle window, not a transactional Gateway drain.
            for attempt in range(180):
                if idle(index):
                    time.sleep(1)
                    if idle(index):
                        break
                if attempt == 179:
                    raise RuntimeError('replica did not become idle')
                time.sleep(1)
            replacement = original.copy()
            replacement[replacement.index('-c') + 1] = str(TOTAL_CONTEXT)
            assert all(not any(c in arg for c in '\n\r%"') and ' ' not in arg for arg in replacement)
            with dropin.open('x') as output:
                output.write('[Service]\nExecStart=\nExecStart=' + ' '.join(replacement) + '\n')
            changed.append((unit, dropin))
            run('systemctl', 'daemon-reload')
            run('systemctl', 'restart', unit)
            for attempt in range(120):
                try:
                    props = get(index, '/props')
                    assert props['default_generation_settings']['n_ctx'] == TOTAL_CONTEXT // SLOTS
                    assert props['total_slots'] == SLOTS
                    break
                except (OSError, AssertionError):
                    if attempt == 119:
                        raise
                    time.sleep(0.5)
            free = int(run('nvidia-smi', f'--id={index}', '--query-gpu=memory.free',
                           '--format=csv,noheader,nounits'))
            assert free >= 1024, f'insufficient GPU headroom: {free} MiB'
            after = int(run('systemctl', 'show', unit, '--property=MainPID', '--value'))
            assert after != pid and run('systemctl', 'is-active', unit) == 'active'
            row = {'index': index, 'before_pid': pid, 'after_pid': after,
                   'original_arguments': original, 'current_arguments': replacement,
                   'context_per_slot': props['default_generation_settings']['n_ctx'],
                   'total_slots': props['total_slots'], 'gpu_memory_free_mib': free,
                   'health_http': 200}
            result['instances'].append(row)
            record_path.write_text(json.dumps(result, indent=2))
            print(json.dumps({k: row[k] for k in ('index', 'after_pid', 'context_per_slot',
                                                 'total_slots', 'gpu_memory_free_mib')}), flush=True)
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
        record_path.write_text(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
