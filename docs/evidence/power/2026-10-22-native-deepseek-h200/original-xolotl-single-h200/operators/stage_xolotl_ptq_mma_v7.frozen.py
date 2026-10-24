"""Freeze and launch a bounded standalone prototype against immutable parent libraries."""
import base64,hashlib,json,time
from xolotl_trial_common import BASE,lease,jump,owned
path=BASE/'xolotl-ptq-mma-v7-intent.json'
if path.exists():raise RuntimeError('prototype intent exists; observe it instead of restarting')
parent=json.loads((BASE/'xolotl-h200-split-rows-build-intent.json').read_text())['root']
commands=json.loads((BASE/'xolotl-mma-parent-build-commands.json').read_text())
root=lease()['remote']+'/xolotl-ptq-mma-v7'
source=(BASE/'aster_ptq_mma_prototype_v7.cu').read_text().replace('@PARENT_SOURCE@',parent+'/source')
worker='''import os,json,subprocess,time,hashlib,shlex
from pathlib import Path
root=Path(__file__).resolve().parent
plan=json.loads((root/'plan.json').read_text());out=dict(phase='preflight',unix=time.time(),passed=False,model_speed_claimed=False)
def save():
 p=root/'result.tmp';p.write_text(json.dumps(out,indent=2)+'\\n');p.replace(root/'result.json')
def command(args,name,seconds,cwd,env):
 out['step']=name;save()
 with (root/(name+'.stdout.log')).open('xb') as stdout,(root/(name+'.stderr.log')).open('xb') as stderr:
  p=subprocess.run(['timeout','--signal=TERM','--kill-after=15',str(seconds)]+args,cwd=cwd,env=env,stdout=stdout,stderr=stderr)
 for kind in ['stdout','stderr']:
  if (root/(name+'.'+kind+'.log')).stat().st_size>2*1024**2:raise RuntimeError('prototype log bound exceeded')
 return p.returncode
try:
 if os.getuid()!=10250 or root.stat().st_uid!=10250:raise RuntimeError('prototype must run as owner')
 proof=json.loads((root.parent/'resource-result.json').read_text())
 if proof['phase']!='passed' or proof['expectedGpus']!=1 or time.time()+330>proof['leaseEndsUnix']:raise RuntimeError('single-GPU immutable lease is insufficient')
 active=subprocess.run(['nvidia-smi','--query-compute-apps=pid,gpu_uuid','--format=csv,noheader,nounits'],capture_output=True,text=True,timeout=8,check=True)
 if active.stdout.strip():raise RuntimeError('another GPU workload is active')
 parent=Path(plan['parent']);fixture=parent/'source/src/kernels/iq_multi_parity.cpp'
 out['parent_fixture_sha256']=hashlib.sha256(fixture.read_bytes()).hexdigest()
 out['parent_library_sha256']={}
 for name in ['libstrata_kernels.a','libstrata_core.a']:
  p=parent/'build'/name
  if p.is_symlink() or p.stat().st_uid!=10250:raise RuntimeError('borrowed library owner differs')
  out['parent_library_sha256'][name]=hashlib.sha256(p.read_bytes()).hexdigest()
 env={k:v for k,v in os.environ.items() if not k.startswith(('STRATA_','ASTER_XQ_'))};env['CUDA_VISIBLE_DEVICES']=''
 compile_args=['/usr/local/cuda/bin/nvcc','-O3','-DNDEBUG','-DSTRATA_Q6K_EXPERTS=1','-std=c++20','--generate-code=arch=compute_90,code=sm_90','-I'+str(parent/'source/include'),'-I'+str(parent/'source/third_party/ggml'),'-Xptxas=-v','-c',str(root/'prototype.cu'),'-o',str(root/'prototype.o')]
 out['compile_args']=compile_args
 if command(compile_args,'compile',120,root,env):raise RuntimeError('prototype compilation failed')
 link=plan['parent_link']
 if not link.startswith(': && ') or not link.endswith(' && :'):raise RuntimeError('parent link wrapper differs')
 args=shlex.split(link[5:-5]);old='CMakeFiles/aster_xq_split_parity.dir/src/kernels/iq_multi_parity.cpp.o'
 if args.count(old)!=1 or args.count('-o')!=1:raise RuntimeError('prototype link substitution differs')
 args[args.index(old)]=str(root/'prototype.o');args[args.index('-o')+1]=str(root/'aster_ptq_mma_prototype')
 out['link_args']=args
 if command(args,'link',30,parent/'build',env):raise RuntimeError('prototype link failed')
 binary=root/'aster_ptq_mma_prototype';out['binary']=dict(bytes=binary.stat().st_size,sha256=hashlib.sha256(binary.read_bytes()).hexdigest())
 if time.time()+110>proof['leaseEndsUnix']:raise RuntimeError('not enough immutable lease for prototype GPU controls')
 env['CUDA_VISIBLE_DEVICES']='0';exit=command([str(binary)],'gpu',90,root,env)
 rows=[json.loads(s) for s in (root/'gpu.stdout.log').read_text().splitlines()]
 if len(rows)!=8 or rows[0].get('device')!='NVIDIA H200' or rows[0].get('devices')!=1 or rows[-1].get('complete') is not True:raise RuntimeError('prototype output schema differs')
 cases=rows[1:-1];passed=exit==0 and rows[-1]['failures']==0 and all(c['strict_passed'] for c in cases)
 out.update(phase='complete' if passed else 'failed',passed=passed,gpu_exit=exit,device=rows[0],cases=cases,within_predeclared_2e4=all(c['finite'] and c['sentinels'] and c['relative_l2']<=2e-4 and c['normalized_max']<=2e-4 for c in cases),strict_gate='bitwise GU and identical post-SwiGLU q8 bytes',timing_scope='steady-state phase1 over predecoded synthetic GU codes capped at1GiB; one-time preparation and extra bytes reported separately in gpu stderr; candidate also writes temporary h; no full-model memory or tok/s claim')
except Exception as e:out.update(phase='failed',error=str(e))
finally:out['finished_unix']=time.time();save()
'''
compile(worker,'ptq-mma-worker.py','exec');(BASE/'xolotl_ptq_mma_v7_worker.frozen.py').write_text(worker)
plan=dict(parent=parent,parent_link=commands['aster_xq_split_parity']['link_command'],strict_gate='bitwise GU, identical q8, finite, untouched sentinels',secondary_tolerance=dict(relative_l2=2e-4,normalized_max=2e-4),primary_ptx='https://docs.nvidia.com/cuda/parallel-thread-execution/index.html#matrix-multiply-accumulate-operation-using-mma-instruction',target_300_met=False,target_500_met=False)
payload={'prototype.cu':source.encode(),'worker.py':worker.encode(),'plan.json':(json.dumps(plan,indent=2)+'\n').encode()}
record=dict(unix=time.time(),root=root,phase='prepared',parent=parent,files=[dict(file=n,bytes=len(v),sha256=hashlib.sha256(v).hexdigest()) for n,v in payload.items()])
path.write_text(json.dumps(record,indent=2)+'\n')
code='''from pathlib import Path
import os,json,base64,hashlib
r=@RECORD@;root=Path(r['root'])
if root.parent.resolve()!=root.parent or root.parent.stat().st_uid!=os.getuid() or os.getuid()!=10250:raise RuntimeError('prototype stage owner differs')
root.mkdir(mode=0o700,exist_ok=False)
payload=@PAYLOAD@
for meta in r['files']:
 raw=base64.b64decode(payload[meta['file']])
 if len(raw)!=meta['bytes'] or hashlib.sha256(raw).hexdigest()!=meta['sha256']:raise RuntimeError('prototype payload differs')
 (root/meta['file']).write_bytes(raw)
print(json.dumps(dict(staged=True)))
'''.replace('@RECORD@',repr(record)).replace('@PAYLOAD@',repr({k:base64.b64encode(v).decode() for k,v in payload.items()}))
record['stage']=jump(code);record['phase']='staged';path.write_text(json.dumps(record,indent=2)+'\n')
code='''from pathlib import Path
import json,subprocess,time,os
root=Path(@ROOT@)
if root.resolve()!=root or root.stat().st_uid!=os.getuid() or (root/'process.json').exists():raise RuntimeError('prototype stage identity changed')
proof=json.loads((root.parent/'resource-result.json').read_text())
if time.time()+330>proof['leaseEndsUnix']:raise RuntimeError('prototype deadline does not fit immutable lease')
with (root/'worker.log').open('xb') as f:
 p=subprocess.Popen(['timeout','--signal=TERM','--kill-after=20','300','python3','-u',str(root/'worker.py')],cwd=root,stdin=subprocess.DEVNULL,stdout=f,stderr=f,start_new_session=True)
out=dict(pid=p.pid,start_ticks=int(Path('/proc/'+str(p.pid)+'/stat').read_text().split(') ',1)[1].split()[19]),uid=os.getuid(),unix=time.time(),deadline_seconds=300)
(root/'process.json').write_text(json.dumps(out,indent=2)+'\\n');print(json.dumps(out))
'''.replace('@ROOT@',repr(root))
record['phase']='launch_requested';path.write_text(json.dumps(record,indent=2)+'\n')
record['process']=owned(code);record['phase']='launched';path.write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record['process'],indent=2))
