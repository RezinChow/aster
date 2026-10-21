#!/usr/bin/env python3
"""Ten bounded clock echoes on one persistent SSH channel; never set either clock."""
import hashlib
import json
from pathlib import Path
import queue
import shlex
import subprocess
import threading
import time

HERE = Path(__file__).resolve().parent
REMOTE = '''import json,signal,sys,time
signal.alarm(25)
print(json.dumps({"ready":True}),flush=True)
for expected in range(10):
 raw=sys.stdin.buffer.readline(1025)
 received=time.time_ns()
 if not raw or len(raw)>1024: break
 value=json.loads(raw)
 if value!={"sequence":expected}: raise SystemExit(2)
 sent=time.time_ns()
 print(json.dumps({"sequence":expected,"received_epoch_ns":received,"sent_epoch_ns":sent}),flush=True)
'''


def main():
    target = HERE / 'ssh-clock-persistent-diagnostic1.json'
    if target.exists():
        raise RuntimeError('existing calibration retained; no overwrite')
    started = time.monotonic()
    child = subprocess.Popen(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', 'user@172.18.101.2',
                              'python3 -u -c ' + shlex.quote(REMOTE)],
                             stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=0)
    watchdog = threading.Timer(25, child.kill)
    watchdog.start()
    messages = queue.Queue(maxsize=16)
    def reader():
        for _ in range(12):
            raw = child.stdout.readline(4097)
            received_wall, received_mono = time.time_ns(), time.monotonic_ns()
            messages.put((received_wall, received_mono, raw))
            if not raw or len(raw) > 4096:
                break
    thread = threading.Thread(target=reader, daemon=True)
    thread.start()
    rows = []
    result = {'scope': __doc__, 'status': 'failed', 'one_persistent_ssh_process': True,
              'clock_adjustments': 0, 'global_deadline_seconds': 25, 'observations': rows}
    def receive(seconds):
        limit = min(seconds, started + 25 - time.monotonic())
        if limit <= 0:
            raise TimeoutError()
        wall, mono, raw = messages.get(timeout=limit)
        if not 0 < len(raw) <= 4096:
            raise RuntimeError('bounded clock echo absent')
        return wall, mono, json.loads(raw)
    try:
        if receive(10)[2] != {'ready': True}:
            raise RuntimeError('clock echo readiness differs')
        for number in range(10):
            local_send, mono_send = time.time_ns(), time.monotonic_ns()
            child.stdin.write((json.dumps({'sequence': number}) + '\n').encode())
            child.stdin.flush()
            local_receive, mono_receive, value = receive(2)
            if (not isinstance(value, dict) or value.get('sequence') != number
                    or set(value) != {'sequence', 'received_epoch_ns', 'sent_epoch_ns'}
                    or any(type(value[name]) is not int or value[name] <= 0 for name in ('received_epoch_ns', 'sent_epoch_ns'))
                    or value['sent_epoch_ns'] < value['received_epoch_ns']):
                raise RuntimeError('typed clock echo differs')
            wall_elapsed, mono_elapsed = local_receive - local_send, mono_receive - mono_send
            if wall_elapsed < 0 or abs(wall_elapsed - mono_elapsed) > 50000000:
                raise RuntimeError('local wall clock discontinuity')
            lower = value['sent_epoch_ns'] - local_receive
            upper = value['received_epoch_ns'] - local_send
            if lower > upper:
                raise RuntimeError('clock bounds inverted')
            rows.append({'sequence': number, 'local_send_epoch_ns': local_send,
                         'local_receive_epoch_ns': local_receive, **value,
                         'remote_minus_local_lower_ns': lower, 'remote_minus_local_upper_ns': upper,
                         'roundtrip_monotonic_ns': mono_elapsed})
        lower = max(row['remote_minus_local_lower_ns'] for row in rows)
        upper = min(row['remote_minus_local_upper_ns'] for row in rows)
        if lower > upper:
            raise RuntimeError('offset intersection empty; possible clock variation')
        result.update(status='passed', offset_lower_seconds=lower / 1e9, offset_upper_seconds=upper / 1e9,
                      offset_interval_width_ms=(upper - lower) / 1e6,
                      assumption='constant relative clock offset during these ten echoes; nonnegative transport delays; bounds do not retroactively prove historical clock offset')
    except Exception as exc:
        result.update(failure_exception=type(exc).__name__)
    finally:
        child.stdin.close()
        try:
            child.wait(timeout=2)
        except subprocess.TimeoutExpired:
            child.kill()
            child.wait(timeout=2)
        thread.join(timeout=1)
        child.stdout.close()
        watchdog.cancel()
        watchdog.join(timeout=1)
        result.update(elapsed_seconds=time.monotonic() - started, own_process_reaped=child.poll() is not None,
                      source_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), reader_terminated=not thread.is_alive())
        with target.open('x', encoding='utf-8') as stream:
            json.dump(result, stream, indent=2)
            stream.write('\n')
    print(json.dumps({key: value for key, value in result.items() if key != 'observations'}))
    if result['status'] != 'passed':
        raise SystemExit(1)


if __name__ == '__main__':
    main()
