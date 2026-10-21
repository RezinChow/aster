#!/usr/bin/env python3
"""Compare fixed-concurrency Xet; retain resumable HTTP data and restore on failure."""

import fcntl
import json
import os
import signal
import subprocess
import time
from pathlib import Path

from service import STAGING
from download_auth import PROXY_PORTS


def stop_download(name, action):
    pid = int((STAGING/name).read_text())
    command = Path(f'/proc/{pid}/cmdline')
    if not command.exists() or not command.read_bytes():
        return
    args = command.read_bytes().split(b'\0')
    if os.fsencode(str(STAGING/'prepare_assets.py')) not in args or os.fsencode(action) not in args or os.getpgid(pid) != pid:
        raise RuntimeError('refusing to stop an unrelated download process')
    os.killpg(pid, signal.SIGTERM)
    for _ in range(100):
        if not command.exists() or not command.read_bytes():
            return
        time.sleep(.1)
    raise RuntimeError('old downloader did not stop')


def spawn(command, name):
    with (STAGING/f'logs/{name}.log').open('ab', buffering=0) as log:
        return subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=log,
                                stderr=subprocess.STDOUT, start_new_session=True)


def state(value):
    value['unix'] = time.time()
    destination = STAGING/'transport-state.json'
    temporary = destination.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, indent=2))
    temporary.replace(destination)


def restore_ranges():
    for action, workers, pid_file in [('model', '8', 'model-fetch.pid'), ('sidecar', '1', 'sidecar-fetch.pid')]:
        process = spawn(['python3', str(STAGING/'prepare_assets.py'), action, '--root', str(STAGING),
                         '--workers', workers, '--range-proxies',
                         *[f'socks5h://127.0.0.1:{port}' for port in PROXY_PORTS]],
                        f'{action}-fetch-after-xet-trial')
        (STAGING/pid_file).write_text(str(process.pid))
    state({'phase': 'http_ranges_restored'})


def run_trial():
    proxy = spawn(['python3', str(STAGING/'download_proxy.py')], 'download-proxy-fixed4')
    (STAGING/'download-proxy.pid').write_text(str(proxy.pid))
    time.sleep(1)
    if proxy.poll() is not None:
        raise RuntimeError('fixed-concurrency download proxy did not start')
    # Configuration comparison, not recovery from an observation timeout.
    stop_download('model-fetch.pid', 'model')
    stop_download('sidecar-fetch.pid', 'sidecar')
    native = None
    promoted = False
    try:
        command = [str(STAGING/'fetch-venv/bin/python'), str(STAGING/'fetch_xet.py'),
                   '--root', str(STAGING), '--concurrency', '4']
        native = spawn(command, 'xet-fixed4-trial')
        (STAGING/'xet-fixed4.pid').write_text(str(native.pid))
        started = time.monotonic()
        state({'phase': 'xet_fixed4_trial', 'pid': native.pid, 'limit_s': 900})
        try:
            result = native.wait(timeout=900)
        except subprocess.TimeoutExpired:
            result = None
        elapsed = time.monotonic()-started
        completed = STAGING/'assets/v3/V41-XQ-1017-v3.gguf.part-16-of-16'
        speed = completed.stat().st_size/elapsed if result == 0 and completed.is_file() else 0
        print('FIXED4_TRIAL_RESULT', json.dumps({'status': result, 'elapsed_s': elapsed,
                                                'verified_bytes_per_second': speed}), flush=True)
        if speed >= 2250000:
            native = spawn(command+['--all-parts'], 'xet-fixed4-model')
            for name in ['model-fetch.pid', 'sidecar-fetch.pid']:
                (STAGING/name).write_text(str(native.pid))
            state({'phase': 'xet_fixed4_model', 'pid': native.pid, 'trial_bytes_per_second': speed})
            result = native.wait()
            if result != 0:
                raise RuntimeError('promoted Xet downloader exited with an error')
            state({'phase': 'all_native_assets_verified', 'pid': native.pid})
            promoted = True
    finally:
        if native is not None and native.poll() is None:
            os.killpg(native.pid, signal.SIGTERM)
            try:
                native.wait(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(native.pid, signal.SIGKILL)
                native.wait()
        if not promoted:
            restore_ranges()
        if proxy.poll() is None:
            proxy.terminate()
            proxy.wait(timeout=10)


def main():
    with (STAGING/'transport-trial.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        run_trial()


if __name__ == '__main__':
    main()
