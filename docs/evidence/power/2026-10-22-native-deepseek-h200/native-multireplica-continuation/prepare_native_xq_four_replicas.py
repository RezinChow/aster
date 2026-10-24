"""Launch the frozen full-model diagnostic once in the owned validated Replica."""
import base64
import hashlib
import json
from pathlib import Path
import shlex
import shutil
import subprocess
import time

BASE=Path('D:/code/aster/target/h200-native');WORK=Path('D:/code/aster/.wt-h200-native-deploy')
record_path=BASE/'native-xq-four-replicas-staging.json'
if record_path.exists():raise RuntimeError('full-model intent exists; inspect its exact process and result')
buildroot=BASE/'aster-native-linux-cuda-1792753576/xq-v18'
build=json.loads((buildroot/'xq-build-result.json').read_text())
if build['phase']!='built' or build['build_exit_code']!=0 or 'native_runner' not in build:
    raise RuntimeError('full-model native runner is not built')
artifact=build['native_runner']
if artifact['binary_sha256']!='a4db74e456206f0774e5573b9f32d53c654e6e46322788f53ed7a9cb9f624291':
    raise RuntimeError('native runner differs from the reviewed build')
intent=json.loads((BASE/'native-h200-deployment-lease-pending.json').read_text())
payload=json.loads((BASE/'native-xq-payload-preparation.json').read_text())
worker_digest=hashlib.sha256((WORK/'scripts/h200_native/replica_probe.py').read_bytes()).hexdigest()
name='native-xq-four-replicas-a4db74e45620-'+worker_digest[:12];local=BASE/name;local.mkdir(mode=0o700)
remote='/mnt/shared-storage-user/yangchao/Workspace/aster-h200-xq/'+name
shutil.copyfile(buildroot/'run-xq-native.gz',local/'run-xq-native.gz')
shutil.copyfile(WORK/'scripts/h200_native/replica_probe.py',local/'worker.py')
inputs=dict(schema='aster-native-xq-four-replica-inputs-v1',worker_sha256=hashlib.sha256((local/'worker.py').read_bytes()).hexdigest(),native_runner=artifact,source_archive_sha256=build['source_archive_sha256'],resource_proof=intent['remote']+'/resource-result.json',payload_root=payload['remote'],official_blob_root='/mnt/shared-storage-gpfs2/gpfs2-shared-public/huggingface/hub/models--deepseek-ai--DeepSeek-V4.1-Flash-1017/blobs',single_probe='/mnt/shared-storage-user/yangchao/Workspace/aster-h200-xq/native-xq-full-deploy-a4db74e45620/probe-result.json')
(local/'replica-inputs.json').write_text(json.dumps(inputs,indent=2)+'\n')
record=dict(schema='aster-native-xq-four-replica-staging-v1',unix=time.time(),phase='prepared',remote=remote,allocation_job=intent['submitted']['rjob'],allocation_uid=intent['submitted']['uid'],replica='aster-native-xq-deploy-055d38ff2b70-23451623-cfcd2',replica_uid='0ff7b42d-bae6-49c6-b7ee-8d1dc0da8545',files=[dict(file=path.name,bytes=path.stat().st_size,sha256=hashlib.sha256(path.read_bytes()).hexdigest()) for path in sorted(local.iterdir())])
def save():record_path.write_text(json.dumps(record,indent=2)+'\n')
save()
ssh=['ssh','-C','-o','BatchMode=yes','-o','ConnectTimeout=15','-o','HostName=10.102.254.2','-o','HostKeyAlias=h.pjlab.org.cn','yangchao-dev.yangchao.ailab-hrprdduanyan.ws@h.pjlab.org.cn']
def remote_python(code):
    wrapper='python3 -c '+shlex.quote('import base64;exec(base64.b64decode('+repr(base64.b64encode(code.encode()).decode())+'))')
    result=subprocess.run(ssh+[wrapper],capture_output=True,text=True,timeout=65)
    if result.returncode:raise RuntimeError('full-model launch needs inspection: '+result.stderr[-5000:])
    return json.loads(result.stdout)
remote_python("from pathlib import Path;import os,json;p=Path("+repr(remote)+");assert os.getuid()==10250 and p.parent.resolve()==p.parent and p.parent.stat().st_uid==10250;p.mkdir(mode=0o700);print(json.dumps(dict(created=True)))")
record['phase']='stage_created';save()
with (local/'upload.log').open('wb') as log:
    result=subprocess.run(['scp','-C']+ssh[2:-1]+[str(local/value['file']) for value in record['files']]+[ssh[-1]+':'+remote+'/'],stdout=log,stderr=log,timeout=180)
if result.returncode:raise RuntimeError('full-model archive transfer failed; inspect same intent')
verify='''from pathlib import Path
import os,json,hashlib
record=RECORD;root=Path(record['remote'])
if root.resolve()!=root or root.stat().st_uid!=10250 or os.getuid()!=10250:raise RuntimeError('full-model stage owner changed')
for value in record['files']:
 p=root/value['file']
 if p.is_symlink() or not p.is_file() or p.stat().st_size!=value['bytes'] or hashlib.sha256(p.read_bytes()).hexdigest()!=value['sha256']:raise RuntimeError('full-model staged input identity changed')
 p.chmod(0o600)
print(json.dumps(dict(verified=True)))
'''.replace('RECORD',repr(record))
record['verification']=remote_python(verify);record['phase']='verified';save()

print(json.dumps(record,indent=2))
