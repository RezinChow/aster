"""Build an opt-in hybrid GU dispatch in a fresh archive; never mutate the parent."""
import hashlib,json,os,shlex,shutil,subprocess,time,difflib
from pathlib import Path
root=Path(__file__).resolve().parent
plan=json.loads((root/'plan.json').read_text());out=dict(phase='preflight',unix=time.time(),passed=False,model_speed_claimed=False)
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  while b:=f.read(8*1024**2):h.update(b)
 return h.hexdigest()
def save():
 p=root/'result.tmp';p.write_text(json.dumps(out,indent=2)+'\n');p.replace(root/'result.json')
def run(args,name,seconds,cwd,env):
 out['step']=name;save()
 with (root/(name+'.stdout.log')).open('xb') as a,(root/(name+'.stderr.log')).open('xb') as b:
  p=subprocess.run(['timeout','--signal=TERM','--kill-after=15',str(seconds)]+args,cwd=cwd,env=env,stdout=a,stderr=b)
 if p.returncode:raise RuntimeError(name+' failed with exit '+str(p.returncode))
 for suffix in ['stdout','stderr']:
  if (root/(name+'.'+suffix+'.log')).stat().st_size>2*1024**2:raise RuntimeError('log bound exceeded')
try:
 if os.getuid()!=10250 or root.stat().st_uid!=10250:raise RuntimeError('build owner differs')
 proof=json.loads((root.parent/'resource-result.json').read_text())
 if proof['phase']!='passed' or proof['expectedGpus']!=1 or time.time()+660>proof['leaseEndsUnix']:raise RuntimeError('immutable build/control lease is insufficient')
 parent=Path(plan['parent']);cuda=parent/'source/src/kernels/cuda';original=cuda/'iq_kernels.cu'
 if original.is_symlink() or original.stat().st_uid!=10250 or original.stat().st_size>2*1024**2:raise RuntimeError('parent source identity differs')
 before=original.read_text();s=before;out['parent_iq_source_sha256']=sha(original)
 def once(a,b):
  global s
  if s.count(a)!=1:raise RuntimeError('hybrid dispatch anchor differs: '+a[:80])
  s=s.replace(a,b)
 once('template<int TG, int MODE>\n__global__ void __launch_bounds__(256) native_gu_amd_kernel(', 'template<int TG, int MODE>\n__device__ __forceinline__ void native_gu_amd_body(')
 end=s.index('template<int TD, int MODE>',s.index('native_gu_amd_body('))
 wrapper='template<int TG,int MODE>\n__global__ void __launch_bounds__(256) native_gu_amd_kernel(const unsigned long long* p,const int32_t* st,const int32_t* ng,\n    const int32_t* tok,const block_q8_1* x,NativeExpertLayout l,float* g,float* u) {\n    native_gu_amd_body<TG,MODE>(p,st,ng,tok,x,l,g,u);\n}\n'
 s=s[:end]+wrapper+s[end:]
 anchor='void native_expert_grouped(const NativeExpertLayout& L, const unsigned long long* grp_ptr, const int32_t* grp_start,'
 once(anchor,'#if defined(__CUDACC__) && !defined(__HIPCC__)\n#include "aster_ptq_mma.cuh"\n#endif\n\n'+anchor)
 anchor='    if ((em == 1 || em == 2 || em == 4) && amd_gu && (L.up_type < 0 || L.up_type == L.gu_type)) {'
 dispatch='''#if defined(__CUDACC__) && !defined(__HIPCC__)
    static const bool aster_mma = [] {
        const char* v=std::getenv("ASTER_XQ_PTQ_MMA");
        if(!v || std::strcmp(v,"0")==0)return false;
        if(std::strcmp(v,"1")!=0){std::fprintf(stderr,"ASTER_XQ_PTQ_MMA must be0 or1\\n");std::exit(1);}
        return true;
    }();
    if(aster_mma && em==4 && L.gu_type==143 && (L.up_type<0 || L.up_type==143) &&
       L.n_embd==5120 && L.n_ff==2304 && lora==nullptr) {
        const dim3 gm((unsigned)(2*L.n_ff/32),(unsigned)cap_groups);
        if(aster_ptq_mma::group_diagnostics())aster_ptq_hybrid_gu<true><<<gm,256,0,s>>>(grp_ptr,grp_start,n_groups,ent_tok,X,L,gate,up);
        else aster_ptq_hybrid_gu<false><<<gm,256,0,s>>>(grp_ptr,grp_start,n_groups,ent_tok,X,L,gate,up);
    } else
#endif
'''
 once(anchor,dispatch+anchor)
 (root/'iq_kernels.original.cu').write_text(before);(root/'iq_kernels.cu').write_text(s)
 (root/'iq-mma.patch').write_text(''.join(difflib.unified_diff(before.splitlines(True),s.splitlines(True),fromfile='a/src/kernels/cuda/iq_kernels.cu',tofile='b/src/kernels/cuda/iq_kernels.cu')))
 out['patched_iq_source_sha256']=sha(root/'iq_kernels.cu');out['mma_header_sha256']=sha(root/'aster_ptq_mma.cuh');save()
 env={k:v for k,v in os.environ.items() if not k.startswith(('STRATA_','ASTER_XQ_'))};env['CUDA_VISIBLE_DEVICES']=''
 args=['/usr/local/cuda/bin/nvcc','-O3','-DNDEBUG','-DSTRATA_Q6K_EXPERTS=1','-std=c++20','-Xptxas=-v','--generate-code=arch=compute_90,code=sm_90','-I'+str(parent/'source/include'),'-I'+str(parent/'source/third_party/ggml'),'-I'+str(cuda),'-c',str(root/'iq_kernels.cu'),'-o',str(root/'iq_kernels.cu.o')]
 out['compile_args']=args;run(args,'compile',300,root,env)
 lib=parent/'build/libstrata_kernels.a'
 if sha(lib)!='92867ada2ab31266c43d1afd855d99a7c7349039c5b20fae417a4abadbf10287':raise RuntimeError('parent archive SHA differs')
 shutil.copyfile(lib,root/'libstrata_kernels.a')
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
   if args.count(old)!=1:raise RuntimeError('fixture link substitution differs')
   args[args.index(old)]=plan['prototype_object']
  out['link_'+name]=args;run(args,'link-'+name,45,parent/'build',env)
  binaries[name]=dict(path=str(binary),bytes=binary.stat().st_size,sha256=sha(binary))
 out['binaries']=binaries;out['new_archive_sha256']=sha(root/'libstrata_kernels.a');save()
 if time.time()+140>proof['leaseEndsUnix']:raise RuntimeError('not enough immutable lease for controls')
 active=subprocess.run(['nvidia-smi','--query-compute-apps=pid,gpu_uuid','--format=csv,noheader,nounits'],capture_output=True,text=True,timeout=8,check=True)
 if active.stdout.strip():raise RuntimeError('another GPU workload is active')
 env['CUDA_VISIBLE_DEVICES']='0';controls={}
 for mode in ['0','1','1-diagnostic']:
  env['ASTER_XQ_PTQ_MMA']='0' if mode=='0' else '1';env['ASTER_XQ_PTQ_MMA_DIAGNOSTICS']='1' if mode=='1-diagnostic' else '0';run([str(root/'aster_xq_split_parity')],'controls-'+mode,60,root,env)
  rows=[json.loads(x) for x in (root/('controls-'+mode+'.stdout.log')).read_text().splitlines()]
  if len(rows)!=8 or rows[0].get('devices')!=1 or rows[-1].get('complete') is not True or rows[-1].get('failures')!=0 or not all(c.get('strict_passed') for c in rows[1:-1]):raise RuntimeError('integrated dispatch strict controls failed')

  if mode=='1-diagnostic':
   lines=(root/('controls-'+mode+'.stderr.log')).read_text().splitlines()
   stats=[json.loads(x[len('ASTER_MMA_GROUPS '):]) for x in lines if x.startswith('ASTER_MMA_GROUPS ')]
   if len(stats)!=1 or stats[0]!={'groups':[32,288,32,256,32,256,0,0,288],'entries':4928}:raise RuntimeError('exact GPU group histogram differs from the fixed fixture')
   out['diagnostic_fixture_histogram']=stats[0]
  controls[mode]=rows
 out.update(phase='qualified',passed=True,controls=controls,integrated_into_engine=True,adopted=False,model_speed_claimed=False)
except Exception as e:out.update(phase='failed',error=str(e))
finally:out['finished_unix']=time.time();save();print(json.dumps(dict(phase=out['phase'],passed=out['passed'],error=out.get('error'))))
if not out['passed']:raise SystemExit(1)
