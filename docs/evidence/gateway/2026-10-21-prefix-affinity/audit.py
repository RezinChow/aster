"""Read-only deployed-generation audit and retirement of owned loopback canaries."""
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import time

BASE = Path('/code/aster/target/workbuddy-prefix-affinity')
expected = '1fc30e114c47bd23a52053ccc51bc92c64789854b4dce4db4f0ddff4f84241a4'
canaries = json.loads((BASE / 'canaries.json').read_text())
deployment = json.loads((BASE / 'deployment.json').read_text())
assert deployment['passed'] and not deployment['rolled_back']
retired = []
for process in canaries['processes']:
    proc = Path('/proc') / str(process['pid'])
    executable = proc / 'exe'
    if executable.exists():
        assert hashlib.sha256(executable.read_bytes()).hexdigest() == expected
        arguments = (proc / 'cmdline').read_bytes().split(b'\0')
        assert os.fsencode(process['config']) in arguments
        assert Path(process['config']).parent == BASE
        os.kill(process['pid'], signal.SIGTERM)
    for _ in range(100):
        if not executable.exists():
            break
        time.sleep(0.1)
    assert not executable.exists()
    retired.append({'name': process['name'], 'pid': process['pid'], 'retired': True})

gateway_pid = int(subprocess.check_output(['systemctl', 'show', 'a3s-gateway', '-p', 'MainPID', '--value']))
env = {os.fsdecode(k): os.fsdecode(v) for part in Path(f'/proc/{gateway_pid}/environ').read_bytes().split(b'\0')
       if b'=' in part for k, v in [part.split(b'=', 1)]}
binary = Path(f'/proc/{gateway_pid}/exe')
assert hashlib.sha256(binary.read_bytes()).hexdigest() == expected
parsed = subprocess.run([str(binary), 'config', '--config', '/etc/a3s/gateway-prism.acl', 'json'],
                        env=env, capture_output=True, check=True)
config = json.loads(parsed.stdout)
catalogs = [r['console_catalog'] for r in config['inference']['routes'].values() if r.get('console_catalog')]
assert len(catalogs) == 1 and catalogs[0]['prefix_affinity']
assert subprocess.check_output(['systemctl', 'is-active', 'a3s-gateway'], text=True).strip() == 'active'
assert subprocess.check_output(['systemctl', 'is-enabled', 'a3s-gateway'], text=True).strip() == 'enabled'
assert (Path('/etc/systemd/system/a3s-gateway.service.d') / '95-prefix-affinity-20261021.conf').is_file()
assert hashlib.sha256(Path('/etc/a3s/gateway-prism.acl').read_bytes()).hexdigest() == deployment['config_after_sha256']

# Retained source layers must not contain any actual process credential value.
for path in [BASE / 'pre-existing-source.patch', BASE / 'source-v3.patch']:
    content = path.read_bytes()
    for name, value in env.items():
        if any(part in name for part in ['TOKEN', 'PASSWORD', 'SECRET', 'API_KEY']) and len(value) >= 16:
            assert value.encode() not in content, 'credential material in source evidence'

source_members = {}
patch = (BASE / 'source-v3.patch').read_text()
for line in patch.splitlines():
    if line.startswith('+++ b/'):
        relative = line[len('+++ b/'):]
        path = (Path('/code/aster') / relative).resolve()
        assert path.is_relative_to(Path('/code/aster')) and path.is_file()
        source_members[relative] = hashlib.sha256(path.read_bytes()).hexdigest()
subprocess.run(['git', 'apply', '-R', '--check', str(BASE / 'source-v3.patch')], cwd='/code/aster', check=True)
record = {'gateway_pid': gateway_pid, 'binary_sha256': expected, 'active': True, 'enabled': True,
          'prefix_affinity': True, 'canaries': retired, 'source_members': source_members,
          'source_base': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd='/code/aster', text=True).strip(),
          'source_patch_sha256': hashlib.sha256((BASE / 'source-v3.patch').read_bytes()).hexdigest(),
          'pre_existing_patch_sha256': hashlib.sha256((BASE / 'pre-existing-source.patch').read_bytes()).hexdigest(),
          'credential_scan_passed': True, 'passed': True}
(BASE / 'final-audit.json').write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps(record), flush=True)
