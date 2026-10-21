"""Launch isolated loopback control/affinity Gateways; keep credentials in memory."""
import hashlib
import http.client
import json
import os
from pathlib import Path
import shutil
import subprocess
import time

BASE = Path('/code/aster/target/workbuddy-prefix-affinity')
assert BASE.is_dir()
assert not (BASE / 'canaries.json').exists(), 'preserve earlier qualification'
pid = int(subprocess.check_output(['systemctl', 'show', 'a3s-gateway', '-p', 'MainPID', '--value']))
environment = {os.fsdecode(k): os.fsdecode(v) for part in Path(f'/proc/{pid}/environ').read_bytes().split(b'\0')
               if b'=' in part for k, v in [part.split(b'=', 1)]}
key = environment['A3S_GATEWAY_SHARED_TOKEN']
source = Path('/etc/a3s/gateway-prism.acl').read_text()
assert source.count('"0.0.0.0:8080"') == 1
assert source.count('enabled        = true') == 1
assert source.count('console_catalog "published" {') == 1
assert 'prefix_affinity' not in source
binary = Path('/code/aster/target/release/a3s-gateway')
digest = hashlib.sha256(binary.read_bytes()).hexdigest()
release = BASE / 'releases' / digest / 'a3s-gateway'
release.parent.mkdir(parents=True, exist_ok=True)
if not release.exists():
    shutil.copy2(binary, release)
assert hashlib.sha256(release.read_bytes()).hexdigest() == digest
record = {'binary_sha256': digest, 'loopback_only': True, 'processes': []}
children = []
try:
    for name, port, enabled in [('control', 18091, False), ('affinity', 18090, True)]:
        config = source.replace('"0.0.0.0:8080"', f'"127.0.0.1:{port}"')
        config = config.replace('enabled        = true', 'enabled        = false')
        config = config.replace('console_catalog "published" {',
                                'console_catalog "published" {\n      prefix_affinity = ' + str(enabled).lower())
        path = BASE / f'{name}.acl'
        path.write_text(config)
        os.chmod(path, 0o600)
        result = subprocess.run([str(release), 'config', '--config', str(path), 'json'],
                                env=environment, capture_output=True, check=True)
        parsed = json.loads(result.stdout)
        assert parsed['managed'].get('state_file') is None and parsed['managed'].get('usage_spool') is None
        assert len(parsed['entrypoints']) == 1
        assert not parsed['management']['enabled']
        with (BASE / f'{name}.log').open('wb') as log:
            child = subprocess.Popen([str(release), '--config', str(path)], env=environment,
                                     stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT,
                                     start_new_session=True)
        children.append(child)
        ready = False
        for _ in range(100):
            assert child.poll() is None, 'canary stopped before readiness'
            try:
                transport = http.client.HTTPConnection('127.0.0.1', port, timeout=1)
                transport.request('GET', '/v1/models', headers={'Authorization': 'Bearer ' + key})
                response = transport.getresponse()
                payload = response.read(1048577)
                transport.close()
                assert len(payload) <= 1048576
                if response.status == 200 and b'prism-27b' in payload:
                    ready = True
                    break
            except (ConnectionError, OSError, TimeoutError):
                pass
            time.sleep(0.2)
        assert ready, 'catalog readiness deadline exceeded'
        record['processes'].append({'name': name, 'port': port, 'pid': child.pid,
                                    'config': str(path), 'prefix_affinity': enabled,
                                    'config_sha256': hashlib.sha256(config.encode()).hexdigest()})
        print(json.dumps({'name': name, 'ready': True, 'pid': child.pid}), flush=True)
    (BASE / 'canaries.json').write_text(json.dumps(record, indent=2) + '\n')
    print(json.dumps(record), flush=True)
except BaseException:
    for child in children:
        child.terminate()
    raise
