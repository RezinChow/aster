"""GPU-free private dense archive build with hermetic lifetime tests."""
import json,hashlib,os,shlex,subprocess,shutil,time
from pathlib import Path
root=Path(__file__).resolve().parent;plan=json.loads((root/'plan.json').read_text());out=dict(phase='building',unix=time.time(),passed=False,gpu_tests_claimed=False,performance_claimed=False)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save():
 p=root/'result.tmp';p.write_text(json.dumps(out,indent=2)+'\n');p.replace(root/'result.json')
def run(args,name,seconds,cwd):
 out['step']=name;save()
 with (root/(name+'.stdout.log')).open('xb') as a,(root/(name+'.stderr.log')).open('xb') as b:q=subprocess.run(args,stdout=a,stderr=b,cwd=cwd,timeout=seconds)
 if q.returncode:raise RuntimeError(name+' exit '+str(q.returncode))
try:
 if os.getuid()!=10250 or root.stat().st_uid!=10250:raise RuntimeError('dense build owner differs')
 os.environ['CUDA_VISIBLE_DEVICES']='';parent=Path(plan['parent']);proof=json.loads((root.parent/'resource-result.json').read_text())
 if proof['phase']!='passed' or time.time()+110>proof['leaseEndsUnix']:raise RuntimeError('immutable GPU-free build deadline insufficient')
 lib=parent/'build/libds41_dense.a'
 if sha(lib)!=plan['archive_sha256'] or sha(parent/'source/tools/v41/engine/ds41_dense.cpp')!=plan['source_sha256']:raise RuntimeError('dense parent changed')
 for m in plan['sources']:
  p=root/m['file']
  if p.is_symlink() or p.stat().st_uid!=10250 or p.stat().st_size!=m['bytes'] or sha(p)!=m['sha256']:raise RuntimeError('frozen dense input changed')
 args=shlex.split(plan['compile_command']);clean=[];i=0
 while i<len(args):
  if args[i] in ['-MT','-MF']:i+=2;continue
  if args[i]=='-MD':i+=1;continue
  clean.append(args[i]);i+=1
 clean[clean.index('-o')+1]=str(root/'ds41_dense.cpp.o');clean[clean.index('-c')+1]=str(root/'ds41_dense.cpp');out['compile_args']=clean
 run(clean,'compile',60,root)
 run(['/usr/bin/c++','-O2','-std=c++20',str(root/'fence_test.cpp'),'-o',str(root/'fence_test')],'host-test-compile',10,root)
 run([str(root/'fence_test')],'host-test',5,root);out['hermetic_fence_tests_passed']=True
 shutil.copyfile(lib,root/'libds41_dense.a');members=subprocess.run(['ar','t',str(root/'libds41_dense.a')],capture_output=True,text=True,check=True,timeout=5).stdout.splitlines()
 if members.count('ds41_dense.cpp.o')!=1:raise RuntimeError('dense archive member differs')
 run(['ar','r',str(root/'libds41_dense.a'),str(root/'ds41_dense.cpp.o')],'archive',5,root)
 command=plan['link_command']
 if not command.startswith(': && ') or not command.endswith(' && :'):raise RuntimeError('dense link wrapper differs')
 args=shlex.split(command[5:-5])
 if args.count('libds41_dense.a')!=1 or args.count('-o')!=1:raise RuntimeError('dense link substitutions differ')
 args[args.index('libds41_dense.a')]=str(root/'libds41_dense.a');binary=root/'ds41_generate';args[args.index('-o')+1]=str(binary);out['link_args']=args;run(args,'link',20,parent/'build')
 out.update(phase='built',passed=True,binary=dict(path=str(binary),bytes=binary.stat().st_size,sha256=sha(binary)),archive_sha256=sha(root/'libds41_dense.a'),gpu_quality_passed=False,adopted=False)
except Exception as e:out.update(phase='failed',error=str(e))
out['finished_unix']=time.time();save();print(json.dumps(dict(phase=out['phase'],passed=out['passed'],error=out.get('error'))))
