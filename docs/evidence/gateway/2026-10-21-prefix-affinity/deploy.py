"""Install the qualified Gateway, wait for idle, preserve rollback and audit hashes."""
import hashlib
import http.client
import json
import os
from pathlib import Path
import shutil
import subprocess
import time

assert os.geteuid() == 0
BASE = Path('/code/aster/target/workbuddy-prefix-affinity')
SHA = '1fc30e114c47bd23a52053ccc51bc92c64789854b4dce4db4f0ddff4f84241a4'
OLD_SHA = 'eaf9f4ca8baf38074d1548badebbd3b42bd08ab5174e2f9136101ccbcfb6c1fd'
POWER_SHA = '231f7db4041a74dedda22935cff7f94149b7b0102c3199a451ff42619e11020c'
PATCH_SHA = 'c116c8d41c7964712dfb94bd8b441f98f51c0159e431abafe0a196365f1e6837'
source_path = Path('/etc/a3s/gateway-prism.acl')
override = Path('/etc/systemd/system/a3s-gateway.service.d/95-prefix-affinity-20261021.conf')
assert not override.exists() and not (BASE / 'deployment.json').exists()


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def service_pid(service):
    return int(subprocess.check_output(['systemctl', 'show', service, '-p', 'MainPID', '--value']))


def generation():
    gateway_pid = service_pid('a3s-gateway')
    return {'gateway_pid': gateway_pid, 'gateway_sha256': sha(f'/proc/{gateway_pid}/exe'),
            'power': [{'index': i, 'pid': service_pid(f'a3s-power@{i}'),
                       'sha256': sha(f'/proc/{service_pid(f"a3s-power@{i}")}/exe')} for i in range(8)],
            'native_pids': [service_pid(f'prism-27b@{i}') for i in range(8)]}


before = generation()
assert before['gateway_sha256'] == OLD_SHA
assert all(item['sha256'] == POWER_SHA for item in before['power'])
env = {os.fsdecode(k): os.fsdecode(v) for part in Path(f'/proc/{before["gateway_pid"]}/environ').read_bytes().split(b'\0')
       if b'=' in part for k, v in [part.split(b'=', 1)]}
key = env['A3S_GATEWAY_SHARED_TOKEN']
benchmark = json.loads((BASE / 'canary-benchmark.json').read_text())
canaries = json.loads((BASE / 'canaries.json').read_text())
assert benchmark['passed'] and canaries['binary_sha256'] == SHA
assert sha(BASE / 'source-v3.patch') == PATCH_SHA
binary = BASE / 'releases' / SHA / 'a3s-gateway'
assert sha(binary) == SHA
original = source_path.read_bytes()
source = original.decode()
assert source.count('console_catalog "published" {') == 1 and 'prefix_affinity' not in source
# Bind the production input to the exact source used by the canary.
control = source.replace('"0.0.0.0:8080"', '"127.0.0.1:18091"').replace('enabled        = true', 'enabled        = false')
control = control.replace('console_catalog "published" {', 'console_catalog "published" {\n      prefix_affinity = false')
assert hashlib.sha256(control.encode()).hexdigest() == canaries['processes'][0]['config_sha256']
candidate = source.replace('console_catalog "published" {', 'console_catalog "published" {\n      prefix_affinity = true').encode()
candidate_path = source_path.with_name('gateway-prism.prefix-affinity-20261021.acl')
assert not candidate_path.exists() or candidate_path.read_bytes() == candidate
candidate_path.write_bytes(candidate)
stat = source_path.stat()
os.chmod(candidate_path, stat.st_mode & 0o777)
os.chown(candidate_path, stat.st_uid, stat.st_gid)
validated = subprocess.run([str(binary), 'config', '--config', str(candidate_path), 'json'],
                           env=env, capture_output=True, check=True)
parsed = json.loads(validated.stdout)
assert parsed['management']['enabled'] and parsed['management']['address'] == '127.0.0.1:9090'
catalogs = [route['console_catalog'] for route in parsed['inference']['routes'].values() if route.get('console_catalog')]
assert len(catalogs) == 1 and catalogs[0]['prefix_affinity']
release = Path('/opt/a3s/releases') / SHA / 'a3s-gateway'
release.parent.mkdir(parents=True, exist_ok=True)
if not release.exists():
    shutil.copy2(binary, release)
os.chmod(release, 0o755)
assert sha(release) == SHA
backup = Path('/etc/a3s/backups/20261021-prefix-affinity/gateway-prism.acl')
assert not backup.exists() or backup.read_bytes() == original
if not backup.exists():
    backup.parent.mkdir(parents=True, mode=0o700)
    backup.write_bytes(original)
os.chmod(backup, 0o600)


def request_http(port, path, body=None, admin=False):
    conn = http.client.HTTPConnection('127.0.0.1', port, timeout=8)
    try:
        headers = {'Authorization': 'Bearer ' + (env['A3S_GATEWAY_ADMIN_TOKEN'] if admin else key)}
        if body is not None:
            headers['Content-Type'] = 'application/json'
        conn.request('POST' if body is not None else 'GET', path,
                     json.dumps(body) if body is not None else None, headers)
        response = conn.getresponse()
        raw = response.read(2097153)
        assert len(raw) <= 2097152
        return response.status, raw
    finally:
        conn.close()


for attempt in range(360):
    status, raw = request_http(9090, '/api/gateway/metrics', admin=True)
    assert status == 200
    active = [int(line.rsplit(' ', 1)[1]) for line in raw.decode().splitlines()
              if line.startswith('gateway_service_active_requests{')]
    assert active, 'cannot establish an idle Gateway from missing observations'
    if sum(active) == 0:
        break
    if attempt % 40 == 0:
        print(json.dumps({'waiting_for_idle': True, 'active_requests': sum(active)}), flush=True)
    time.sleep(0.25)
else:
    raise RuntimeError('no idle deployment window observed')
assert generation()['gateway_pid'] == before['gateway_pid'] and source_path.read_bytes() == original
record = {'before': before, 'source_patch_sha256': PATCH_SHA, 'binary_sha256': SHA,
          'config_before_sha256': hashlib.sha256(original).hexdigest(),
          'config_after_sha256': hashlib.sha256(candidate).hexdigest(),
          'backup': str(backup), 'override': str(override), 'idle_requests_before_restart': sum(active),
          'passed': False, 'rolled_back': False}
try:
    override.write_text('[Service]\nExecStart=\nExecStart=' + str(release) + ' --config /etc/a3s/gateway-prism.acl\n')
    subprocess.run(['systemctl', 'daemon-reload'], check=True, timeout=30)
    candidate_path.replace(source_path)
    started = time.monotonic()
    subprocess.run(['systemctl', 'restart', 'a3s-gateway'], check=True, timeout=105)
    for _ in range(100):
        try:
            status, raw = request_http(8080, '/v1/models')
            if status == 200 and b'prism-27b' in raw:
                break
        except (OSError, ConnectionError, TimeoutError):
            pass
        time.sleep(0.2)
    else:
        raise RuntimeError('production catalog readiness deadline exceeded')
    record['restart_to_catalog_seconds'] = round(time.monotonic() - started, 3)
    message = {'role': 'user', 'content': 'Reply with exactly OK.', 'agent': {'name': 'synthetic-workbuddy'},
               'conversationRequestId': 'synthetic-deploy', 'startsNewUserRequest': False,
               'messageId': 'synthetic', 'model': 'client-label', 'requestModelId': 'synthetic',
               'requestModelName': 'client-label', 'stepSeq': 1, 'traceId': 'synthetic',
               'argumentsDisplayText': 'CLIENT_DISPLAY_OVERRIDE', 'rawUsage': {'totalTokens': 999999},
               'usage': {'totalTokens': 999999}}
    status, raw = request_http(8080, '/v1/chat/completions', {'model': 'prism-27b', 'messages': [message],
                                                   'temperature': 0, 'max_tokens': 16, 'stream': False})
    assert status == 200 and b'CLIENT_DISPLAY_OVERRIDE' not in raw and b'999999' not in raw
    value = json.loads(raw)
    value = value.get('data', value)
    assert value['choices'][0]['message']['content'].strip() == 'OK'
    after = generation()
    assert after['gateway_sha256'] == SHA
    assert after['power'] == before['power'] and after['native_pids'] == before['native_pids']
    record.update(after=after, passed=True, probe_usage=value['usage'])
except BaseException as error:
    source_path.write_bytes(original)
    os.chmod(source_path, stat.st_mode & 0o777)
    os.chown(source_path, stat.st_uid, stat.st_gid)
    override.unlink(missing_ok=True)
    subprocess.run(['systemctl', 'daemon-reload'], check=True, timeout=30)
    subprocess.run(['systemctl', 'restart', 'a3s-gateway'], check=True, timeout=105)
    record.update(rolled_back=True, failure_type=type(error).__name__, rollback=generation())
    raise
finally:
    (BASE / 'deployment.json').write_text(json.dumps(record, indent=2) + '\n')
    print(json.dumps(record), flush=True)
