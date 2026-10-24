"""Merge uniform per-group dispatch; add an opt-in exact GPU group histogram."""
import ast
from xolotl_trial_common import BASE
header_path=BASE/'aster_ptq_mma_integrated_v2.cuh'
if header_path.exists():raise RuntimeError('V2 header already frozen')
header=(BASE/'aster_ptq_mma_integrated.cuh').read_text()
def change_once(text,a,b):
 if text.count(a)!=1:raise RuntimeError('V2 anchor differs: '+a[:80])
 return text.replace(a,b)
header=change_once(header,'__global__ __launch_bounds__(256) void proto_gu(', '__device__ __forceinline__ void proto_gu_body(')
header=change_once(header,'const int32_t* ng,const int32_t* tok,const ProtoQ8* x,NativeExpertLayout l,float* gate,float* up) {','const int32_t* ng,const int32_t* tok,const ProtoQ8* x,NativeExpertLayout l,float* gate,float* up,float (*partial)[128]) {')
header=change_once(header,'    __shared__ float partial[8][128];\n','')
extra=r'''
__device__ unsigned long long group_histogram[10];
void report_group_histogram() {
    unsigned long long h[10]={};
    const cudaError_t e=cudaMemcpyFromSymbol(h,group_histogram,sizeof(h));
    if(e!=cudaSuccess){std::fprintf(stderr,"ASTER_MMA_GROUPS_ERROR %d\n",int(e));return;}
    std::fprintf(stderr,"ASTER_MMA_GROUPS {\"groups\":[%llu,%llu,%llu,%llu,%llu,%llu,%llu,%llu,%llu],\"entries\":%llu}\n",
        h[0],h[1],h[2],h[3],h[4],h[5],h[6],h[7],h[8],h[9]);
}
bool group_diagnostics() {
    static const bool enabled=[] {
        const char* v=std::getenv("ASTER_XQ_PTQ_MMA_DIAGNOSTICS");
        if(!v || std::strcmp(v,"0")==0)return false;
        if(std::strcmp(v,"1")!=0 || std::atexit(report_group_histogram)!=0){std::fprintf(stderr,"MMA diagnostics initialization refused\n");std::exit(1);}
        return true;
    }();
    return enabled;
}
'''
last=header.rfind('\n}')
if last<0:raise RuntimeError('V2 namespace end missing')
header=header[:last]+extra+header[last:]
header+=r'''
template<bool RECORD>
__global__ __launch_bounds__(256) void aster_ptq_hybrid_gu(const unsigned long long* ptr,const int32_t* starts,
    const int32_t* ng,const int32_t* tok,const block_q8_1* x,NativeExpertLayout l,float* gate,float* up) {
    const int group=blockIdx.y;
    if(group>=*ng)return;
    const int count=starts[group+1]-starts[group];
    if(count<0){asm volatile("trap;");return;}
    if constexpr(RECORD) {
        if(blockIdx.x==0 && threadIdx.x==0) {
            atomicAdd(aster_ptq_mma::group_histogram+min(count,8),1ull);
            atomicAdd(aster_ptq_mma::group_histogram+9,(unsigned long long)count);
        }
    }
    __shared__ float partial[8][128];
    if(count<4)native_gu_amd_body<143,4>(ptr,starts,ng,tok,x,l,gate,up);
    else aster_ptq_mma::proto_gu_body<40>(ptr,starts,ng,tok,(const aster_ptq_mma::ProtoQ8*)x,l,gate,up,partial);
}
'''
header_path.write_text(header)
worker=(BASE/'xolotl_ptq_mma_integrated_worker.py').read_text()
start=worker.index(" once('template<int TG, int MODE>");end=worker.index(" anchor='void native_expert_grouped",start)
replacement=r''' once('template<int TG, int MODE>\n__global__ void __launch_bounds__(256) native_gu_amd_kernel(', 'template<int TG, int MODE>\n__device__ __forceinline__ void native_gu_amd_body(')
 end=s.index('template<int TD, int MODE>',s.index('native_gu_amd_body('))
 wrapper='''+repr('''template<int TG,int MODE>
__global__ void __launch_bounds__(256) native_gu_amd_kernel(const unsigned long long* p,const int32_t* st,const int32_t* ng,
    const int32_t* tok,const block_q8_1* x,NativeExpertLayout l,float* g,float* u) {
    native_gu_amd_body<TG,MODE>(p,st,ng,tok,x,l,g,u);
}
''')+'''
 s=s[:end]+wrapper+s[end:]
'''
# replacement is Python source; use real newline escapes in the anchor literals.
replacement=replacement.replace("MODE>\\\\n", "MODE>\\n")
worker=worker[:start]+replacement+worker[end:]
a='''        aster_ptq_mma::proto_gu<40><<<gm,256,0,s>>>(grp_ptr,grp_start,n_groups,ent_tok,
            (const aster_ptq_mma::ProtoQ8*)X,L,gate,up);
        native_gu_amd_kernel<143,4,true><<<gm,256,0,s>>>(grp_ptr,grp_start,n_groups,ent_tok,X,L,gate,up);'''
b='''        if(aster_ptq_mma::group_diagnostics())aster_ptq_hybrid_gu<true><<<gm,256,0,s>>>(grp_ptr,grp_start,n_groups,ent_tok,X,L,gate,up);
        else aster_ptq_hybrid_gu<false><<<gm,256,0,s>>>(grp_ptr,grp_start,n_groups,ent_tok,X,L,gate,up);'''
worker=change_once(worker,a,b)
worker=change_once(worker,"for mode in ['0','1']:","for mode in ['0','1','1-diagnostic']:")
worker=change_once(worker,"env['ASTER_XQ_PTQ_MMA']=mode;run(","env['ASTER_XQ_PTQ_MMA']='0' if mode=='0' else '1';env['ASTER_XQ_PTQ_MMA_DIAGNOSTICS']='1' if mode=='1-diagnostic' else '0';run(")
anchor="  controls[mode]=rows"
extra=r'''
  if mode=='1-diagnostic':
   lines=(root/('controls-'+mode+'.stderr.log')).read_text().splitlines()
   stats=[json.loads(x[len('ASTER_MMA_GROUPS '):]) for x in lines if x.startswith('ASTER_MMA_GROUPS ')]
   if len(stats)!=1 or stats[0]!={'groups':[32,288,32,256,32,256,0,0,288],'entries':4928}:raise RuntimeError('exact GPU group histogram differs from the fixed fixture')
   out['diagnostic_fixture_histogram']=stats[0]
'''
worker=change_once(worker,anchor,extra+anchor)
worker=change_once(worker,"'-std=c++20','--generate-code=arch=compute_90,code=sm_90'","'-std=c++20','-Xptxas=-v','--generate-code=arch=compute_90,code=sm_90'")
ast.parse(worker)
(BASE/'xolotl_ptq_mma_integrated_v2_worker.py').write_text(worker)
stage=(BASE/'stage_xolotl_ptq_mma_integrated.py').read_text()
start=stage.index("s=(BASE/'aster_ptq_mma_prototype_v15.cu')");end=stage.index("root=lease()['remote']",start)
stage=stage[:start]+"header=(BASE/'aster_ptq_mma_integrated_v2.cuh').read_text()\n"+stage[end:]
for a,b in [('xolotl-ptq-mma-integrated-intent.json','xolotl-ptq-mma-integrated-v2-intent.json'),("'/xolotl-ptq-mma-integrated'","'/xolotl-ptq-mma-integrated-v2'"),('xolotl_ptq_mma_integrated_worker.py','xolotl_ptq_mma_integrated_v2_worker.py')]:stage=change_once(stage,a,b)
ast.parse(stage);(BASE/'stage_xolotl_ptq_mma_integrated_v2.frozen.py').write_text(stage)
observer=(BASE/'observe_xolotl_ptq_mma_integrated.py').read_text().replace('xolotl-ptq-mma-integrated-intent.json','xolotl-ptq-mma-integrated-v2-intent.json').replace('xolotl-ptq-mma-integrated-latest.json','xolotl-ptq-mma-integrated-v2-latest.json')
ast.parse(observer);(BASE/'observe_xolotl_ptq_mma_integrated_v2.frozen.py').write_text(observer)
print('V2 prepared only: one group-uniform kernel, same arithmetic, optional GPU histogram with exact1184-group/4928-entry fixture gate. No build/model gain claimed.')
