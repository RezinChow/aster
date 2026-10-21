#!/usr/bin/env python3
"""Start the isolated remote H200 deployment behind authenticated a3s-power."""

import argparse
import hashlib
import json
import os
import secrets
import signal
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path('/nvme/a3s-power-xq-20261021')
STAGING = Path('/mnt/shared-storage-user/yangchao/Workspace/aster-h200-xq')
PRIVATE = Path('/root/aster-h200-xq')
MODEL_NAME = 'deepseek-v4.1-flash-1017-xq-v3'
MODEL_SHA256 = '73df1934302f867601dd27f7fca59109d9b11674f50cc60526ec2a1cd4f3d389'
SIDECAR_SHA256 = '5f92242e2ebed06e6831bbcae4e35e679c9138cdf6df0c8b36e8013c99c79a34'
PROCESS_MARKER = 'A3S_POWER_OPERATOR_INSTANCE'
PARALLEL_CHOICES = (1, 2, 4, 8, 16)
PROFILES = {
    'exact': (False, False, False, False),
    'kv4': (True, False, False, False),
    'kv4-keep': (True, False, True, False),
    'kv4-keep-ram': (True, False, True, True),
    'dspark': (True, True, False, False),
    'dspark-keep': (True, True, True, False),
    'dspark-keep-ram': (True, True, True, True),
}


def require_hardware():
    result = subprocess.run(
        ['nvidia-smi', '--query-gpu=index,name,compute_cap,memory.total',
         '--format=csv,noheader,nounits'], check=True, capture_output=True, text=True)
    rows = [[value.strip() for value in line.split(',')] for line in result.stdout.splitlines() if line.strip()]
    if len(rows) != 8 or {int(row[0]) for row in rows} != set(range(8)):
        raise RuntimeError('deployment requires exactly eight visible GPUs numbered 0 through 7')
    for index, name, capability, memory in rows:
        if name != 'NVIDIA H200' or capability != '9.0' or int(memory) < 122880:
            raise RuntimeError(f'GPU {index} does not meet the H200 deployment contract')
    return rows


def engine_config(layout, profile, context, parallel=1, draft_depth=4):
    if profile not in PROFILES:
        raise ValueError('unknown profile; choose from '+', '.join(PROFILES))
    if type(parallel) is not int or parallel not in PARALLEL_CHOICES:
        raise ValueError('parallel slots must be 1, 2, 4, 8, or 16')
    kv4, dspark, keep, buffered = PROFILES[profile]
    if draft_depth not in (2, 4, 8, 12) or (not dspark and draft_depth != 4):
        raise ValueError('draft depth 2, 4, 8, or 12 is supported only for DSpark profiles')
    args = ['-m', str(ROOT/'models/V41-XQ-1017-v3.gguf'), '--backend', 'cuda',
            '--experts', 'gpu', '--engram', f'{ROOT}/engram-a:{ROOT}/engram-b',
            '--rank', str(STAGING/'assets/v3/rank-1017-v3.bin'), '--ctx', str(context),
            '--stop', '1', '--arena-gib', '8', '--route-bias', '0', '--route-bias-file', '0',
            '--vram-margin', '8', '--prompt-batch', '8192', '--prefill-chunk', '512']
    split = {'split8': '5,10,15,20,25,30,35', 'replica4x2': '20', 'replica8x1': ''}[layout]
    if split:
        devices = '0,1,2,3,4,5,6,7' if layout == 'split8' else '0,1'
        args += ['--layer-split', split, '--split-device', devices]
    if layout != 'replica8x1' and parallel != 1:
        raise ValueError('batch slots require a single-card replica; layer splitting disables them')
    if kv4:
        args += ['--kv-fp4']
    environment = {'STRATA_NO_LARGEPAGES': '1', 'STRATA_SELFTEST_HANDOFF': '1',
                   'STRATA_SERVE_KEEP_CACHE': '1' if keep else '0', 'STRATA_KV_FP4': '0',
                   'STRATA_DS41_PARALLEL': '1',
                   'STRATA_DECODE_DIRECT': '0' if buffered else '1'}
    if keep:
        args += ['--no-vram-lru']
        environment['STRATA_SERVE_KEEP_MAX'] = str(context)
    if dspark:
        sidecar = STAGING/'assets/V41-MTP-Vision-1017.Q2_K.gguf'
        if not sidecar.is_file():
            raise RuntimeError('DSpark profile requires the verified 1017 Q2_K sidecar')
        checksum = hashlib.sha256()
        with sidecar.open('rb') as stream:
            for block in iter(lambda: stream.read(16 * 1024**2), b''):
                checksum.update(block)
        if checksum.hexdigest() != SIDECAR_SHA256:
            raise RuntimeError('DSpark sidecar failed the pinned SHA-256 gate')
        environment.update({'STRATA_SERVE_DSPARK': str(sidecar), 'STRATA_DSPARK_DEPTH': str(draft_depth)})
    config = {
        'exe': str(ROOT/'build-h200/ds41_generate'), 'args': args,
        'cwd': str(ROOT/'source/xolotl'), 'tokenizer': str(STAGING/'assets/tokenizer'),
        'model_name': MODEL_NAME, 'log': str(ROOT/f'logs/engine-{layout}-{profile}.log'),
        'host': '127.0.0.1', 'port': 8150, 'gpu': list(range(8)), 'gpu_order': 'as_given',
        'parallel': parallel, 'api_monitor': False,
        'sampling': {'temperature': 0, 'top_p': 1}, 'env': environment,
    }
    if layout == 'replica4x2':
        config['replicas'] = 4
    elif layout == 'replica8x1':
        config['replicas'] = 8
    if split:
        config['layer_split'] = split
    return config


def owned_group_members(group, marker):
    members = []
    expected = os.fsencode(PROCESS_MARKER+'='+marker)
    for entry in Path('/proc').iterdir():
        if not entry.name.isdecimal():
            continue
        try:
            with (entry/'stat').open('rb') as source:
                fields = source.read(65536).rsplit(b')', 1)[1].split()
            if fields[0] in (b'Z', b'X') or int(fields[2]) != group or int(fields[3]) != group:
                continue
            with (entry/'environ').open('rb') as source:
                environment = source.read(1024**2+1)
            if len(environment) > 1024**2 or expected not in environment.split(b'\0'):
                raise RuntimeError('refusing to stop an unrelated process group')
            members.append(int(entry.name))
        except (FileNotFoundError, ProcessLookupError):
            continue
    return members


def stop_owned(name, expected_argument):
    pid_file = PRIVATE/f'{name}.pid'
    if not pid_file.exists():
        return
    record = json.loads(pid_file.read_text())
    if not isinstance(record, dict):
        raise RuntimeError(f'refusing to stop an unrelated or unrecorded {name} process')
    pid, marker = record['pid'], record['marker']
    if (type(pid) is not int or pid <= 1 or not isinstance(marker, str) or len(marker) != 32
            or any(c not in '0123456789abcdef' for c in marker)):
        raise RuntimeError('invalid private process ownership record')
    command = Path(f'/proc/{pid}/cmdline')
    try:
        arguments = command.read_bytes()
    except FileNotFoundError:
        arguments = b''
    if arguments and os.fsencode(str(expected_argument)) not in arguments.split(b'\0'):
        raise RuntimeError(f'refusing to stop an unrelated {name} process')
    if not owned_group_members(pid, marker):
        return
    try:
        os.killpg(pid, signal.SIGTERM)
        for _ in range(100):
            if not owned_group_members(pid, marker):
                return
            time.sleep(0.1)
        os.killpg(pid, signal.SIGKILL)
    except ProcessLookupError:
        return


def start_process(name, command, environment):
    environment = dict(environment)
    marker = environment.setdefault(PROCESS_MARKER, secrets.token_hex(16))
    if len(marker) != 32 or any(c not in '0123456789abcdef' for c in marker):
        raise RuntimeError('invalid process ownership marker')
    log = (ROOT/f'logs/{name}-service.log').open('ab', buffering=0)
    process = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=log,
                               stderr=subprocess.STDOUT, env=environment, start_new_session=True)
    log.close()
    try:
        temporary = PRIVATE/f'{name}.pid.tmp'
        temporary.write_text(json.dumps({'pid': process.pid, 'marker': marker}))
        temporary.chmod(0o600)
        temporary.replace(PRIVATE/f'{name}.pid')
    except BaseException:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        process.wait(timeout=5)
        raise
    return process


def wait_health(process, port, timeout, require_loaded=False):
    deadline = time.monotonic()+timeout
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f'service exited before becoming healthy, status {process.returncode}')
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{port}/health', timeout=5) as response:
                if response.status == 200:
                    if not require_loaded:
                        return
                    body = response.read(65537)
                    if len(body) > 65536:
                        raise RuntimeError('engine readiness response exceeds its size limit')
                    if json.loads(body).get('loaded') is True:
                        return
        except (OSError, TimeoutError):
            pass
        time.sleep(2)
    raise RuntimeError(f'port {port} did not become healthy within {timeout} seconds')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['start', 'stop', 'configure'])
    parser.add_argument('--layout', choices=['split8', 'replica4x2', 'replica8x1'], default='split8')
    parser.add_argument('--profile', choices=list(PROFILES), default='exact')
    parser.add_argument('--context', type=int, default=131072)
    parser.add_argument('--parallel', type=int, choices=PARALLEL_CHOICES, default=1)
    parser.add_argument('--draft-depth', type=int, choices=[2, 4, 8, 12], default=4)
    args = parser.parse_args()
    if not 4096 <= args.context <= 1048576:
        raise ValueError('context must be between 4096 and 1048576')
    PRIVATE.mkdir(mode=0o700, exist_ok=True)
    PRIVATE.chmod(0o700)
    engine = ROOT/'source/xolotl/tools/v41/serve/serve_ds41.py'
    power = ROOT/'bin/a3s-power'
    if args.action == 'stop':
        stop_owned('power', power)
        stop_owned('xolotl', engine)
        print('OWN_DEPLOYMENT_STOPPED')
        return
    require_hardware()
    config = engine_config(args.layout, args.profile, args.context, args.parallel, args.draft_depth)
    instance = secrets.token_hex(16)
    config['env'][PROCESS_MARKER] = instance
    engine_path = PRIVATE/'xolotl-generated.json'
    engine_path.write_text(json.dumps(config, indent=2))
    engine_path.chmod(0o600)
    key_path = PRIVATE/'api.key'
    if not key_path.exists():
        key_path.write_text(secrets.token_hex(32))
    key_path.chmod(0o600)
    key = key_path.read_text().strip()
    if len(key) != 64 or any(c not in '0123456789abcdef' for c in key):
        raise RuntimeError('existing deployment API key has an invalid format')
    key_hash = hashlib.sha256(key.encode()).hexdigest()
    concurrent = {'split8': 1, 'replica4x2': 4, 'replica8x1': 8}[args.layout] * args.parallel
    power_path = PRIVATE/'power.acl'
    power_path.write_text(
        f'host = "0.0.0.0"\nport = 30002\ndata_dir = "{PRIVATE}/data"\n'
        f'api_keys = ["{key_hash}"]\nredact_logs = true\nnum_parallel = 1\n'
        f'max_concurrent_requests = {concurrent}\nmax_queued_requests = 64\nqueue_timeout_ms = 300000\n'
        f'proxy_upstream "{MODEL_NAME}" {{\n    url = "http://127.0.0.1:8150"\n}}\n')
    power_path.chmod(0o600)
    if args.action == 'configure':
        print('CONFIGURED', args.layout, args.profile, args.context)
        return
    model = ROOT/'models/V41-XQ-1017-v3.gguf'
    identity_path = ROOT/'models/verified-model.json'
    if not model.is_file() or not identity_path.is_file():
        raise RuntimeError('joined GGUF has not passed the deployment checksum gate')
    identity = json.loads(identity_path.read_text())
    stat = model.stat()
    if identity != {'sha256': MODEL_SHA256, 'size': stat.st_size, 'mtime_ns': stat.st_mtime_ns}:
        raise RuntimeError('joined GGUF changed after checksum verification')
    warmup = None
    if PROFILES[args.profile][3]:
        started = time.monotonic()
        count = 0
        with model.open('rb') as source:
            for block in iter(lambda: source.read(16 * 1024**2), b''):
                count += len(block)
        if count != stat.st_size:
            raise RuntimeError('model size changed while warming its file cache')
        warmup = {'bytes': count, 'elapsed_s': time.monotonic()-started}
    stop_owned('power', power)
    stop_owned('xolotl', engine)
    environment = dict(os.environ)
    for key in ('STRATA_DSPARK', 'STRATA_SERVE_DSPARK', 'STRATA_DENSE_REQUANT',
                'STRATA_SERVE_PASS_BIAS', 'STRATA_RB_PROTECT', 'STRATA_RB_POOL',
                'STRATA_KV_FP4', 'STRATA_SERVE_KEEP_CACHE', 'STRATA_SERVE_KEEP_LRU',
                'STRATA_SERVE_KEEP_MAX', 'STRATA_DSPARK_DEPTH', 'STRATA_DECODE_DIRECT'):
        environment.pop(key, None)
    environment['A3S_POWER_HOME'] = str(PRIVATE/'data')
    environment[PROCESS_MARKER] = instance
    environment['CUDA_DEVICE_ORDER'] = 'PCI_BUS_ID'
    environment['LD_LIBRARY_PATH'] = '/usr/local/cuda/lib64:' + environment.get('LD_LIBRARY_PATH', '')
    upstream = start_process('xolotl', [sys.executable, str(engine), '--engine', 'strata',
                            '--config', str(engine_path), '--host', '127.0.0.1', '--port', '8150'], environment)
    wait_health(upstream, 8150, 1800, require_loaded=True)
    frontend = start_process('power', [str(power), 'serve', '--config', str(power_path)], environment)
    wait_health(frontend, 30002, 60)
    record = {'layout': args.layout, 'profile': args.profile, 'context': args.context,
              'parallel_per_replica': args.parallel, 'max_concurrent': concurrent,
              'decode_file_io': 'buffered' if PROFILES[args.profile][3] else 'direct',
              'host_file_cache_warmup': warmup,
              'keep_cache_new_token_limit': args.context if PROFILES[args.profile][2] else None,
              'draft_depth': args.draft_depth if PROFILES[args.profile][1] else None,
              'model': MODEL_NAME, 'port': 30002, 'upstream_port': 8150,
              'started_unix': time.time(), 'xolotl_pid': upstream.pid, 'power_pid': frontend.pid}
    (ROOT/'run/active-profile.json').write_text(json.dumps(record, indent=2))
    print(json.dumps(record), flush=True)


if __name__ == '__main__':
    main()
