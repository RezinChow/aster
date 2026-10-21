"""Qualified Gateway deployment with an actual old/new restoration rehearsal."""
import json
import os
from pathlib import Path
import shutil
import subprocess
from runtime import BASE, OLD_SHA, digest, environment, pid, ready, request, save, snapshot, wait_idle

assert os.geteuid()==0
assert json.loads((BASE/'canary-pair-v4.json').read_text())['passed']
assert json.loads((BASE/'ordinary-load.json').read_text())['passed']
assert json.loads((BASE/'ordinary-load-summary.json').read_text())['all_within_ten_percent']
manifest=json.loads((BASE/'canaries-v4.json').read_text())
sha=manifest['candidate_sha256']
before=snapshot()
assert before['services']['a3s-gateway']['binary_sha256']==OLD_SHA
source=Path('/etc/a3s/gateway-prism.acl')
original=source.read_bytes()
assert b'prefix_parallelism' not in original
candidate=original.replace(b'prefix_affinity = true',b'prefix_affinity = true\n      prefix_parallelism = 2')
assert candidate!=original
release=Path('/opt/a3s/releases')/sha/'a3s-gateway'
release.parent.mkdir(parents=True,exist_ok=True)
if not release.exists(): shutil.copy2(BASE/'releases'/sha/'a3s-gateway',release)
assert digest(release)==sha
os.chmod(release,0o755)
backup=Path('/etc/a3s/backups/20261021-cost-scheduling/gateway-prism.acl')
backup.parent.mkdir(parents=True,mode=0o700,exist_ok=True)
assert not backup.exists() or backup.read_bytes()==original
backup.write_bytes(original);os.chmod(backup,0o600)
override=Path('/etc/systemd/system/a3s-gateway.service.d/96-cost-scheduling-20261021.conf')
assert not override.exists()
candidate_path=source.with_name('gateway-prism.cost-scheduling-20261021.acl')
candidate_path.write_bytes(candidate);os.chmod(candidate_path,source.stat().st_mode&0o777)
validated=subprocess.run([str(release),'config','--config',str(candidate_path),'json'],env=environment(),capture_output=True,check=True)
parsed=json.loads(validated.stdout)
assert all(route['console_catalog']['prefix_parallelism']==2 for route in parsed['inference']['routes'].values() if route.get('console_catalog'))

def switch(binary,data):
    wait_idle()
    temporary=source.with_name('gateway-prism.cost-switch.acl')
    temporary.write_bytes(data);os.chmod(temporary,source.stat().st_mode&0o777)
    os.replace(temporary,source)
    override.write_text(f'[Service]\nExecStart=\nExecStart={binary} --config {source}\n')
    subprocess.run(['systemctl','daemon-reload'],check=True)
    subprocess.run(['systemctl','restart','a3s-gateway'],check=True)
    ready(8080)
    status,raw=request(8080,'/v1/chat/completions',{'model':'prism-27b','temperature':0,'max_tokens':16,'messages':[{'role':'user','content':'Reply with exactly 42.'}]})
    assert status==200 and json.loads(raw)['choices'][0]['message']['content'].strip()=='42'
    return {'binary_sha256':digest(f'/proc/{pid("a3s-gateway")}/exe'),'correct':True,'config_sha256':digest(source)}

steps=[]
try:
    steps.append(switch(release,candidate))
    steps.append(switch(Path('/opt/a3s/releases')/OLD_SHA/'a3s-gateway',original))
    assert steps[-1]['binary_sha256']==OLD_SHA
    steps.append(switch(release,candidate))
    after=snapshot()
    assert all(before['services'][unit]==after['services'][unit] for unit in before['services'] if unit!='a3s-gateway')
    assert steps[-1]['binary_sha256']==sha
    save('deployment.json',{'passed':True,'old_new_old_new_rehearsal':True,'before':before,'after':after,'steps':steps})
    print(json.dumps({'deployed_sha256':sha,'rollback_rehearsal':True,'power_native_unchanged':True}),flush=True)
except BaseException:
    source.write_bytes(original)
    if override.exists(): override.unlink()
    subprocess.run(['systemctl','daemon-reload'],check=True)
    subprocess.run(['systemctl','restart','a3s-gateway'],check=True)
    ready(8080)
    save('deployment-failure.json',{'rolled_back':True,'steps':steps})
    raise
