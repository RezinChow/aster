"""Prepare same-backend async finish/readback with lifetime fences, default off."""
import hashlib,json,difflib
from xolotl_trial_common import BASE
p=BASE/'aster_dense_async_chain.cpp'
if p.exists():raise RuntimeError('dense-chain source already frozen; create a new version')
raw=(BASE/'xolotl-dense-chain-parent.cpp').read_bytes();meta=json.loads((BASE/'xolotl-dense-chain-parent.json').read_text())
if hashlib.sha256(raw).hexdigest()!=meta['source_sha256']:raise RuntimeError('exact dense parent differs')
s=raw.decode();original=s
def once(a,b):
 global s
 if s.count(a)!=1:raise RuntimeError('async-chain source anchor differs: '+a[:90])
 s=s.replace(a,b)
once('#include "ds41_dense.hpp"','#include "ds41_dense.hpp"\n#include "aster_dense_async_fence.hpp"\n#include <atomic>')
once('    bool own_backend = false, cpu = true;','    bool own_backend = false, cpu = true;\n    AsterDenseAsyncFence async_finish_fence;')
once('    ~Impl() {','    ~Impl() {\n        async_finish_fence.invalidate([&] { if (backend) ggml_backend_synchronize(backend); });')
once('    bool compute(ggml_cgraph * gf, bool cached, bool readback_follows = false);','    bool compute(ggml_cgraph * gf, bool cached, bool readback_follows = false, bool defer_finish = false);')
once('bool Ds41Dense::Impl::compute(ggml_cgraph * gf, bool cached, bool readback_follows) {',r'''static bool aster_dense_async_chain_on() {
    static const bool enabled = [] {
        const char * v = std::getenv("ASTER_XQ_DENSE_ASYNC_CHAIN");
        if (!v || std::strcmp(v, "0") == 0) return false;
        if (std::strcmp(v, "1") == 0) return true;
        std::fprintf(stderr, "ASTER_XQ_DENSE_ASYNC_CHAIN must be 0 or 1\n");
        std::abort();
    }();
    return enabled;
}
bool Ds41Dense::Impl::compute(ggml_cgraph * gf, bool cached, bool readback_follows, bool defer_finish) {''')
once('    Allo & a = cached ? allo_dec : allo_pass;','''    Allo & a = cached ? allo_dec : allo_pass;
    const auto prior = a.graph_epoch.find(gf);
    const bool stable = cached && env_on("DS41_GRAPH_REUSE", true) && !a.failed && gf->uid != 0 &&
        prior != a.graph_epoch.end() && prior->second == a.epoch;
    async_finish_fence.before_allocation(stable, [&] { ggml_backend_synchronize(backend); });''')
a='''    if (readback_follows && env_on("ASTER_XQ_ASYNC_ATTN_READBACK", false) && ggml_backend_is_cuda(backend))
        compute_status = ggml_backend_graph_compute_async(backend, gf);
    else'''
b='''    const bool chain = aster_dense_async_chain_on() && cached && ggml_backend_is_cuda(backend);
    const bool queued_finish = chain && defer_finish;
    const bool asynchronous = queued_finish || (readback_follows && ggml_backend_is_cuda(backend) &&
        (env_on("ASTER_XQ_ASYNC_ATTN_READBACK", false) || chain));
    if (asynchronous) {
        compute_status = ggml_backend_graph_compute_async(backend, gf);
        if (compute_status == GGML_STATUS_SUCCESS && queued_finish) {
            static std::atomic_flag announced = ATOMIC_FLAG_INIT;
            if (!announced.test_and_set(std::memory_order_relaxed))
                std::fprintf(stderr, "ASTER_DENSE_CHAIN first cached single-sequence CUDA finish queued\\n");
        }
    } else'''
once(a,b)
anchor='    if (compute_status != GGML_STATUS_SUCCESS) { err = "graph compute failed"; return false; }'
once(anchor,anchor+'''
#ifdef DS41_HAVE_CUDA
    async_finish_fence.submitted(asynchronous, queued_finish);
#else
    async_finish_fence.completed();
#endif''')
once('void Ds41Dense::Impl::reset_graphs() {\n    Impl & im = *this;','void Ds41Dense::Impl::reset_graphs() {\n    Impl & im = *this;\n    im.async_finish_fence.invalidate([&] { ggml_backend_synchronize(im.backend); });')
anchor='''        if (im.gctx_m) {
            for (const auto & kv : im.mgraphs) im.allo_dec.graph_epoch.erase(kv.second);'''
once(anchor,'''        if (im.gctx_m) {
            im.async_finish_fence.invalidate([&] { ggml_backend_synchronize(im.backend); });
            for (const auto & kv : im.mgraphs) im.allo_dec.graph_epoch.erase(kv.second);''')
a=s.index('bool Ds41Dense::finish(int il,');b=s.index('bool Ds41Dense::finish_predict(',a)
block=s[a:b];anchor='    const bool ok = im.compute(gf, cached || mcached);'
if block.count(anchor)!=1:raise RuntimeError('finish submission anchor differs')
block=block.replace(anchor,'''    const bool defer_finish = !im.rows_mode && im.slots.size() == 1 && !routed_sum &&
        n >= 1 && n <= 8 && (cached || mcached);
    const bool ok = im.compute(gf, cached || mcached, false, defer_finish);''');s=s[:a]+block+s[b:]
a=s.index('bool Ds41Dense::attn_router_impl(');b=s.index('bool Ds41Dense::predict(',a);block=s[a:b]
anchor='    ggml_backend_synchronize(im.backend);'
if block.count(anchor)!=1:raise RuntimeError('route readback completion fence differs')
block=block.replace(anchor,anchor+'\n    im.async_finish_fence.completed();');s=s[:a]+block+s[b:]
p.write_text(s);(BASE/'aster-dense-async-chain.patch').write_text(''.join(difflib.unified_diff(original.splitlines(True),s.splitlines(True),fromfile='a/tools/v41/engine/ds41_dense.cpp',tofile='b/tools/v41/engine/ds41_dense.cpp')))
plan=dict(parent_sha256=meta['source_sha256'],source_sha256=hashlib.sha256(p.read_bytes()).hexdigest(),flag='ASTER_XQ_DENSE_ASYNC_CHAIN=0|1',default_off=True,scope='cached single-sequence CUDA finish plus existing same-backend route readback; no model arithmetic or weights change',guards=['fence before non-reusable allocation','fence before whole cache reset','fence before pass-cache drop','fence before destruction','mandatory host route readback fence','single slot,1..8 columns, persistent graphs and device-routed input for deferred finish'],built=False,host_tests_passed=False,gpu_quality_passed=False,performance_claimed=False)
(BASE/'xolotl-dense-async-chain-source-plan.json').write_text(json.dumps(plan,indent=2)+'\n');print(json.dumps(plan))
