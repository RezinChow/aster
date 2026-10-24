"""Bounded GPU-free build of a same-binary control and two opt-in experiments."""
import hashlib,json,os,subprocess,time
from pathlib import Path
ROOT=Path(__file__).resolve().parent
RESULT=dict(phase='building',unix=time.time(),gpu_execution_claimed=False)
def save():
 p=ROOT/'build-result.tmp';p.write_text(json.dumps(RESULT,indent=2)+'\n');p.replace(ROOT/'build-result.json')
def command(args,name,seconds):
 RESULT['step']=name;save()
 with (ROOT/(name+'.log')).open('xb',buffering=0) as out:
  p=subprocess.run(['timeout','--signal=TERM','--kill-after=30',str(seconds)]+args,cwd=ROOT,stdout=out,stderr=out)
 if (ROOT/(name+'.log')).stat().st_size>64*1024**2:raise RuntimeError('build log exceeded bound')
 if p.returncode:raise RuntimeError('build step failed: '+name+' exit='+str(p.returncode))
try:
 if os.getuid()!=10250 or ROOT.stat().st_uid!=10250:raise RuntimeError('build must run as artifact owner')
 os.environ['CUDA_VISIBLE_DEVICES']=''
 source=ROOT/'source';ggml=source/'third_party/llama.cpp'
 command(['patch','--batch','--fuzz=0','-p1','-d',str(ggml),'-i',str(source/'tools/xolotl/ggml/xolotl-ggml.patch')],'official-ggml-patch',30)
 command(['patch','--batch','--fuzz=0','-p1','-d',str(source),'-i',str(ROOT/'h200-experiments.patch')],'h200-experiment-patch',30)
 command(['patch','--batch','--fuzz=0','-p1','-d',str(source),'-i',str(ROOT/'split-mmvq.patch')],'split-mmvq-patch',30)
 args=['cmake','-S',str(source),'-B',str(ROOT/'build'),'-G','Ninja','-DCMAKE_BUILD_TYPE=Release','-DCMAKE_CUDA_ARCHITECTURES=90','-DCMAKE_CUDA_COMPILER=/usr/local/cuda/bin/nvcc','-DSTRATA_ENABLE_CUDA=ON','-DSTRATA_GGML_CUDA=ON','-DSTRATA_GGML_STATIC=OFF','-DSTRATA_MMQ_KQUANTS=ON','-DSTRATA_GGML_DIR='+str(ggml),'-DSTRATA_DSV41_FQ_OP=ON','-DSTRATA_DSV41_HC_MIX=ON','-DSTRATA_BUILD_TESTS=OFF','-DASTER_XQ_BUILD_SPLIT_TEST=ON']
 RESULT['configure_command']=args;save();command(args,'configure',90)
 command(['cmake','--build',str(ROOT/'build'),'--target','ds41_generate','aster_xq_split_parity','-j','24'],'compile',2100)
 binaries={}
 for name in ['ds41_generate','aster_xq_split_parity']:
  path=ROOT/'build'/name
  h=hashlib.sha256()
  with path.open('rb') as f:
   while b:=f.read(8*1024**2):h.update(b)
  binaries[name]=dict(path=str(path),bytes=path.stat().st_size,sha256=h.hexdigest())
 RESULT.update(phase='built',finished_unix=time.time(),binaries=binaries,tests_executed=False)
except Exception as e:
 RESULT.update(phase='failed',finished_unix=time.time(),error=repr(e));raise
finally:save()
