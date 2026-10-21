#!/usr/bin/env python3
"""Candidate-only private wrappers for existing production native replicas.

render performs no process startup, registration, native HTTP, or model hashing.
start/stop can signal only this helper's exact Power/Gateway children. There is
deliberately no native-engine start, restart, stop, or signal operation.
"""
from pathlib import Path
import argparse
import datetime
import fcntl
import hashlib
import http.client
import importlib.util
import json
import os
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid

ROOT = Path('/code/Power/.git/optimization-20261021')
RUN = ROOT / 'eight-replica'
KEY = ROOT / 'benchmark.key'
POWER = ROOT / 'candidate-v4-power'
GATEWAY = ROOT / 'gateway-cancel-candidate'
POWER_SHA = '75afe5de8d423547fdb9b9bb302b17ca9e168d6f6fe13a18d29fbce9492bf1c1'
GW_SHA = 'eaf9f4ca8baf38074d1548badebbd3b42bd08ab5174e2f9136101ccbcfb6c1fd'
RUNTIME_SHA = '661b413b780759bfa2c9b8fd87608c15fcc3651142d771b1c94d11d01195d298'
MODEL = '/data/models/Ternary-Bonsai-2-27B-PTQ1_0.gguf'
MODEL_SHA = '53107f530aa52eb00912263ab1ee29bd199261c87cd7b4ad4ca1318c1fe33ee3'
ALIAS = 'prism-27b'
EVIDENCE = Path('/code/aster/docs/evidence/power/2026-10-21-serving-optimization')
CORPUS = EVIDENCE / 'eight-card-corpus.jsonl'
CORPUS_SHA = '1791c2cc7f6496454c69c903f2c3a82b61240b0e46d6b9b690747a6e7b113256'
MATRIX = EVIDENCE / 'matrix-campaign.py'
QUALIFICATION = Path('/code/aster/scripts/power_serving_qualification.py')
KINDS = ('power', 'gateway')


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as file:
        for block in iter(lambda: file.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def selected(indices):
    values = list(range(8)) if not indices else list(indices)
    if len(values) != len(set(values)) or any(type(i) is not int or i not in range(8) for i in values):
        raise ValueError('unique GPU indices in 0..7 are required')
    return sorted(values)


def ports(index):
    if type(index) is not int or index not in range(8):
        raise ValueError('worker index is outside the closed set')
    return {'native': 18100 + index, 'power': 19500 + index, 'gateway': 19890 + index}


def atomic(path, value):
    path = Path(path)
    temp = path.with_name(path.name + '.tmp-' + uuid.uuid4().hex)
    descriptor = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'w') as file:
        json.dump(value, file, indent=2)
        file.write('\n')
        file.flush()
        os.fsync(file.fileno())
    os.replace(temp, path)


def immutable(path, content):
    path = Path(path)
    if path.exists():
        if path.is_symlink() or path.read_text() != content:
            raise RuntimeError('existing private configuration differs; no overwrite')
    else:
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, 'w') as file:
            file.write(content)


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def benchmark_key():
    # Only the fresh benchmark identity is read, never a production file.
    if KEY.is_symlink() or KEY.stat().st_size > 4096:
        raise RuntimeError('invalid benchmark key file')
    value = KEY.read_text().strip()
    if not value or any(c in value for c in '\r\n\x00'):
        raise RuntimeError('invalid benchmark key')
    return value


def power_config(index, slots, key):
    p = ports(index)
    return (f'host = "127.0.0.1"\nport = {p["power"]}\n'
            f'data_dir = {json.dumps(str(RUN / ("worker-" + str(index) + "-data")))}\n'
            f'prism_upstream = "http://127.0.0.1:{p["native"]}"\n'
            'prism_profile = "baseline"\ntee_mode = false\nspec_mode = "off"\n'
            f'num_parallel = {slots}\nmax_concurrent_requests = {slots}\n'
            f'max_queued_requests = 8\nqueue_timeout_ms = 1000\napi_keys = [{json.dumps(key)}]\n')


def gateway_config(index, key):
    p = ports(index)
    return (f'mode {{ kind = "standalone" }}\nentrypoints "qualification" {{ address = "127.0.0.1:{p["gateway"]}" }}\n'
            'routers "health" {\n rule = "Path(`/health`)"\n service = "power"\n'
            ' entrypoints = ["qualification"]\n priority = 100\n}\n'
            'routers "qualification" {\n rule = "PathPrefix(`/v1/`)"\n service = "power"\n'
            ' entrypoints = ["qualification"]\n middlewares = ["benchmark-auth"]\n}\n'
            'services "power" {\n load_balancer {\n strategy = "round-robin"\n'
            ' request_timeout = "135s"\n stream_idle_timeout = "30s"\n stream_total_timeout = "135s"\n'
            f' servers = [{{ url = "http://127.0.0.1:{p["power"]}" }}]\n }}\n}}\n'
            'middlewares "benchmark-auth" {\n type = "api-key"\n header = "Authorization"\n'
            f' keys = [{json.dumps("Bearer " + key)}]\n}}\n'
            'observability {\n metrics_enabled = true\n access_log_enabled = false\n tracing_enabled = false\n}\n')


def paths(index, slots):
    stem = 'worker-' + str(index)
    return {'power_config': RUN / (stem + '-np' + str(slots) + '.acl'),
            'gateway_config': RUN / ('gateway-' + stem + '.acl'),
            'home': RUN / (stem + '-home')}


def argv(kind, index, slots):
    if kind not in KINDS or slots not in (1, 2):
        raise ValueError('only Power/Gateway NP1/NP2 wrappers are owned')
    value = paths(index, slots)
    return ([str(POWER), 'serve', '--config', str(value['power_config'])] if kind == 'power' else
            [str(GATEWAY), '--config', str(value['gateway_config']), '--log-level', 'warn'])


def pidfile(kind, index):
    if kind not in KINDS:
        raise ValueError('native processes are never owned')
    ports(index)
    return RUN / (kind + '-worker-' + str(index) + '.pid')


def recordfile(kind, index):
    return pidfile(kind, index).with_suffix('.pid.json')


def read_limited(path, maximum=65536):
    with Path(path).open('rb') as file:
        value = file.read(maximum + 1)
    if len(value) > maximum:
        raise RuntimeError('observation exceeds byte bound')
    return value


def proc(pid):
    directory = Path('/proc') / str(pid)
    try:
        raw = read_limited(directory / 'cmdline')
        ticks = int(read_limited(directory / 'stat').decode().rsplit(')', 1)[1].split()[19])
    except FileNotFoundError:
        return None
    if not raw:
        return None  # Exited/zombie has no executable request owner.
    return {'argv': raw.decode().rstrip('\0').split('\0'), 'start_ticks': ticks}


def verify_owned(kind, index, record):
    # All externally supplied records are untrusted, including stale PID files.
    expected_keys = {'kind', 'index', 'slots', 'pid', 'start_ticks', 'argv', 'created_at', 'log'}
    if not isinstance(record, dict) or set(record) != expected_keys:
        raise RuntimeError('invalid owned process receipt')
    if record['kind'] != kind or record['index'] != index or kind not in KINDS:
        raise RuntimeError('receipt does not name this private wrapper')
    expected = argv(kind, index, record['slots'])
    if record['argv'] != expected or type(record['pid']) is not int or record['pid'] <= 0:
        raise RuntimeError('owned command receipt differs')
    if type(record['start_ticks']) is not int or record['start_ticks'] <= 0:
        raise RuntimeError('invalid process generation')
    actual = proc(record['pid'])
    if actual is not None and (actual['argv'] != expected or actual['start_ticks'] != record['start_ticks']):
        raise RuntimeError('PID identity changed; no signal sent')
    return actual


def stop(kind, index):
    pf = pidfile(kind, index)
    if not pf.exists():
        return
    receipt = json.loads(read_limited(recordfile(kind, index)))
    if int(read_limited(pf, 32)) != receipt['pid']:
        raise RuntimeError('PID file and receipt differ; no signal sent')
    actual = verify_owned(kind, index, receipt)
    if actual is not None:
        os.kill(receipt['pid'], signal.SIGTERM)
        for _ in range(160):
            if verify_owned(kind, index, receipt) is None:
                break
            time.sleep(.05)
        else:
            verify_owned(kind, index, receipt)
            os.kill(receipt['pid'], signal.SIGKILL)
            for _ in range(60):
                if verify_owned(kind, index, receipt) is None:
                    break
                time.sleep(.05)
            else:
                raise RuntimeError('owned wrapper did not exit')
    atomic(RUN / ('stopped-' + kind + '-' + str(index) + '-' + uuid.uuid4().hex + '.json'),
           dict(receipt, stopped_at=now()))
    pf.unlink()


def request(index, role, path, body=None, authenticated=False, timeout=5):
    port = ports(index)[role]
    headers = {'Content-Type': 'application/json'}
    if authenticated:
        headers['Authorization'] = 'Bearer ' + benchmark_key()
    if not 0 < timeout <= 90:
        raise ValueError('HTTP deadline outside closed bounds')
    deadline = time.monotonic() + timeout
    connection = http.client.HTTPConnection('127.0.0.1', port, timeout=min(5, timeout))
    watchdog = None
    response = None
    try:
        connection.connect()
        sock = connection.sock
        def abort():
            # Shutdown the retained owned HTTP socket, even after HTTPResponse
            # detaches it from HTTPConnection under Connection: close.
            try:
                sock.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            sock.close()
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError('HTTP absolute deadline during connect')
        # Connect has a short independent bound; registered model hashing may
        # need the full remaining request budget before response headers arrive.
        sock.settimeout(remaining)
        watchdog = threading.Timer(remaining, abort)
        watchdog.daemon = True
        watchdog.start()
        connection.request('GET' if body is None else 'POST', path,
                           body=None if body is None else json.dumps(body).encode(), headers=headers)
        response = connection.getresponse()
        if response.status < 200 or response.status >= 300:
            raise RuntimeError('private HTTP request failed status ' + str(response.status))
        chunks = []
        total = 0
        while True:
            if time.monotonic() >= deadline:
                raise TimeoutError('HTTP absolute response deadline')
            chunk = response.read1(16384)
            if not chunk:
                break
            total += len(chunk)
            if total > 2 * 1024 * 1024:
                raise RuntimeError('HTTP observation exceeds byte bound')
            chunks.append(chunk)
        return response.status, json.loads(b''.join(chunks))
    finally:
        if watchdog is not None:
            watchdog.cancel()
        if response is not None:
            response.close()
        connection.close()


def wait_health(index, role, seconds=30):
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        try:
            code, health = request(index, role, '/health', timeout=min(5, end - time.monotonic()))
            if code == 200:
                return health
        except (OSError, ValueError):
            pass
        time.sleep(.1)
    raise RuntimeError('private wrapper health deadline')


def clean_environment(index):
    keep = {'PATH', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TZ', 'HOME', 'USER', 'LOGNAME', 'LD_LIBRARY_PATH'}
    result = {key: value for key, value in os.environ.items() if key in keep}
    result['A3S_POWER_HOME'] = str(paths(index, 1)['home'])
    return result


def spawn(kind, index, slots):
    if pidfile(kind, index).exists():
        raise RuntimeError('wrapper PID file already exists; inspect status first')
    expected = argv(kind, index, slots)
    log = RUN / (kind + '-worker-' + str(index) + '-' + uuid.uuid4().hex + '.log')
    with log.open('xb') as output:
        process = subprocess.Popen(expected, env=clean_environment(index), cwd='/code/Power',
                                   stdin=subprocess.DEVNULL, stdout=output, stderr=subprocess.STDOUT,
                                   start_new_session=True)
    # Record the child generation before any readiness operation can fail.
    end = time.monotonic() + 2
    while time.monotonic() < end:
        value = proc(process.pid)
        if value is not None and value['argv'] == expected:
            break
        if process.poll() is not None:
            raise RuntimeError('owned wrapper exited during exec')
        time.sleep(.01)
    else:
        raise RuntimeError('private wrapper exec identity deadline; inspect child log')
    receipt = {'kind': kind, 'index': index, 'slots': slots, 'pid': process.pid,
               'start_ticks': value['start_ticks'], 'argv': expected, 'created_at': now(), 'log': str(log)}
    atomic(recordfile(kind, index), receipt)
    immutable(pidfile(kind, index), str(process.pid) + '\n')
    verify_owned(kind, index, receipt)
    return receipt


def native_identity(index, slots, matrix):
    # Production native is observed, never owned. Obtain its PID from systemd.
    result = subprocess.run(['systemctl', 'show', 'prism-27b@' + str(index) + '.service',
                             '--property=MainPID', '--value'], capture_output=True, text=True,
                            timeout=5, check=True)
    pid = int(result.stdout.strip())
    value = matrix.process_identity(pid, ports(index)['native'])
    command = read_limited(Path('/proc') / str(pid) / 'cmdline').decode().rstrip('\0').split('\0')
    expected = ((('--port',), str(ports(index)['native'])), (('--host',), '127.0.0.1'),
                (('-m', '--model'), MODEL), (('--alias',), ALIAS),
                (('-c', '--ctx-size'), str(32768 * slots)), (('--parallel', '-np'), str(slots)),
                (('-fa', '--flash-attn'), 'on'), (('-t', '--threads'), '8'), (('--reasoning',), 'off'))
    if value['exe_sha256'] != RUNTIME_SHA or any(matrix.command_flag(command, aliases) != item for aliases, item in expected):
        raise RuntimeError('production native identity differs from selected profile')
    for flag in ('--metrics', '--slots', '--jinja', '--cache-prompt'):
        if command.count(flag) != 1:
            raise RuntimeError('required observed native flag is missing or ambiguous')
    # No environment values other than these explicit capability controls persist.
    env = read_limited(Path('/proc') / str(pid) / 'environ').split(b'\0')
    bindings = [item.split(b'=', 1)[1] for item in env if item.startswith(b'CUDA_VISIBLE_DEVICES=')]
    if bindings != [str(index).encode()]:
        raise RuntimeError('production native CUDA binding differs')
    if any(item.startswith((b'GGML_CUDA_DISABLE_GRAPHS=', b'GGML_CUDA_GRAPH_OPT=', b'GGML_CUDA_PTQ1_0_MMQ_MAX_BATCH=', b'LLAMA_ARG_SPEC_')) for item in env):
        raise RuntimeError('production CUDA controls differ from default profile')
    value['cuda_visible_devices'] = str(index)
    _, props = request(index, 'native', '/props')
    _, observed_slots = request(index, 'native', '/slots')
    if props.get('model_path') != MODEL or props.get('model_alias') != ALIAS or props.get('total_slots') != slots:
        raise RuntimeError('production native props differ')
    if not isinstance(observed_slots, list) or len(observed_slots) != slots:
        raise RuntimeError('production native slots are incomplete')
    for slot in observed_slots:
        if slot.get('n_ctx') != 32768 or slot.get('is_processing') is not False:
            raise RuntimeError('production native is occupied or per-slot context differs')
    return value, command


def render(indices, slots):
    if slots not in (1, 2):
        raise ValueError('selected slots must be 1 or 2')
    key = benchmark_key()
    corpus_bytes = read_limited(CORPUS, 2 * 1024 * 1024)
    if hashlib.sha256(corpus_bytes).hexdigest() != CORPUS_SHA:
        raise RuntimeError('fixed eight-card corpus differs')
    base = json.loads(read_limited(ROOT / 'candidate-v4-provenance.json'))
    q = load_module('eight_wrapper_qualification', QUALIFICATION)
    rendered = []
    for index in indices:
        value = paths(index, slots)
        redacted_power = power_config(index, slots, 'BENCHMARK_KEY_REDACTED')
        immutable(value['power_config'], power_config(index, slots, key))
        immutable(RUN / ('worker-' + str(index) + '-np' + str(slots) + '-redacted.acl'), redacted_power)
        immutable(value['gateway_config'], gateway_config(index, key))
        immutable(RUN / ('gateway-worker-' + str(index) + '-redacted.acl'), gateway_config(index, 'BENCHMARK_KEY_REDACTED'))
        provenance = dict(base)
        provenance.update(arm='candidate', gpu_indices=[index], slots=slots, context_per_sequence=32768,
                          binary_sha256=POWER_SHA, model_sha256=MODEL_SHA, runtime_sha256=RUNTIME_SHA,
                          corpus_sha256=CORPUS_SHA, profile='eight-replica-study',
                          cache_mode='production native cache-prompt enabled; deterministic four-case warmup; shared native must be quiesced for attribution',
                          admission={'active': slots, 'waiting_limit': 8, 'queue_timeout_ms': 1000},
                          config_redacted_sha256=hashlib.sha256(redacted_power.encode()).hexdigest(),
                          runtime_flags={'--host': '127.0.0.1', '--port': str(ports(index)['native']),
                                         '-m': MODEL, '-ngl': '99', '-c': str(slots * 32768), '-fa': 'on',
                                         '--reasoning': 'off', '--alias': ALIAS, '-t': '8', '--parallel': str(slots),
                                         '--jinja': True, '--cache-prompt': True, '--metrics': True, '--slots': True})
        # This is explicitly a template. Actual identities/provenance are created only by start.
        provenance.pop('observed_at_utc', None)
        template = RUN / ('worker-' + str(index) + '-np' + str(slots) + '-provenance.template.json')
        immutable(template, json.dumps(provenance, indent=2) + '\n')
        q.load_provenance(template, corpus_bytes)
        rendered.append({'gpu_index': index, 'ports': ports(index), 'slots': slots, 'home': str(value['home']),
                         'provenance_template': str(template), 'actual_identity_written': False})
    result = {'observed_at': now(), 'status': 'rendered-not-started', 'workers': rendered,
              'model_alias': ALIAS, 'corpus_sha256': CORPUS_SHA, 'model_hashed': False,
              'registered': False, 'process_started': False, 'production_mutated': False,
              'power_acl_parser_validation': 'deferred to real Power startup; no validate-config CLI exists',
              'gateway_acl_parser_validation': 'deferred to explicit start validate command'}
    atomic(RUN / ('render-np' + str(slots) + '-result.json'), result)
    return result


def register(index):
    manifest = paths(index, 1)['home'] / 'models/manifests/prism-27b.json'
    if not manifest.exists():
        code, _ = request(index, 'power', '/v1/models',
                          {'name': ALIAS, 'path': MODEL, 'format': 'gguf'}, authenticated=True, timeout=90)
        if code != 201:
            raise RuntimeError('private model registration did not return 201')
    value = json.loads(read_limited(manifest))
    if value.get('name') != ALIAS or value.get('path') != MODEL or value.get('sha256') != MODEL_SHA:
        raise RuntimeError('private registry identity differs')


def start(index, slots):
    matrix = load_module('eight_wrapper_matrix', MATRIX)
    render([index], slots)
    if digest(POWER) != POWER_SHA or digest(GATEWAY) != GW_SHA:
        raise RuntimeError('candidate wrapper artifact differs')
    native, command = native_identity(index, slots, matrix)
    for kind in KINDS:
        with socket.socket() as probe:
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            probe.bind(('127.0.0.1', ports(index)[kind]))
    validation = subprocess.run([str(GATEWAY), 'validate', '--config', str(paths(index, slots)['gateway_config'])],
                                capture_output=True, timeout=15)
    validation_text = (validation.stdout + validation.stderr).decode(errors='replace')
    validation_text = validation_text.replace('Bearer ' + benchmark_key(), 'Bearer BENCHMARK_KEY_REDACTED').replace(benchmark_key(), 'BENCHMARK_KEY_REDACTED')
    immutable(RUN / ('gateway-worker-' + str(index) + '-validation-' + uuid.uuid4().hex + '.log'),
              validation_text[:65536])
    if validation.returncode:
        raise RuntimeError('private Gateway ACL validation failed')
    try:
        spawn('power', index, slots)
        wait_health(index, 'power')
        register(index)  # Server computes integrity SHA; never bypass the guard.
        spawn('gateway', index, slots)
        wait_health(index, 'gateway')
        identity = {'native': native}
        for kind in KINDS:
            receipt = json.loads(read_limited(recordfile(kind, index)))
            verify_owned(kind, index, receipt)
            identity[kind] = matrix.process_identity(receipt['pid'], ports(index)[kind])
        native_after, _ = native_identity(index, slots, matrix)
        if native != native_after:
            raise RuntimeError('native identity changed during private setup')
        template = RUN / ('worker-' + str(index) + '-np' + str(slots) + '-provenance.template.json')
        provenance = json.loads(read_limited(template))
        flags = {}
        # Persist only the qualification closed list of noncredential runtime flags.
        q = load_module('eight_wrapper_q_actual', QUALIFICATION)
        for position, token in enumerate(command[1:], 1):
            if token in q.RUNTIME_FLAG_NAMES:
                flags[token] = command[position + 1] if position + 1 < len(command) and not command[position + 1].startswith('-') else True
        provenance['runtime_flags'] = flags
        provenance['observed_at_utc'] = now()
        actual_path = RUN / ('worker-' + str(index) + '-provenance.json')
        atomic(actual_path, provenance)
        q.load_provenance(actual_path, CORPUS.read_bytes())
        atomic(RUN / ('worker-' + str(index) + '-identity.json'), identity)
        atomic(RUN / ('worker-' + str(index) + '-readiness.json'),
               {'observed_at': now(), 'status': 'healthy-idle', 'slots': slots, 'identity': identity,
                'private_home': str(paths(index, slots)['home']), 'production_native_observed_only': True})
    except BaseException:
        for kind in reversed(KINDS):
            stop(kind, index)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=('render', 'start', 'status', 'stop'))
    parser.add_argument('--gpu', type=int, choices=range(8), nargs='+')
    parser.add_argument('--slots', type=int, choices=(1, 2), default=1)
    args = parser.parse_args()
    indices = selected(args.gpu)
    RUN.mkdir(mode=0o700, parents=True, exist_ok=True)
    if RUN.is_symlink():
        raise RuntimeError('private root must not be a symlink')
    RUN.chmod(0o700)
    with (RUN / 'supervisor.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if args.command == 'render':
            result = render(indices, args.slots)
        elif args.command == 'start':
            for index in indices:
                start(index, args.slots)
            result = {'status': 'started', 'workers': indices}
        elif args.command == 'stop':
            for index in indices:
                for kind in reversed(KINDS):
                    stop(kind, index)
            result = {'status': 'stopped-owned-wrappers-only', 'workers': indices}
        else:
            result = {'workers': []}
            for index in indices:
                row = {'gpu_index': index, 'ports': ports(index)}
                for kind in KINDS:
                    pf = pidfile(kind, index)
                    row[kind] = 'not-owned' if not pf.exists() else ('alive' if verify_owned(kind, index, json.loads(read_limited(recordfile(kind, index)))) else 'exited')
                result['workers'].append(row)
        print(json.dumps(result))


if __name__ == '__main__':
    main()
