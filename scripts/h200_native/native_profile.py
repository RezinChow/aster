"""Bounded ownership helpers for one explicit Nsight native service experiment."""
import json
import os
from pathlib import Path
import signal
import time


def verified_target(root, binary, proc=Path('/proc')):
    path = root / 'profile-target-process.json'
    if path.resolve() != path or path.stat().st_size > 4096 or path.stat().st_uid != os.getuid():
        raise RuntimeError('profile target receipt is not a bounded owned file')
    value = json.loads(path.read_text())
    if (set(value) != {'pid', 'start_ticks', 'uid', 'binary'}
            or type(value['pid']) is not int or value['pid'] <= 1
            or type(value['start_ticks']) is not int or value['start_ticks'] <= 0
            or value['uid'] != os.getuid() or value['binary'] != str(binary)):
        raise RuntimeError('profile target receipt differs from the exact owned binary')
    process = proc / str(value['pid'])
    fields = (process / 'stat').read_text().split(') ', 1)[1].split()
    if process.stat().st_uid != value['uid'] or int(fields[19]) != value['start_ticks']:
        raise RuntimeError('profile target PID identity changed')
    return value


def await_target(root, binary, child, timeout=30):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if child.poll() is not None:
            raise RuntimeError('owned profiler exited before starting its native target')
        if (root / 'profile-target-process.json').exists():
            return verified_target(root, binary)
        time.sleep(.1)
    raise TimeoutError('owned profiler exceeded its native target startup budget')


def stop_target(root, binary):
    """A pidfd makes the verified native identity stable across the final signal."""
    if not (root / 'profile-target-process.json').exists():
        return
    try:
        value = verified_target(root, binary)
    except FileNotFoundError:
        # The receipt remains; the exact process has already exited.
        return
    try:
        descriptor = os.pidfd_open(value['pid'])
    except ProcessLookupError:
        return
    try:
        # Revalidate after opening: a recycled PID must never receive a signal.
        verified_target(root, binary)
        signal.pidfd_send_signal(descriptor, signal.SIGKILL)
    except (FileNotFoundError, ProcessLookupError):
        return
    finally:
        os.close(descriptor)
