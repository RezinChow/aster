"""Narrow dispatch to measured large shapes and preserve MMVQ fp16 input scales."""
import ast,difflib,hashlib,json
from xolotl_trial_common import BASE
ggml=BASE/'xolotl-trial-source-e9d0826d71c5/llama-source'
patch=''
def change(name, fn):
 global patch
 old=(ggml/name).read_text(encoding='utf-8-sig');new=fn(old)
 patch+=''.join(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='a/'+name,tofile='b/'+name))
def once(s,a,b):
 if s.count(a)!=1:raise RuntimeError('V3 source anchor differs: '+a[:80])
 return s.replace(a,b)
def selector(s):
 s=once(s,'#include <cstdint>','#include <cstdint>\n#include <cstdlib>\n#include <cstring>')
 return s+'''
// Aster default-off SM90 experiment. Only measured large dense projections.
bool aster_h200_q8_mmq_selected(ggml_type type,int cc,int64_t m,int64_t k,int64_t n) {
    static const bool on=[] {
        const char* v=std::getenv("ASTER_H200_Q8_MMQ");
        if (!v || std::strcmp(v,"0")==0) return false;
        if (std::strcmp(v,"1")==0) return true;
        std::fprintf(stderr,"ASTER_H200_Q8_MMQ must be 0 or 1\\n");std::abort();
    }();
    return on && cc==900 && type==GGML_TYPE_Q8_0 && m>=2 && m<=8 &&
           ((k==1280 && n==32768) || (k==5120 && n==129280));
}
'''
change('ggml/src/ggml-cuda/mmvq.cu',selector)
change('ggml/src/ggml-cuda/mmvq.cuh',lambda s:s+'\nbool aster_h200_q8_mmq_selected(ggml_type,int,int64_t,int64_t,int64_t);\n')
change('ggml/src/ggml-cuda/ggml-cuda.cu',lambda s:once(s,'if (ggml_cuda_should_use_mmvq(src0->type, cc, ne11)) {','if (ggml_cuda_should_use_mmvq(src0->type, cc, ne11) && !aster_h200_q8_mmq_selected(src0->type, cc, ne11, ne00, ne01)) {'))
signature='''void quantize_mmq_q8_1_cuda(
        const float * x, const int32_t * ids, void * vy, const ggml_type type_src0,
        const int64_t ne00, const int64_t s01, const int64_t s02, const int64_t s03,
        const int64_t ne0, const int64_t ne1, const int64_t ne2, const int64_t ne3, cudaStream_t stream, bool half_scale)'''
def quantize(s):
 s=once(s,'template <mmq_q8_1_ds_layout ds_layout, bool scatter>','template <mmq_q8_1_ds_layout ds_layout, bool scatter, bool half_scale = false>')
 s=once(s,'y[ib].d4[iqs/32]  = d;','y[ib].d4[iqs/32]  = half_scale ? __half2float(__float2half_rn(d)) : d;')
 return s+'\n'+signature+''' {
    if (!half_scale) { quantize_mmq_q8_1_cuda(x,ids,vy,type_src0,ne00,s01,s02,s03,ne0,ne1,ne2,ne3,stream);return; }
    GGML_ASSERT(type_src0==GGML_TYPE_Q8_0 && ids==nullptr && ne00%4==0 && ne0%QK8_1_MMQ==0);
    const dim3 grid(ne1,(ne0+4*CUDA_QUANTIZE_BLOCK_SIZE_MMQ-1)/(4*CUDA_QUANTIZE_BLOCK_SIZE_MMQ),ne2*ne3);
    quantize_mmq_q8_1<MMQ_Q8_1_DS_LAYOUT_D4,false,true><<<grid,CUDA_QUANTIZE_BLOCK_SIZE_MMQ,0,stream>>>(
        x,ids,vy,ne00,s01,s02,s03,ne0,ne1,ne2,0);
}
'''
change('ggml/src/ggml-cuda/quantize.cu',quantize)
change('ggml/src/ggml-cuda/quantize.cuh',lambda s:s+'\n'+signature+';\n')
def mmq(s):
 s=once(s,'#include "mmq.cuh"','#include "mmq.cuh"\n#include "mmvq.cuh"')
 a='''                quantize_mmq_q8_1_cuda(src1_d, nullptr, src1_q8_1.get(), src0->type, ne10, s11, s12, s13, ne10_padded,
                                       ne11, ne12, ne13, stream);'''
 b='''                const bool half_scale=aster_h200_q8_mmq_selected(src0->type,cc,ne11,ne00,ne01);
                quantize_mmq_q8_1_cuda(src1_d, nullptr, src1_q8_1.get(), src0->type, ne10, s11, s12, s13, ne10_padded,
                                       ne11, ne12, ne13, stream,half_scale);'''
 return once(s,a,b)
change('ggml/src/ggml-cuda/mmq.cu',mmq)
target=BASE/'xolotl-h200-q8-mmq-v3.patch'
if target.exists():raise RuntimeError('Q8 V3 patch already frozen')
target.write_text(patch,encoding='utf-8',newline='\n')
# Same finite numerical gates; the harness now asserts narrow dispatch.
cpp=(BASE/'aster_h200_q8_mmq.cpp').read_text()
cpp=once(cpp,'bool ggml_cuda_should_use_mmvq(ggml_type, int, int64_t);','bool ggml_cuda_should_use_mmvq(ggml_type, int, int64_t);\nbool aster_h200_q8_mmq_selected(ggml_type,int,int64_t,int64_t,int64_t);')
cpp=once(cpp,'const bool vector_path=ggml_cuda_should_use_mmvq(GGML_TYPE_Q8_0,900,M);','const bool vector_path=ggml_cuda_should_use_mmvq(GGML_TYPE_Q8_0,900,M) && !aster_h200_q8_mmq_selected(GGML_TYPE_Q8_0,900,M,K,N);')
cpp=once(cpp,'if (vector_path!=(M==1 || !mmq)) return 3;','if (vector_path!=!(mmq && M>=2 && M<=8 && ((K==1280 && N==32768)||(K==5120 && N==129280)))) return 3;')
(BASE/'aster_h200_q8_mmq_v3.cpp').write_text(cpp,encoding='utf-8',newline='\n')
old=(BASE/'xolotl-trial-source-e9d0826d71c5/source/CMakeLists.txt').read_text(encoding='utf-8-sig')
old=once(old,'  set(GGML_STATIC ON CACHE BOOL "" FORCE)','  option(STRATA_GGML_STATIC "Link ggml CUDA dependencies statically" ON)\n  set(GGML_STATIC ${STRATA_GGML_STATIC} CACHE BOOL "" FORCE)')
def extra(name):
 tree=ast.parse((BASE/name).read_text());ns=[n for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='extra' for t in n.targets)]
 if len(ns)!=1:raise RuntimeError('CMake extra source differs')
 return ast.literal_eval(ns[0].value)
old+=extra('prepare_xolotl_split_patch.py');new=old+extra('prepare_xolotl_q8_patch.py')
control=''.join(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='a/CMakeLists.txt',tofile='b/CMakeLists.txt'))
control+=''.join(difflib.unified_diff([],cpp.splitlines(True),fromfile='/dev/null',tofile='b/tools/v41/engine/aster_h200_q8_mmq.cpp'))
(BASE/'xolotl-h200-q8-control-v3.patch').write_text(control,encoding='utf-8',newline='\n')
stage=(BASE/'stage_xolotl_q8_v2_build.frozen.py').read_text().replace('q8-v2-build-intent','q8-v3-build-intent').replace('xolotl-q8-mmq-v2-h200','xolotl-q8-mmq-v3-h200').replace('xolotl-h200-q8-mmq.patch','xolotl-h200-q8-mmq-v3.patch').replace('xolotl-h200-q8-control-v2.patch','xolotl-h200-q8-control-v3.patch').replace('xolotl_q8_v2_build_worker.frozen.py','xolotl_q8_v3_build_worker.frozen.py')
stage=once(stage,"compile(worker,'q8-build-worker.py','exec')","worker=worker.replace(\"'compile',900)\",\"'compile',600)\")\ncompile(worker,'q8-build-worker.py','exec')")
(BASE/'stage_xolotl_q8_v3_build.frozen.py').write_text(stage)
for kind in ['launch','observe','qualify']:
 name=kind+'_xolotl_q8_v2_build.frozen.py';s=(BASE/name).read_text().replace('q8-v2','q8-v3').replace('q8_v2','q8_v3')
 if kind=='launch':s=s.replace('time.time()+1200','time.time()+900').replace("'1200','python3'","'900','python3'").replace('deadline_seconds=1200','deadline_seconds=900')
 if kind=='qualify':s=once(s,"b['mmvq']==(a['M']==1)","b['mmvq']==(not (a['M']>=2 and a['M']<=8 and ((a['K']==1280 and a['N']==32768) or (a['K']==5120 and a['N']==129280))))")
 compile(s,kind+'-q8-v3.py','exec');(BASE/(kind+'_xolotl_q8_v3_build.frozen.py')).write_text(s)
meta=dict(default='off',runtime='ASTER_H200_Q8_MMQ=1',shapes=[[1280,32768],[5120,129280]],widths=[2,3,4,5,6,7,8],change='Selected large shapes use MMQ with its input scale rounded through fp16, matching MMVQ scale storage; original quantizer and dispatch preserved otherwise',numerical_thresholds_unchanged=True,patch_sha256=hashlib.sha256(target.read_bytes()).hexdigest(),compiled=False,gpu_validated=False)
(BASE/'xolotl-h200-q8-mmq-v3-plan.json').write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps(meta,indent=2))
