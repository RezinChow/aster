"""Prepare two default-off bounded H200 experiments on an immutable source copy."""
import difflib,hashlib,json
from pathlib import Path
from xolotl_trial_common import BASE
root=BASE/'xolotl-trial-source-e9d0826d71c5/source'
out=BASE/'xolotl-h200-graph-experiments.patch'
if out.exists():raise RuntimeError('experiment patch already frozen')
name='tools/v41/engine/ds41_dense.cpp';original=(root/name).read_text(encoding='utf-8-sig');source=original
def replace_once(before,after):
 global source
 if source.count(before)!=1:raise RuntimeError('upstream patch anchor changed: '+before[:90])
 source=source.replace(before,after)
replace_once('bool compute(ggml_cgraph * gf, bool cached);','bool compute(ggml_cgraph * gf, bool cached, bool readback_follows = false);')
replace_once('bool Ds41Dense::Impl::compute(ggml_cgraph * gf, bool cached) {','bool Ds41Dense::Impl::compute(ggml_cgraph * gf, bool cached, bool readback_follows) {')
replace_once('    if (ggml_backend_graph_compute(backend, gf) != GGML_STATUS_SUCCESS) { err = "graph compute failed"; return false; }','''    // H200 experiment: only attn_router opts in, and it queues all readbacks on
    // this same backend then fences before exposing host routes/activations.
    // No asynchronous finish, snapshot, allocator reset or caller-owned graph.
    ggml_status compute_status;
#ifdef DS41_HAVE_CUDA
    if (readback_follows && env_on("ASTER_XQ_ASYNC_ATTN_READBACK", false) && ggml_backend_is_cuda(backend))
        compute_status = ggml_backend_graph_compute_async(backend, gf);
    else
#endif
        compute_status = ggml_backend_graph_compute(backend, gf);
    if (compute_status != GGML_STATUS_SUCCESS) { err = "graph compute failed"; return false; }''')
start=source.index('bool Ds41Dense::attn_router(');end=source.index('\nbool Ds41Dense::',start+1)
part=source[start:end];anchor='const bool ok = im.compute(gf, cached || mcached);'
if part.count(anchor)!=1 or 'ggml_backend_tensor_get_async' not in part or 'ggml_backend_synchronize(im.backend);' not in part:raise RuntimeError('attn-router readback/fence contract changed')
part=part.replace(anchor,'const bool ok = im.compute(gf, cached || mcached, true);')
source=source[:start]+part+source[end:]
replace_once('static constexpr size_t kPassGraphCtx = (size_t) 256 << 20;','''static constexpr size_t kPassGraphCtx = (size_t) 256 << 20;

// Bounded CPU graph metadata only. Defaults preserve the upstream 256 MiB.
// Capacity never changes graph keys, tensors, numerical ops or cache reset rules.
static size_t h200_pass_graph_ctx_bytes() {
    const char * v = std::getenv("ASTER_XQ_PASS_GRAPH_MIB");
    if (!v || std::strcmp(v, "256") == 0) return kPassGraphCtx;
    if (std::strcmp(v, "512") == 0) return (size_t) 512 << 20;
    if (std::strcmp(v, "1024") == 0) return (size_t) 1024 << 20;
    if (std::strcmp(v, "2048") == 0) return (size_t) 2048 << 20;
    std::fprintf(stderr, "ASTER_XQ_PASS_GRAPH_MIB must be 256, 512, 1024 or 2048\\n");
    std::abort();
}''')
replace_once('ggml_init_params gp = { kPassGraphCtx, nullptr, true };','ggml_init_params gp = { h200_pass_graph_ctx_bytes(), nullptr, true };')
patch=''.join(difflib.unified_diff(original.splitlines(True),source.splitlines(True),fromfile='a/'+name,tofile='b/'+name))
cmake=(root/'CMakeLists.txt').read_text(encoding='utf-8-sig')
anchor='  set(GGML_STATIC ON CACHE BOOL "" FORCE)'
if cmake.count(anchor)!=1:raise RuntimeError('dynamic CUDA link anchor changed')
modified=cmake.replace(anchor,'  option(STRATA_GGML_STATIC "Link ggml CUDA dependencies statically" ON)\n  set(GGML_STATIC ${STRATA_GGML_STATIC} CACHE BOOL "" FORCE)')
patch+=''.join(difflib.unified_diff(cmake.splitlines(True),modified.splitlines(True),fromfile='a/CMakeLists.txt',tofile='b/CMakeLists.txt'))
out.write_text(patch,encoding='utf-8',newline='\n')
report=dict(source_revision='e9d0826d71c59072cbff77d2a31dd51f27ab7a12',patch_sha256=hashlib.sha256(out.read_bytes()).hexdigest(),default_graph_metadata_mib=256,closed_graph_metadata_mib=[256,512,1024,2048],async_scope='attn_router only; same-stream readbacks and existing backend synchronize retained',changes_model_math=False,compiled=False,gpu_validated=False)
(BASE/'xolotl-h200-graph-experiments-plan.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
