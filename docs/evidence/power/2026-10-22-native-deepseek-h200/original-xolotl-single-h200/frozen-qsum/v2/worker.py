"""Build a private archive and run bounded exact controls; never modify the parent."""
import hashlib,json,os,shlex,shutil,subprocess,time,difflib
from pathlib import Path
root=Path(__file__).resolve().parent;plan=json.loads((root/'plan.json').read_text());out=dict(phase='building',unix=time.time(),passed=False,model_speed_claimed=False)
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  while b:=f.read(8*1024**2):h.update(b)
 return h.hexdigest()
def save():
 p=root/'result.tmp';p.write_text(json.dumps(out,indent=2)+'\n');p.replace(root/'result.json')
def run(args,name,seconds,cwd,env):
 out['step']=name;save()
 with (root/(name+'.stdout.log')).open('xb') as a,(root/(name+'.stderr.log')).open('xb') as b:p=subprocess.run(['timeout','--signal=TERM','--kill-after=15',str(seconds)]+args,cwd=cwd,env=env,stdout=a,stderr=b)
 if p.returncode:raise RuntimeError(name+' exit '+str(p.returncode))
 for suffix in ['stdout','stderr']:
  if (root/(name+'.'+suffix+'.log')).stat().st_size>2*1024**2:raise RuntimeError('log bound exceeded')
try:
 if os.getuid()!=10250 or root.stat().st_uid!=10250:raise RuntimeError('build owner differs')
 proof=json.loads((root.parent/'resource-result.json').read_text())
 if proof['phase']!='passed' or proof['expectedGpus']!=1 or time.time()+1000>proof['leaseEndsUnix']:raise RuntimeError('immutable build/control lease insufficient')
 parent=Path(plan['parent']);cuda=parent/'source/src/kernels/cuda';original=cuda/'iq_kernels.cu'
 if sha(original)!=plan['parent_iq_sha256'] or sha(parent/'build/libstrata_kernels.a')!='92867ada2ab31266c43d1afd855d99a7c7349039c5b20fae417a4abadbf10287':raise RuntimeError('immutable parent differs')
 for m in plan['sources']:
  p=root/m['file']
  if p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size!=m['bytes'] or sha(p)!=m['sha256']:raise RuntimeError('qsum source identity differs')
 (root/'iq_kernels.original.cu').write_bytes(original.read_bytes());a=original.read_text();b=(root/'iq_kernels.cu').read_text()
 (root/'iq-qsum.patch').write_text(''.join(difflib.unified_diff(a.splitlines(True),b.splitlines(True),fromfile='a/src/kernels/cuda/iq_kernels.cu',tofile='b/src/kernels/cuda/iq_kernels.cu')))
 env={k:v for k,v in os.environ.items() if not k.startswith(('STRATA_','ASTER_XQ_'))};env['CUDA_VISIBLE_DEVICES']=''
 common=['/usr/local/cuda/bin/nvcc','-O3','-DNDEBUG','-DSTRATA_Q6K_EXPERTS=1','-std=c++20','-Xptxas=-v','--generate-code=arch=compute_90,code=sm_90','-I'+str(parent/'source/include'),'-I'+str(parent/'source/third_party/ggml'),'-I'+str(cuda)]
 for src,obj,name in [('iq_kernels.cu','iq_kernels.cu.o','compile'),('qsum_parity.cu','qsum_parity.o','fixture-compile')]:
  args=common+['-c',str(root/src),'-o',str(root/obj)];out[name+'_args']=args;run(args,name,300,root,env)
 shutil.copyfile(parent/'build/libstrata_kernels.a',root/'libstrata_kernels.a')
 members=subprocess.run(['/usr/bin/ar','t',str(root/'libstrata_kernels.a')],capture_output=True,text=True,check=True,timeout=10).stdout.splitlines()
 if members.count('iq_kernels.cu.o')!=1:raise RuntimeError('archive replacement member differs')
 run(['/usr/bin/ar','r',str(root/'libstrata_kernels.a'),str(root/'iq_kernels.cu.o')],'archive',20,root,env)
 binaries={}
 for name in ['ds41_generate','aster_xq_split_parity']:
  command=plan['commands'][name]['link_command']
  if not command.startswith(': && ') or not command.endswith(' && :'):raise RuntimeError('link wrapper differs')
  args=shlex.split(command[5:-5])
  if args.count('libstrata_kernels.a')!=1 or args.count('-o')!=1:raise RuntimeError('link substitutions differ')
  args[args.index('libstrata_kernels.a')]=str(root/'libstrata_kernels.a');binary=root/name;args[args.index('-o')+1]=str(binary)
  if name=='aster_xq_split_parity':
   old='CMakeFiles/aster_xq_split_parity.dir/src/kernels/iq_multi_parity.cpp.o'
   if args.count(old)!=1:raise RuntimeError('fixture substitution differs')
   args[args.index(old)]=str(root/'qsum_parity.o')
  out['link_'+name]=args;run(args,'link-'+name,45,parent/'build',env);binaries[name]=dict(path=str(binary),bytes=binary.stat().st_size,sha256=sha(binary))
 out['binaries']=binaries;out['archive_sha256']=sha(root/'libstrata_kernels.a');save()
 if time.time()+600>proof['leaseEndsUnix']:raise RuntimeError('immutable controls deadline insufficient')
 active=subprocess.run(['nvidia-smi','--query-compute-apps=pid,gpu_uuid','--format=csv,noheader,nounits'],capture_output=True,text=True,timeout=8,check=True)
 if active.stdout.strip():raise RuntimeError('another GPU workload active')
 env.update(CUDA_VISIBLE_DEVICES='0',STRATA_EXP_MODE_T143='4',STRATA_EXP_MODE_T11='0',ASTER_XQ_SPLIT_MMVQ='11');controls={}
 for mode in ['0','gu','both']:
  env['ASTER_XQ_PTQ_QSUM']=mode;run([str(root/'aster_xq_split_parity')],'controls-'+mode,180,root,env)
  rows=[json.loads(x) for x in (root/('controls-'+mode+'.stdout.log')).read_text().splitlines()]
  if len(rows)!=15 or rows[0].get('devices')!=1 or rows[-1].get('complete') is not True or rows[-1].get('failures')!=0 or not all(x.get('strict_passed') for x in rows[1:-1]):raise RuntimeError('exact GU/Down/q8/sentinel controls failed')
  controls[mode]=rows
 out.update(phase='qualified',passed=True,controls=controls,strict_cases=39,adopted=False)
except Exception as e:out.update(phase='failed',error=str(e))
finally:out['finished_unix']=time.time();save();print(json.dumps(dict(phase=out['phase'],passed=out['passed'],error=out.get('error'))))
if not out['passed']:raise SystemExit(1)
