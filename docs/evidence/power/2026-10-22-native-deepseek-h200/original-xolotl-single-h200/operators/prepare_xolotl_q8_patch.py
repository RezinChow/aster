import difflib,hashlib,json
from xolotl_trial_common import BASE
root=BASE/'xolotl-trial-source-e9d0826d71c5'
out=BASE/'xolotl-h200-q8-mmq.patch'
if out.exists():raise RuntimeError('Q8 patch already frozen')
name='ggml/src/ggml-cuda/mmvq.cu';old=(root/'llama-source'/name).read_text(encoding='utf-8-sig');s=old
anchor='bool ggml_cuda_should_use_mmvq(enum ggml_type type, int cc, int64_t ne11) {'
if s.count(anchor)!=1:raise RuntimeError('Q8 selector anchor differs')
s=s.replace('#include <cstdint>','#include <cstdint>\n#include <cstdlib>\n#include <cstring>')
s=s.replace(anchor,anchor+'''
    // Aster experiment: H200 Q8 dense projections at verification widths only.
    // Defaults preserve the pinned upstream dispatch; no weight conversion.
    static const bool h200_q8_mmq = [] {
        const char* v=std::getenv("ASTER_H200_Q8_MMQ");
        if (!v || std::strcmp(v,"0")==0) return false;
        if (std::strcmp(v,"1")==0) return true;
        std::fprintf(stderr,"ASTER_H200_Q8_MMQ must be 0 or 1\\n"); std::abort();
    }();
    if (h200_q8_mmq && cc==900 && type==GGML_TYPE_Q8_0 && ne11>=2 && ne11<=8) return false;
''')
patch=''.join(difflib.unified_diff(old.splitlines(True),s.splitlines(True),fromfile='a/'+name,tofile='b/'+name))
out.write_text(patch,encoding='utf-8',newline='\n')
# This source patch is applied after the existing source-only split patch.
out2=BASE/'xolotl-h200-q8-control.patch';name='CMakeLists.txt';old=(root/'source'/name).read_text(encoding='utf-8-sig')
extra='''
option(ASTER_H200_BUILD_Q8_TEST "Build H200 Q8 dispatch control" OFF)
if(ASTER_H200_BUILD_Q8_TEST AND STRATA_ENABLE_CUDA)
  add_executable(aster_h200_q8_mmq tools/v41/engine/aster_h200_q8_mmq.cpp)
  target_link_libraries(aster_h200_q8_mmq PRIVATE ggml ggml-cuda)
endif()
'''
patch2=''.join(difflib.unified_diff(old.splitlines(True),(old+extra).splitlines(True),fromfile='a/'+name,tofile='b/'+name))
name='tools/v41/engine/aster_h200_q8_mmq.cpp';h=(BASE/'aster_h200_q8_mmq.cpp').read_text()
patch2+=''.join(difflib.unified_diff([],h.splitlines(True),fromfile='/dev/null',tofile='b/'+name))
out2.write_text(patch2,encoding='utf-8',newline='\n')
meta=dict(default='off',runtime_closed_set=['0','1'],scope='SM90 Q8_0 dense matrix dispatch, M2..8; M1 remains MMVQ',changes_weights=False,bitwise_equality_claimed=False,numerics='TensorCore MMQ may change activation rounding/accumulation order; require finite paired numerical controls and full-model quality/output review before promotion',patches={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [out,out2]},compiled=False,gpu_validated=False)
(BASE/'xolotl-h200-q8-mmq-plan.json').write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps(meta,indent=2))
