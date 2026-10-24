"""Require real CUDA numerical controls before testing the rebuilt engine."""
import json
from xolotl_trial_common import BASE,owned
v=json.loads((BASE/'xolotl-current-build-latest.json').read_text());build=v['build-result.json']
if build['phase']!='built':raise RuntimeError('current build has not completed')
record=BASE/'xolotl-current-build-hardware-controls.json'
if record.exists():raise RuntimeError('control receipt exists; inspect it instead')
code='''import hashlib,json,subprocess,os,time
from pathlib import Path
build=@BUILD@
active=subprocess.run(['nvidia-smi','--query-compute-apps=pid,gpu_uuid','--format=csv,noheader,nounits'],capture_output=True,text=True,timeout=8,check=True)
if active.stdout.strip():raise RuntimeError('other trial still uses the GPU')
env={k:v for k,v in os.environ.items() if not k.startswith('STRATA_')};env.update(CUDA_VISIBLE_DEVICES='0',GGML_NO_BACKTRACE='1')
out=dict(unix=time.time(),device='CUDA_VISIBLE_DEVICES=0',tests=[])
for name in ['test_ds41_fq','test_ds41_hcmix']:
 meta=build['binaries'][name];p=Path(meta['path'])
 if p.stat().st_size!=meta['bytes'] or hashlib.sha256(p.read_bytes()).hexdigest()!=meta['sha256']:raise RuntimeError('control executable changed')
 result=subprocess.run([str(p),'--cuda'],env=env,capture_output=True,text=True,timeout=20)
 if len(result.stdout)>32768 or len(result.stderr)>32768:raise RuntimeError('control output bound exceeded')
 passed=result.returncode==0 and 'fused == composite, bit for bit' in result.stdout and any(s.startswith('cuda ') for s in result.stdout.splitlines()) and not any(s.startswith('cpu ') for s in result.stdout.splitlines())
 out['tests'].append(dict(name=name,exit=result.returncode,passed=passed,stdout=result.stdout,stderr=result.stderr))
 if not passed:break
out['passed']=len(out['tests'])==2 and all(t['passed'] for t in out['tests'])
print(json.dumps(out))
'''.replace('@BUILD@',repr(build))
o=owned(code)
record.write_text(json.dumps(o,indent=2)+'\n')
print(json.dumps(o,indent=2))
if not o['passed']:raise RuntimeError('new CUDA controls failed; engine launch refused')
