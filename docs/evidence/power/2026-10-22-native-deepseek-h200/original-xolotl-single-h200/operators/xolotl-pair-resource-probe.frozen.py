#!/usr/bin/env python3
"""One-shot owned allocation proof; no model load, downloader or service change."""
import argparse
import csv
import ctypes as c
import hashlib
import io
import json
import os
from pathlib import Path
import socket
import subprocess
import time
import uuid


def parse_gpus(raw, expected):
    rows = list(csv.reader(io.StringIO(raw)))
    if len(rows) != expected:
        raise RuntimeError('visible NVML GPU count differs from requested allocation')
    result = []
    for row in rows:
        if len(row) != 6:
            raise RuntimeError('unexpected NVIDIA allocation inventory schema')
        index, name, identity, total, used, driver = [v.strip() for v in row]
        if name != 'NVIDIA H200' or int(total) < 128 * 1024:
            raise RuntimeError('allocation is not the required full H200 memory profile')
        if int(total)-int(used)<128*1024:
            raise RuntimeError('allocated H200 has less than 128 GiB free HBM')
        if not identity.startswith('GPU-'):
            raise RuntimeError('allocation has no physical GPU UUID')
        uuid.UUID(identity[4:])
        result.append(dict(index=int(index), name=name, uuid=identity,
                           totalMiB=int(total), usedMiB=int(used), driver=driver))
    if len({row['uuid'] for row in result}) != expected:
        raise RuntimeError('allocation repeats one physical GPU')
    return result


def cuda_probe(expected, gpus):
    driver = c.CDLL('libcuda.so.1')
    def fn(name, *args):
        value = getattr(driver, name)
        value.argtypes = list(args)
        value.restype = c.c_int
        return value
    def ok(function, *args):
        status = function(*args)
        if status:
            raise RuntimeError('CUDA driver call failed: ' + function.__name__ + ' status=' + str(status))
    init = fn('cuInit', c.c_uint)
    count = fn('cuDeviceGetCount', c.POINTER(c.c_int))
    version = fn('cuDriverGetVersion', c.POINTER(c.c_int))
    get = fn('cuDeviceGet', c.POINTER(c.c_int), c.c_int)
    attr = fn('cuDeviceGetAttribute', c.POINTER(c.c_int), c.c_int, c.c_int)
    identity = fn('cuDeviceGetUuid_v2', c.c_void_p, c.c_int)
    retain = fn('cuDevicePrimaryCtxRetain', c.POINTER(c.c_void_p), c.c_int)
    release = fn('cuDevicePrimaryCtxRelease_v2', c.c_int)
    current = fn('cuCtxSetCurrent', c.c_void_p)
    allocate = fn('cuMemAlloc_v2', c.POINTER(c.c_uint64), c.c_size_t)
    free = fn('cuMemFree_v2', c.c_uint64)
    upload = fn('cuMemcpyHtoD_v2', c.c_uint64, c.c_void_p, c.c_size_t)
    download = fn('cuMemcpyDtoH_v2', c.c_void_p, c.c_uint64, c.c_size_t)
    synchronize = fn('cuCtxSynchronize')
    can_peer = fn('cuDeviceCanAccessPeer', c.POINTER(c.c_int), c.c_int, c.c_int)
    enable = fn('cuCtxEnablePeerAccess', c.c_void_p, c.c_uint)
    peer = fn('cuMemcpyPeer', c.c_uint64, c.c_void_p, c.c_uint64, c.c_void_p, c.c_size_t)
    ok(init, 0)
    actual = c.c_int(); ok(count, c.byref(actual))
    if actual.value != expected:
        raise RuntimeError('CUDA-visible device count differs from the requested allocation')
    driver_version = c.c_int(); ok(version, c.byref(driver_version))
    devices, contexts, buffers, ids = [], [], [], []
    patterns = [0x6a09e667f3bcc909 + ordinal for ordinal in range(expected)]
    try:
        for ordinal in range(expected):
            device = c.c_int(); ok(get, c.byref(device), ordinal)
            major, minor = c.c_int(), c.c_int()
            ok(attr, c.byref(major), 75, device.value)
            ok(attr, c.byref(minor), 76, device.value)
            if (major.value, minor.value) != (9, 0):
                raise RuntimeError('allocated CUDA device is not SM90')
            raw = (c.c_ubyte * 16)(); ok(identity, c.byref(raw), device.value)
            ids.append('GPU-' + str(uuid.UUID(bytes=bytes(raw))))
            context = c.c_void_p(); ok(retain, c.byref(context), device.value)
            devices.append(device.value); contexts.append(context); buffers.append([])
            ok(current, context)
            for _ in range(2):
                pointer = c.c_uint64(); ok(allocate, c.byref(pointer), 8)
                buffers[-1].append(pointer)
            value = c.c_uint64(patterns[ordinal])
            ok(upload, buffers[-1][0], c.byref(value), 8)
            check = c.c_uint64(); ok(download, c.byref(check), buffers[-1][0], 8)
            if check.value != value.value:
                raise RuntimeError('GPU memory round trip changed bits')
        if set(ids) != {row['uuid'] for row in gpus} or len(set(ids)) != expected:
            raise RuntimeError('CUDA and NVML disagree on allocated GPU identities')
        completed = []
        for target in range(expected):
            ok(current, contexts[target])
            for source in range(expected):
                if source == target:
                    continue
                supported = c.c_int()
                ok(can_peer, c.byref(supported), devices[target], devices[source])
                if supported.value != 1:
                    raise RuntimeError('eight-card allocation lacks a direct CUDA peer direction')
                status = enable(contexts[source], 0)
                if status not in (0, 704):
                    raise RuntimeError('owned CUDA peer enablement failed: ' + str(status))
                ok(peer, buffers[target][1], contexts[target], buffers[source][0], contexts[source], 8)
                ok(synchronize)
                check = c.c_uint64(); ok(download, c.byref(check), buffers[target][1], 8)
                if check.value != patterns[source]:
                    raise RuntimeError('CUDA peer copy changed allocation-probe bits')
                completed.append([source, target])
        return dict(driverVersion=driver_version.value, capability=[9, 0],
                    cudaGpuUuids=ids, memoryRoundTrips=expected, completedPeerDirections=completed)
    finally:
        cleanup_errors=[]
        for device, context, pointers in zip(devices, contexts, buffers):
            status=current(context)
            if status:cleanup_errors.append(['setCurrent',status])
            for pointer in pointers:
                status=free(pointer)
                if status:cleanup_errors.append(['freeOwnedBuffer',status])
            status=synchronize()
            if status:cleanup_errors.append(['synchronizeOwnedContext',status])
            status=release(device)
            if status:cleanup_errors.append(['releaseOwnedPrimaryContext',status])
        if cleanup_errors:
            raise RuntimeError('CUDA allocation probe cleanup failed: '+json.dumps(cleanup_errors))


def parse_arguments(arguments=None):
    parser = argparse.ArgumentParser()
    parser.add_argument('--expected-gpus', type=int, required=True, choices=[2])
    # Six hours bounds an optimization work session plus the final two-hour
    # access window. It never modifies a running allocation's frozen deadline.
    parser.add_argument('--lease-seconds', type=int, required=True, choices=[0, 3600, 7200, 21600])
    parser.add_argument('--worker-sha256', required=True)
    return parser.parse_args(arguments)


def main():
    args = parse_arguments()
    root = Path(__file__).absolute().parent
    if root!=root.resolve() or root.is_symlink() or root.stat().st_uid != os.getuid():
        raise RuntimeError('probe requires its exact owned stage')
    if hashlib.sha256(Path(__file__).read_bytes()).hexdigest() != args.worker_sha256:
        raise RuntimeError('allocation probe source identity changed')
    result = dict(schema='aster-h200-resource-allocation-v1', unix=time.time(),
                  hostname=socket.gethostname(), expectedGpus=args.expected_gpus,
                  modelExecutionClaimed=False, phase='preflight')
    def publish():
        temporary = root / 'resource-result.tmp'
        temporary.write_text(json.dumps(result, indent=2) + '\n')
        temporary.replace(root / 'resource-result.json')
    def run(arguments):
        value = subprocess.run(arguments, capture_output=True, text=True, timeout=15, check=True)
        if len(value.stdout) > 1024 * 1024:
            raise RuntimeError('allocation probe output exceeds byte bound')
        return value.stdout
    publish()
    try:
        active = run(['nvidia-smi', '--query-compute-apps=pid,gpu_uuid', '--format=csv,noheader,nounits'])
        if active.strip():
            raise RuntimeError('allocation already has a CUDA workload; no interference is permitted')
        raw = run(['nvidia-smi', '--query-gpu=index,name,uuid,memory.total,memory.used,driver_version', '--format=csv,noheader,nounits'])
        gpus = parse_gpus(raw, args.expected_gpus)
        result['gpus'] = gpus
        result['topology'] = run(['nvidia-smi', 'topo', '-m'])
        result['cuda'] = cuda_probe(args.expected_gpus, gpus)
        result['cgroup'] = {}
        for name in ['cpu.max', 'cpuset.cpus.effective', 'memory.max']:
            path = Path('/sys/fs/cgroup') / name
            if path.is_file() and path.stat().st_size <= 4096:
                result['cgroup'][name] = path.read_text()[:4096].strip()
        result.update(phase='passed', completedUnix=time.time(), leaseEndsUnix=time.time() + args.lease_seconds)
        publish()
        print(json.dumps(result), flush=True)
        # Retain a bounded allocation for the explicitly requested next native
        # deployment step. No model or shared reference is started/restarted.
        deadline=time.monotonic()+args.lease_seconds
        while True:
            remaining=deadline-time.monotonic()
            if remaining<=0:break
            time.sleep(min(10,remaining))
        result['leaseHoldEndedUnix']=time.time();publish()
    except Exception as error:
        result.update(phase='failed', errorType=type(error).__name__, error=str(error), completedUnix=time.time())
        publish()
        raise


if __name__ == '__main__':
    main()
