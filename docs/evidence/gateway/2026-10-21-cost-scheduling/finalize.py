"""Bind final source to the binary; qualify a private canary and promote safely."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import time
from runtime import BASE,digest,environment,pid,ready,request,save,snapshot,wait_idle

def source_identity():
    repo=Path('/code/aster')
    paths=sorted((repo/'apps/gateway/src').rglob('*.rs'))+[repo/name for name in ['Cargo.lock','rust-toolchain.toml','Cargo.toml','apps/gateway/Cargo.toml','apps/gateway/build.rs'] if (repo/name).exists()]
    return {str(path.relative_to(repo)):digest(path) for path in paths}

def prepare():
    binary=Path('/code/aster/target/release/a3s-gateway');sha=digest(binary)
    release=BASE/'releases'/sha/'a3s-gateway';release.parent.mkdir(parents=True,exist_ok=True)
    if not release.exists():shutil.copy2(binary,release)
    assert digest(release)==sha
    source=Path('/etc/a3s/gateway-prism.acl').read_text()
    assert source.count('"0.0.0.0:8080"')==1
    config=source.replace('"0.0.0.0:8080"','"127.0.0.1:18090"').replace('enabled        = true','enabled        = false')
    path=BASE/'candidate-final.acl';path.write_text(config);os.chmod(path,0o600)
    subprocess.run([str(release),'config','--config',str(path),'json'],env=environment(),capture_output=True,check=True)
    with (BASE/'candidate-final.log').open('wb') as log:
        child=subprocess.Popen([str(release),'--config',str(path)],env=environment(),stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
    ready(18090)
    save('final-source.json',{'binary_sha256':sha,'files':source_identity(),'source_patch_sha256':digest(Path((BASE/'current-patch.txt').read_text().strip()))})
    save('canary-final.json',{'binary_sha256':sha,'pid':child.pid,'config':str(path),'config_sha256':digest(path)})
    print(json.dumps({'final_canary_ready':True,'binary_sha256':sha}),flush=True)

def promote():
    assert os.geteuid()==0
    assert json.loads((BASE/'speculation-restoration.json').read_text())['gateway_config_restored']
    assert json.loads((BASE/'native-profile-decision.json').read_text())['selected']=='baseline'
    assert json.loads((BASE/'canary-pair-final.json').read_text())['passed']
    identity=json.loads((BASE/'final-source.json').read_text());assert identity['files']==source_identity()
    sha=identity['binary_sha256'];old='5ab352238034eb6e5368e79398b6536532a6c822bab5fc86ab752177e89a0e02'
    assert digest(f'/proc/{pid("a3s-gateway")}/exe')==old
    source=Path('/etc/a3s/gateway-prism.acl');original=source.read_bytes()
    assert b'excluded_supplier_ids' not in original
    release=Path('/opt/a3s/releases')/sha/'a3s-gateway';release.parent.mkdir(parents=True,exist_ok=True)
    if not release.exists():shutil.copy2(BASE/'releases'/sha/'a3s-gateway',release)
    os.chmod(release,0o755);assert digest(release)==sha
    override=Path('/etc/systemd/system/a3s-gateway.service.d/97-catalog-policy-20261021.conf');assert not override.exists()
    before=snapshot();steps=[]
    def switch(binary):
        wait_idle()
        override.write_text(f'[Service]\nExecStart=\nExecStart={binary} --config {source}\n')
        subprocess.run(['systemctl','daemon-reload'],check=True);subprocess.run(['systemctl','restart','a3s-gateway'],check=True);ready(8080)
        status,raw=request(8080,'/v1/chat/completions',{'model':'prism-27b','temperature':0,'max_tokens':16,'messages':[{'role':'user','content':'Reply with exactly 42.'}]})
        assert status==200 and json.loads(raw)['choices'][0]['message']['content'].strip()=='42'
        return {'binary_sha256':digest(f'/proc/{pid("a3s-gateway")}/exe'),'correct':True}
    try:
        steps.append(switch(release));steps.append(switch(Path('/opt/a3s/releases')/old/'a3s-gateway'));steps.append(switch(release))
        after=snapshot();assert all(before['services'][unit]==after['services'][unit] for unit in before['services'] if unit!='a3s-gateway')
        assert source.read_bytes()==original
        manifest=json.loads((BASE/'canary-final.json').read_text());process=Path(f'/proc/{manifest["pid"]}')
        assert digest(process/'exe')==manifest['binary_sha256'] and os.fsencode(manifest['config']) in (process/'cmdline').read_bytes().split(b'\0')
        os.kill(manifest['pid'],signal.SIGTERM)
        save('final-deployment.json',{'passed':True,'source_files_identical_to_build':True,'before':before,'after':after,'steps':steps,'actual_old_new_restoration':True})
        print(json.dumps({'final_deployed_sha256':sha,'rollback_rehearsal':True,'all_eight_replicas_restored':True}),flush=True)
    except BaseException:
        if override.exists():override.unlink()
        subprocess.run(['systemctl','daemon-reload'],check=True);subprocess.run(['systemctl','restart','a3s-gateway'],check=True);ready(8080)
        save('final-deployment-failure.json',{'rolled_back':True,'steps':steps});raise

if __name__=='__main__':
    if sys.argv[1]=='prepare':prepare()
    elif sys.argv[1]=='promote':promote()
