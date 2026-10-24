"""Freeze a default-off PTQ1_0/Q3_K multi-token decode experiment."""
import difflib,hashlib,json
from xolotl_trial_common import BASE
root=BASE/'xolotl-trial-source-e9d0826d71c5/source'
out=BASE/'xolotl-h200-split-mmvq.patch'
if out.exists():raise RuntimeError('split patch already frozen')
name='src/kernels/cuda/iq_kernels.cu';old=(root/name).read_text(encoding='utf-8-sig');s=old
for before,after in [('#include <cstdlib>','#include <cstdlib>\n#include <cstring>'),('// One row against the n <= NC activations', '#include "fork/aster_xq_split.cuh"\n\n// One row against the n <= NC activations'),('    if constexpr (!kSplit<TG>) native_gu_kernel<TG>', '''    if constexpr (TG == 143 || TG == 11) {
        if (!g_old_kernels && aster_xq_split_enabled(TG)) {
            native_gu_multi_kernel<TG, false, false><<<grid, 256, 0, s>>>(grp_ptr, grp_start, n_groups, ent_tok, X, L, gate, up);
            return;
        }
    }
    if constexpr (!kSplit<TG>) native_gu_kernel<TG>'''),('    if constexpr (!kSplit<TD>) native_down_kernel<TD>', '''    if constexpr (TD == 143 || TD == 11) {
        if (!g_old_kernels && aster_xq_split_enabled(TD)) {
            native_down_multi_kernel<TD, false><<<grid, 256, 0, s>>>(grp_ptr, grp_start, n_groups, ent_dst, hq, L, out);
            return;
        }
    }
    if constexpr (!kSplit<TD>) native_down_kernel<TD>''')]:
 if s.count(before)!=1:raise RuntimeError('split source anchor differs: '+before[:80])
 s=s.replace(before,after)
patch=''.join(difflib.unified_diff(old.splitlines(True),s.splitlines(True),fromfile='a/'+name,tofile='b/'+name))
name='src/kernels/cuda/fork/aster_xq_split.cuh';header=(BASE/'aster_xq_split.cuh').read_text()
patch+=''.join(difflib.unified_diff([],header.splitlines(True),fromfile='/dev/null',tofile='b/'+name))
name='src/kernels/iq_multi_parity.cpp';old=(root/name).read_text(encoding='utf-8-sig');s=old
for before,after in [
 ('        case 42: return "Q2_0";', '        case 42: return "Q2_0";\n        case 143: return "PTQ1_0";\n        case 11: return "Q3_K";'),
 ('return t == 20 ? 32 : t == 42 ? 64 : 256;', 'return t == 143 ? 128 : t == 20 ? 32 : t == 42 ? 64 : 256;'),
 ('std::memcpy(&w[o], &h, 2);', 'std::memcpy(&w[o + ((t == 143 || t == 11) ? bs - 2 : 0)], &h, 2);'),
 ('    const bool do_bench = argc > 1', '''    if (argc > 1 && std::string(argv[1]) == "--aster-xq") {
        const char* flag = std::getenv("ASTER_XQ_SPLIT_MMVQ");
        if (!flag || std::strcmp(flag,"both") != 0) { std::fprintf(stderr,"--aster-xq requires ASTER_XQ_SPLIT_MMVQ=both\\n"); return 2; }
        cudaStream_t s; ck(cudaStreamCreate(&s), "stream");
        cudaDeviceProp prop; ck(cudaGetDeviceProperties(&prop,0),"device properties");
        std::printf("Aster split GPU: %s, SM%d%d\\n",prop.name,prop.major,prop.minor);
        std::mt19937 rng(18);
        for (int gu : {143, 11}) for (int dt : {143, 11, 42}) {
            check_grouped(gu, dt, 5120, 2304, s, rng);
            check_grouped(gu, dt, 1024, 512, s, rng);
        }
        for (int gu : {143, 11}) for (int m : {1, 3, 5, 8}) {
            Grouped G(gu, gu, 5120, 2304, std::vector<int>(7, m), 8, rng);
            float us[2];
            for (int old = 1; old >= 0; --old) us[old] = 1e3f * time_ms(s, 50, [&] { G.run(old != 0, s); });
            std::printf("Aster XQ type %d, T%d: scalar %.2f us, split %.2f us\\n",gu,m,us[1],us[0]);
        }
        std::printf("aster_xq_split_parity: %d failures\\n", g_fail);
        cudaStreamDestroy(s); return g_fail ? 1 : 0;
    }
    const bool do_bench = argc > 1''')]:
 if s.count(before)!=1:raise RuntimeError('split test anchor differs: '+before[:80])
 s=s.replace(before,after)
patch+=''.join(difflib.unified_diff(old.splitlines(True),s.splitlines(True),fromfile='a/'+name,tofile='b/'+name))
name='CMakeLists.txt';old=(root/name).read_text(encoding='utf-8-sig')
extra='''
# Aster opt-in hardware control, independent of the upstream all-tests switch.
option(ASTER_XQ_BUILD_SPLIT_TEST "Build XQ split MMVQ hardware control" OFF)
if(ASTER_XQ_BUILD_SPLIT_TEST AND STRATA_ENABLE_CUDA)
  add_executable(aster_xq_split_parity src/kernels/iq_multi_parity.cpp)
  target_include_directories(aster_xq_split_parity PRIVATE ${_strata_gpu_include_directories})
  target_link_libraries(aster_xq_split_parity PRIVATE strata_kernels CUDA::cudart)
endif()
'''
patch+=''.join(difflib.unified_diff(old.splitlines(True),(old+extra).splitlines(True),fromfile='a/'+name,tofile='b/'+name))
out.write_text(patch,encoding='utf-8',newline='\n')
meta=dict(source_revision='e9d0826d71c59072cbff77d2a31dd51f27ab7a12',patch_sha256=hashlib.sha256(out.read_bytes()).hexdigest(),default='off',closed_runtime_values=['0','143','11','both'],scope='grouped expert gate/up/down launchers only; unchanged grid, row reduction, activations and weights',ptq_contract='whole block Fmt<143> only; unsigned-to-signed ternary integer dot reordering exact within bounded int32 range; float scale and per-lane sum order preserved',compiled=False,gpu_validated=False)
(BASE/'xolotl-h200-split-mmvq-plan.json').write_text(json.dumps(meta,indent=2)+'\n')
print(json.dumps(meta,indent=2))
